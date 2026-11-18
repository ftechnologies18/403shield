// Tests N°350 — durée choisie par le client sur la formule mensuelle :
// grille 1·2·3·6·12 (paiement Wave ponctuel), tarif linéaire (prix ×
// routeurs × mois), appariement des demandes PAR durée, activation webhook
// aux mois choisis et repli historique (Months=0 → 1 période, 12 si annuelle).
package api

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// TestMonthsOfRequestLegacy — repli historique et durée choisie :
// Months=0 → 1 période du plan (12 si formule annuelle, alias homenet
// compris) ; Months>0 est renvoyé tel quel (source unique de l'activation).
func TestMonthsOfRequestLegacy(t *testing.T) {
	cas := []struct {
		nom  string
		br   model.BillingRequest
		want int
	}{
		{"mensuel legacy (N°350 antérieur)", model.BillingRequest{PlanID: "hotspot-mensuel"}, 1},
		{"annuel legacy", model.BillingRequest{PlanID: "hotspot-annuel"}, 12},
		{"annuel alias homenet legacy", model.BillingRequest{PlanID: "homenet-annuel"}, 12},
		{"durée choisie 1", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 1}, 1},
		{"durée choisie 2", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 2}, 2},
		{"durée choisie 6", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 6}, 6},
		{"durée choisie 12", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 12}, 12},
	}
	for _, c := range cas {
		if got := monthsOfRequest(c.br); got != c.want {
			t.Errorf("%s : monthsOfRequest = %d, attendu %d", c.nom, got, c.want)
		}
	}
}

// TestPeriodLabelOfRequest — libellé de période d'une demande : la durée
// choisie (« 6 mois ») quand elle est portée, sinon le libellé de la formule
// (« 1 mois » mensuel, « 1 an » annuel — legacy compris).
func TestPeriodLabelOfRequest(t *testing.T) {
	cas := []struct {
		nom  string
		br   model.BillingRequest
		want string
	}{
		{"mensuel legacy", model.BillingRequest{PlanID: "hotspot-mensuel"}, "1 mois"},
		{"annuel legacy", model.BillingRequest{PlanID: "hotspot-annuel"}, "1 an"},
		{"durée 1", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 1}, "1 mois"},
		{"durée 6", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 6}, "6 mois"},
		{"durée 12", model.BillingRequest{PlanID: "hotspot-mensuel", Months: 12}, "12 mois"},
		{"durée 12 annuelle (hors grille client)", model.BillingRequest{PlanID: "hotspot-annuel", Months: 12}, "1 an"},
	}
	for _, c := range cas {
		if got := periodLabelOfRequest(c.br); got != c.want {
			t.Errorf("%s : periodLabelOfRequest = %q, attendu %q", c.nom, got, c.want)
		}
	}
}

// TestSubscriptionPostMonths — la DEMANDE client porte la durée (N°350) :
// grille 1·2·3·6·12 sur la formule mensuelle uniquement, tarif linéaire
// (base = prix × routeurs × mois, frais sur LA transaction), réponse et
// stockage cohérents, appariement par durée (réutilisation/remplacement).
func TestSubscriptionPostMonths(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	tok, accID, _ := registerAccount(t, ts, "mois-350", "")

	// Grille client : 6 mois, compte sans routeur → assiette minimum 1
	// routeur → base = 2 500 × 1 × 6 = 15 000 F (tarif linéaire).
	code, out := doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 6})
	if code != http.StatusOK {
		t.Fatalf("demande 6 mois : code %d, corps %v", code, out)
	}
	if base, _ := out["baseAmountFcfa"].(float64); int(base) != 15000 {
		t.Fatalf("base 6 mois = %v, attendu 15000 (2 500 × 1 routeur × 6 mois — tarif linéaire)", out["baseAmountFcfa"])
	}
	if lbl, _ := out["periodLabel"].(string); lbl != "6 mois" {
		t.Fatalf("periodLabel = %q, attendu « 6 mois »", lbl)
	}
	if m, _ := out["months"].(float64); int(m) != 6 {
		t.Fatalf("months renvoyé = %v, attendu 6", out["months"])
	}
	ref6, _ := out["ref"].(string)
	if ref6 == "" {
		t.Fatal("référence absente de la réponse")
	}

	// Stockage : la demande en attente porte la durée, la base et le montant
	// Wave (frais gross-up + remise sur LA transaction de 6 mois).
	st.Lock()
	var stored *model.BillingRequest
	pending := 0
	for i := range st.Data().BillingRequests {
		br := &st.Data().BillingRequests[i]
		if br.AccountID == accID {
			pending++
			stored = br
		}
	}
	if pending != 1 || stored == nil {
		st.Unlock()
		t.Fatalf("une seule demande en attente attendue, obtenu %d", pending)
	}
	if stored.Months != 6 || stored.BaseAmountFcfa != 15000 || stored.PeriodLabel != "6 mois" {
		st.Unlock()
		t.Fatalf("demande stockée = %+v (months=6, base=15000, « 6 mois » attendus)", *stored)
	}
	if stored.AmountFcfa != wavePriceOfRequest(*stored) {
		st.Unlock()
		t.Fatalf("montant demandé = %d, attendu le montant Wave %d", stored.AmountFcfa, wavePriceOfRequest(*stored))
	}
	st.Unlock()

	// Ré-utilisation : la MÊME durée réutilise la demande (même référence).
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 6})
	if code != http.StatusOK {
		t.Fatalf("re-demande 6 mois : code %d, corps %v", code, out)
	}
	if ref2, _ := out["ref"].(string); ref2 != ref6 {
		t.Fatalf("re-demande 6 mois : réf %q ≠ %q (la demande identique doit être réutilisée)", ref2, ref6)
	}

	// Changement de durée : 3 mois → l'ancienne demande est REMPLACÉE
	// (annulée), une nouvelle référence est posée.
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 3})
	if code != http.StatusOK {
		t.Fatalf("demande 3 mois : code %d, corps %v", code, out)
	}
	ref3, _ := out["ref"].(string)
	if ref3 == "" || ref3 == ref6 {
		t.Fatalf("réf 3 mois = %q : une nouvelle référence était attendue (remplacement)", ref3)
	}
	if base, _ := out["baseAmountFcfa"].(float64); int(base) != 7500 {
		t.Fatalf("base 3 mois = %v, attendu 7500", out["baseAmountFcfa"])
	}
	st.Lock()
	states := map[string]string{}
	for _, br := range st.Data().BillingRequests {
		if br.AccountID == accID {
			states[br.Ref] = br.Status
		}
	}
	st.Unlock()
	if states[ref6] != "cancelled" || states[ref3] != "pending" {
		t.Fatalf("états des demandes = %v (ancienne cancellée, nouvelle pending attendues)", states)
	}

	// Grille : 1·2·3·6·12 acceptés.
	for _, m := range []int{1, 2, 3, 6, 12} {
		code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
			map[string]any{"planId": "hotspot-mensuel", "months": m})
		if code != http.StatusOK {
			t.Fatalf("demande %d mois : code %d, corps %v", m, code, out)
		}
		if base, _ := out["baseAmountFcfa"].(float64); int(base) != 2500*m {
			t.Fatalf("base %d mois = %v, attendu %d", m, out["baseAmountFcfa"], 2500*m)
		}
		wantLbl := "1 mois"
		if m > 1 {
			wantLbl = strconv.Itoa(m) + " mois"
		}
		if lbl, _ := out["periodLabel"].(string); lbl != wantLbl {
			t.Fatalf("periodLabel %d mois = %q, attendu %q", m, lbl, wantLbl)
		}
	}

	// Hors grille (5, 13, 99) → 400 bad_duration.
	for _, m := range []int{5, 13, 99} {
		code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
			map[string]any{"planId": "hotspot-mensuel", "months": m})
		if code != http.StatusBadRequest {
			t.Fatalf("demande %d mois : code %d, attendu 400 (hors grille)", m, code)
		}
		if ec, _ := out["code"].(string); ec != "bad_duration" {
			t.Fatalf("demande %d mois : code erreur = %q, attendu bad_duration", m, ec)
		}
	}

	// Absent / 0 / négatif → défaut 1 mois (compat frontends antérieurs).
	for _, m := range []int{0, -3} {
		code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
			map[string]any{"planId": "hotspot-mensuel", "months": m})
		if code != http.StatusOK {
			t.Fatalf("demande months=%d : code %d, attendu 200 (défaut 1 mois)", m, code)
		}
		if lbl, _ := out["periodLabel"].(string); lbl != "1 mois" {
			t.Fatalf("demande months=%d : periodLabel %q (1 mois attendu)", m, lbl)
		}
		if base, _ := out["baseAmountFcfa"].(float64); int(base) != 2500 {
			t.Fatalf("demande months=%d : base %v (2500 F attendus)", m, out["baseAmountFcfa"])
		}
	}
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel"})
	if code != http.StatusOK {
		t.Fatalf("demande sans months : code %d, attendu 200 (compat)", code)
	}
	if lbl, _ := out["periodLabel"].(string); lbl != "1 mois" {
		t.Fatalf("demande sans months : periodLabel %q (1 mois attendu)", lbl)
	}

	// Formule ANNUELLE : la durée ne s'applique pas (1 an inchangé) ;
	// months=6 → 400 bad_duration ; months=1/absent → « 1 an ».
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-annuel", "months": 6})
	if code != http.StatusBadRequest {
		t.Fatalf("annuel + months=6 : code %d, attendu 400", code)
	}
	if ec, _ := out["code"].(string); ec != "bad_duration" {
		t.Fatalf("annuel + months=6 : code erreur = %q, attendu bad_duration", ec)
	}
	code, out = doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-annuel", "months": 1})
	if code != http.StatusOK {
		t.Fatalf("annuel + months=1 : code %d, attendu 200", code)
	}
	if lbl, _ := out["periodLabel"].(string); lbl != "1 an" {
		t.Fatalf("annuel + months=1 : periodLabel %q (« 1 an » attendu)", lbl)
	}
}

// TestWaveWebhookActivatesChosenMonths — le paiement Wave d'une demande de
// 6 mois ACTIVE exactement 6 mois (empilement AddDate) au montant linéaire,
// et le webhook rejoué reste idempotent (période inchangée).
func TestWaveWebhookActivatesChosenMonths(t *testing.T) {
	t.Setenv("WAVE_WEBHOOK_SECRET", "wave-secret-350")
	_, ts := newTestServerWithStore(t)
	tok, _, _ := registerAccount(t, ts, "mois-webhook-350", "")

	// Demande de 6 mois (assiette 1 routeur — base 15 000 F).
	code, out := doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 6})
	if code != http.StatusOK {
		t.Fatalf("demande 6 mois : code %d, corps %v", code, out)
	}
	ref, _ := out["ref"].(string)
	amount, _ := out["amountFcfa"].(float64)
	if ref == "" || amount <= 0 {
		t.Fatalf("réf/montant absents : %v", out)
	}

	// Webhook de succès (Bearer secret, montant exact de la demande).
	code, out = doJSON(t, ts, "POST", "/api/webhooks/wave", "wave-secret-350",
		map[string]any{"ref": ref, "amount": amount, "status": "paid"})
	if code != http.StatusOK {
		t.Fatalf("webhook Wave : code %d, corps %v", code, out)
	}

	// Vérification : période EXACTEMENT 6 mois, montant 2 500 × 1 × 6.
	code, out = doJSON(t, ts, "GET", "/api/subscription", tok, nil)
	if code != http.StatusOK {
		t.Fatalf("état abonnement : code %d, corps %v", code, out)
	}
	sub, _ := out["subscription"].(map[string]any)
	if sub == nil || sub["planId"] != "hotspot-mensuel" {
		t.Fatalf("souscription non activée : %v", sub)
	}
	if out["status"] != "active" {
		t.Fatalf("statut = %v, attendu active", out["status"])
	}
	startISO, _ := sub["periodStart"].(string)
	endISO, _ := sub["periodEnd"].(string)
	start, e1 := time.Parse(time.RFC3339, startISO)
	end, e2 := time.Parse(time.RFC3339, endISO)
	if e1 != nil || e2 != nil {
		t.Fatalf("périodes illisibles : %q / %q", startISO, endISO)
	}
	// AddDate(0, 6, 0) exact (tolérance 2 s — troncature RFC3339).
	if d := end.Sub(start.AddDate(0, 6, 0)); d < -2*time.Second || d > 2*time.Second {
		t.Fatalf("période activée = %v → écart %v avec 6 mois AddDate attendu", end.Sub(start), d)
	}
	if last, _ := sub["lastAmountFcfa"].(float64); int(last) != 15000 {
		t.Fatalf("montant appliqué = %v, attendu 15000 (2 500 × 1 × 6)", sub["lastAmountFcfa"])
	}

	// Webhook REJOUÉ : idempotent — la période ne s'empile pas.
	code, out = doJSON(t, ts, "POST", "/api/webhooks/wave", "wave-secret-350",
		map[string]any{"ref": ref, "amount": amount, "status": "paid"})
	if code != http.StatusOK {
		t.Fatalf("webhook rejoué : code %d, corps %v", code, out)
	}
	if idem, _ := out["idempotent"].(bool); !idem {
		t.Fatalf("webhook rejoué : idempotent = %v, attendu true", out["idempotent"])
	}
	code, out = doJSON(t, ts, "GET", "/api/subscription", tok, nil)
	sub2, _ := out["subscription"].(map[string]any)
	if sub2["periodEnd"] != sub["periodEnd"] {
		t.Fatalf("webhook rejoué : periodEnd a bougé (%v → %v) — la période ne doit PAS s'empiler",
			sub["periodEnd"], sub2["periodEnd"])
	}
}
