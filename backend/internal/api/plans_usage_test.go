// plans_usage_test.go — N°122 → N°324 : tarifs MONO-MODE Hotspot.
//
// Couvre la SOURCE UNIQUE du pricing (model.ResolvePlan — catalogue unique
// + alias foyer homenet-* mappés pour les abonnements GeniusPay en vol),
// le moteur d'application des périodes (applySubscriptionLocked : montants
// de la grille hotspot quel que soit l'usage du compte, normalisation des
// identifiants historiques, forfaits annuels pro-ratisés), l'essai unique
// de 60 jours à l'inscription (l'essai segmenté 30 j foyer est retiré avec
// le mode) et la demande de souscription (un planId « homenet-* » HISTORIQUE
// résout et aboutit — compat renouvellement ; un planId inconnu → 400).
package api

import (
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// TestResolvePlanMonoMode — résolution du catalogue unique : identifiants
// exacts, alias foyer homenet-* mappés sur la formule hotspot de la même
// période, identifiants historiques compris, inconnus refusés.
func TestResolvePlanMonoMode(t *testing.T) {
	cas := []struct {
		nom      string
		id       string
		usage    string
		wantOK   bool
		wantID   string
		wantPrix int
	}{
		{"catalogue exact hotspot mensuel", "hotspot-mensuel", "hotspot", true, "hotspot-mensuel", 2500},
		{"catalogue exact hotspot annuel", "hotspot-annuel", "hotspot", true, "hotspot-annuel", 25000},
		{"alias foyer mensuel → hotspot (compat GeniusPay)", "homenet-mensuel", "homenet", true, "hotspot-mensuel", 2500},
		{"alias foyer annuel → hotspot (compat GeniusPay)", "homenet-annuel", "homenet", true, "hotspot-annuel", 25000},
		{"alias foyer mensuel, usage hotspot", "homenet-mensuel", "hotspot", true, "hotspot-mensuel", 2500},
		{"legacy essentiel → mensuel hotspot", "essentiel", "hotspot", true, "hotspot-mensuel", 2500},
		{"legacy essentiel usage homenet → mensuel hotspot", "essentiel", "homenet", true, "hotspot-mensuel", 2500},
		{"legacy essentiel usage vide → hotspot", "essentiel", "", true, "hotspot-mensuel", 2500},
		{"legacy illimite → annuel hotspot", "illimite", "hotspot", true, "hotspot-annuel", 25000},
		{"legacy illimite usage homenet → annuel hotspot", "illimite", "homenet", true, "hotspot-annuel", 25000},
		{"essai n'est PAS une formule payante", "essai", "hotspot", false, "", 0},
		{"inconnu refusé", "premium-gold", "hotspot", false, "", 0},
	}
	for _, c := range cas {
		p, ok := model.ResolvePlan(c.id, c.usage)
		if ok != c.wantOK {
			t.Fatalf("%s : ResolvePlan(%q, %q) ok = %v, attendu %v", c.nom, c.id, c.usage, ok, c.wantOK)
		}
		if !c.wantOK {
			continue
		}
		if p.ID != c.wantID || p.PriceFcfa != c.wantPrix {
			t.Fatalf("%s : formule résolue = %s/%d, attendu %s/%d", c.nom, p.ID, p.PriceFcfa, c.wantID, c.wantPrix)
		}
	}

	// PlansForUsage — la grille hotspot UNIQUE, quelque soit l'usage passé
	// (N°324 — mono-mode : « homenet » léger résiduel compris).
	for _, usage := range []string{"hotspot", "homenet", "", "nimporte-quoi"} {
		got := model.PlansForUsage(usage)
		if len(got) != 2 || got[0].ID != "hotspot-mensuel" || got[1].ID != "hotspot-annuel" ||
			got[0].PriceFcfa != 2500 || got[1].PriceFcfa != 25000 {
			t.Fatalf("PlansForUsage(%q) = %+v, attendu la grille hotspot unique (2500/25000)", usage, got)
		}
	}

	// Classification — identifiants historiques et alias foyer compris
	// (défense en profondeur : les abonnements en vol gardent leur PlanID).
	for _, id := range []string{"hotspot-annuel", "homenet-annuel", "illimite"} {
		if !model.IsAnnualPlanID(id) {
			t.Fatalf("IsAnnualPlanID(%q) = faux", id)
		}
	}
	for _, id := range []string{"hotspot-mensuel", "homenet-mensuel", "essentiel"} {
		if !model.IsPerRouterPlanID(id) {
			t.Fatalf("IsPerRouterPlanID(%q) = faux", id)
		}
	}
	if model.IsAnnualPlanID("hotspot-mensuel") || model.IsPerRouterPlanID("homenet-annuel") {
		t.Fatal("classification annuelle/par-routeur incohérente")
	}
}

// TestApplySubscriptionUsagePricing — le moteur de périodes applique
// TOUJOURS les tarifs de la grille hotspot (N°324 — mono-mode), quel que
// soit l'usage du compte (y compris un compte « homenet » léger en base) :
// montants, quotas, libellés et NORMALISATION des identifiants historiques
// et des alias foyer vers les identifiants catalogue.
func TestApplySubscriptionUsagePricing(t *testing.T) {
	db := &model.DB{
		Accounts: []model.Account{
			{ID: "acc-hot", Usage: model.AccountUsageHotspot},
			{ID: "acc-home", Usage: model.AccountUsageHomeNet}, // N°324 — léger : lu hotspot
		},
		Routers: []model.Router{
			{ID: "r1", AccountID: "acc-hot"},
			{ID: "r2", AccountID: "acc-hot"},
		},
		SettingsByAccount: map[string]model.Settings{},
	}

	type attendu struct {
		nom       string
		acc       string
		planID    string
		months    int
		slots     int
		wantPlan  string
		wantMont  int
		wantSlots int
		wantLabel string
	}
	cas := []attendu{
		{"legacy essentiel hotspot 3 routeurs", "acc-hot", "essentiel", 1, 3, "hotspot-mensuel", 7500, 3, "403Shield Hotspot Mensuel"},
		{"hotspot mensuel explicite", "acc-hot", "hotspot-mensuel", 1, 2, "hotspot-mensuel", 5000, 2, "403Shield Hotspot Mensuel"},
		{"hotspot annuel 12 mois", "acc-hot", "hotspot-annuel", 12, 0, "hotspot-annuel", 25000, 0, "403Shield Hotspot Annuel"},
		{"hotspot annuel 24 mois (empilement tarifaire)", "acc-hot", "hotspot-annuel", 24, 0, "hotspot-annuel", 50000, 0, "403Shield Hotspot Annuel"},
		{"legacy essentiel compte léger (park 0 → plancher 1)", "acc-home", "essentiel", 1, 0, "hotspot-mensuel", 2500, 1, "403Shield Hotspot Mensuel"},
		{"alias homenet-mensuel (renouvellement en vol) → tarif hotspot", "acc-home", "homenet-mensuel", 1, 1, "hotspot-mensuel", 2500, 1, "403Shield Hotspot Mensuel"},
		{"legacy illimite compte léger", "acc-home", "illimite", 12, 0, "hotspot-annuel", 25000, 0, "403Shield Hotspot Annuel"},
		{"alias homenet-annuel (renouvellement en vol) → tarif hotspot", "acc-home", "homenet-annuel", 12, 0, "hotspot-annuel", 25000, 0, "403Shield Hotspot Annuel"},
		{"essai reste hors catalogue", "acc-hot", "essai", 1, 0, "essai", 0, 1, "Essai"},
	}
	for _, c := range cas {
		sub, label, planName, amount := applySubscriptionLocked(db, c.acc, c.planID, c.months, c.slots, true)
		if sub.PlanID != c.wantPlan {
			t.Fatalf("%s : PlanID stocké = %q, attendu %q (grille unique — N°324)", c.nom, sub.PlanID, c.wantPlan)
		}
		if amount != c.wantMont {
			t.Fatalf("%s : montant = %d, attendu %d", c.nom, amount, c.wantMont)
		}
		if sub.RouterSlots != c.wantSlots {
			t.Fatalf("%s : RouterSlots = %d, attendu %d", c.nom, sub.RouterSlots, c.wantSlots)
		}
		if label != c.wantLabel {
			t.Fatalf("%s : libellé = %q, attendu %q", c.nom, label, c.wantLabel)
		}
		if sub.LastAmountFcfa != amount {
			t.Fatalf("%s : LastAmountFcfa (%d) ≠ montant appliqué (%d)", c.nom, sub.LastAmountFcfa, amount)
		}
		if c.planID != "essai" && planName == "" {
			t.Fatalf("%s : nom court de formule vide", c.nom)
		}
	}

	// Empilement : un renouvellement du MÊME plan encore actif part de la fin
	// de la période en cours (identifiant normalisé — une demande historique
	// « essentiel » empile bien sur un abonnement « hotspot-mensuel »).
	sub1, _, _, _ := applySubscriptionLocked(db, "acc-hot", "hotspot-mensuel", 1, 1, true)
	sub2, _, _, _ := applySubscriptionLocked(db, "acc-hot", "essentiel", 1, 1, true)
	end1, err1 := time.Parse(time.RFC3339, sub1.PeriodEnd)
	end2, err2 := time.Parse(time.RFC3339, sub2.PeriodEnd)
	if err1 != nil || err2 != nil {
		t.Fatalf("périodes illisibles : %v / %v", err1, err2)
	}
	if !end2.After(end1) {
		t.Fatalf("le renouvellement legacy doit S'EMILER sur la période active : fin %v ≤ fin %v", end2, end1)
	}
}

// TestSignupTrialMonoMode — N°324 : l'essai public est UNIQUE — 60 jours,
// même quand un vieux frontend envoie encore usage « homenet » (champ
// ignoré à l'inscription). Vérifié bout-en-bout via l'inscription publique
// puis l'état d'abonnement renvoyé à la console.
func TestSignupTrialMonoMode(t *testing.T) {
	ts := newTestServer(t)

	inscrire := func(suffix, usage string) (string, map[string]any) {
		t.Helper()
		code, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]any{
			"username": "trial-" + suffix,
			"password": "Essai-123456",
			"name":     "Essai " + suffix,
			"email":    suffix + "@trial-mikcloud.test",
			"phone":    uniquePhone(),
			"country":  "ci",
			"city":     "Abidjan",
			"usage":    usage,
		})
		if code != 201 {
			t.Fatalf("inscription %s : code %d, corps %v", usage, code, out)
		}
		tok, _ := out["token"].(string)
		return tok, out
	}
	dureeJours := func(tok string) float64 {
		t.Helper()
		code, out := doJSON(t, ts, "GET", "/api/subscription", tok, nil)
		if code != 200 {
			t.Fatalf("GET /api/subscription : code %d, corps %v", code, out)
		}
		sub, _ := out["subscription"].(map[string]any)
		start, _ := sub["periodStart"].(string)
		end, _ := sub["periodEnd"].(string)
		t0, e0 := time.Parse(time.RFC3339, start)
		t1, e1 := time.Parse(time.RFC3339, end)
		if e0 != nil || e1 != nil {
			t.Fatalf("périodes d'essai illisibles : %v / %v", e0, e1)
		}
		return t1.Sub(t0).Hours() / 24
	}

	// Vieux frontend « homenet » : 60 jours, compte HOTSPOT (champ ignoré).
	tokHome, outHome := inscrire("home01", "homenet")
	if days := dureeJours(tokHome); days < 59 || days > 61 {
		t.Fatalf("essai (usage homenet envoyé) = %.1f jours, attendu 60 (essai unique — N°324)", days)
	}
	if u, _ := outHome["user"].(map[string]any); u == nil || u["usage"] != "hotspot" {
		t.Fatalf("la session doit transporter usage=hotspot (mono-mode), obtenu %v", outHome["user"])
	}

	// Champ absent : mêmes 60 jours (l'essai segmenté 30 j foyer est retiré).
	tokHot, outHot := inscrire("hot002", "")
	if days := dureeJours(tokHot); days < 59 || days > 61 {
		t.Fatalf("essai (sans usage) = %.1f jours, attendu 60", days)
	}
	if u, _ := outHot["user"].(map[string]any); u == nil || u["usage"] != "hotspot" {
		t.Fatalf("la session doit transporter usage=hotspot, obtenu %v", outHot["user"])
	}

	// Catalogue UNIQUE : le compte lit exactement la grille hotspot.
	_, view := doJSON(t, ts, "GET", "/api/subscription", tokHome, nil)
	if view["usage"] != "hotspot" {
		t.Fatalf("usage renvoyé = %v, attendu hotspot", view["usage"])
	}
	plans, _ := view["plans"].([]any)
	if len(plans) != 2 {
		t.Fatalf("la grille doit compter exactement 2 formules, obtenu %d", len(plans))
	}
	want := []string{"hotspot-mensuel", "hotspot-annuel"}
	for i, p := range plans {
		if pm, _ := p.(map[string]any); pm == nil || pm["id"] != want[i] {
			t.Fatalf("formule n°%d = %v, attendu %q (grille unique — N°324)", i, p, want[i])
		}
	}
}

// TestSubscriptionPostLegacyHomeNetPlan — N°324 : la garde de mode est morte
// (tout compte et tout plan résolu sont hotspot) ; un planId « homenet-* »
// HISTORIQUE aboutit désormais — résolu en hotspot-* (compat renouvellement
// GeniusPay en vol) au tarif de la grille unique ; un planId inconnu reste
// refusé (400 « Formule inconnue »).
func TestSubscriptionPostLegacyHomeNetPlan(t *testing.T) {
	ts := newTestServer(t)

	code, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]any{
		"username": "mode-legacy",
		"password": "Essai-123456",
		"name":     "Renouvellement Legacy",
		"email":    "mode-legacy@mikcloud.test",
		"phone":    uniquePhone(),
		"country":  "ci",
		"city":     "Abidjan",
		"usage":    "homenet", // vieux frontend — ignoré (N°324)
	})
	if code != 201 {
		t.Fatalf("inscription : code %d, corps %v", code, out)
	}
	if u, _ := out["user"].(map[string]any); u == nil || u["usage"] != "hotspot" {
		t.Fatalf("la session doit transporter usage=hotspot, obtenu %v", out["user"])
	}
	tok, _ := out["token"].(string)

	// Formule foyer HISTORIQUE : résolue en hotspot-mensuel — la demande
	// aboutit au tarif de la grille unique (base catalogue 2 500 F).
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok, map[string]any{"planId": "homenet-mensuel"})
	if code != 200 {
		t.Fatalf("demande homenet-mensuel : code %d, corps %v (alias résolu — N°324)", code, out)
	}
	if base, _ := out["baseAmountFcfa"].(float64); int(base) != 2500 {
		t.Fatalf("base catalogue (résolution hotspot-mensuel) = %v, attendu 2500", out["baseAmountFcfa"])
	}
	if pending, _ := out["pending"].(bool); !pending {
		t.Fatal("la demande doit rester en attente d'encaissement plateforme")
	}

	// Formule inconnue → 400 « Formule inconnue » (message mono-mode).
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok, map[string]any{"planId": "premium-gold"})
	if code != 400 {
		t.Fatalf("formule inconnue : code %d, attendu 400, corps %v", code, out)
	}
	if msg, _ := out["error"].(string); !strings.Contains(msg, "Formule inconnue") {
		t.Fatalf("message = %q, attendu « Formule inconnue (hotspot-mensuel | hotspot-annuel) »", msg)
	}
}
