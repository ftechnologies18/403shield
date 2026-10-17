package api

// Tests N°98 → N°324 — MONO-MODE Hotspot (retraite du mode HomeNet) :
//   - contrat d'inscription publique : le champ usage est IGNORÉ (tout
//     compte naît hotspot, essai unique 60 jours — un vieux frontend qui
//     envoie encore « homenet » est silencieusement normalisé, jamais de
//     400 pendant la fenêtre de déploiement) ;
//   - la session transporte l'usage (toujours « hotspot ») : login,
//     register, /api/auth/me ;
//   - la garde requireUsage reste en place (défense en profondeur) mais
//     normalizeAccountUsage rabat TOUT compte vers hotspot : un état
//     léger « homenet » injecté en base (pré-migration, jamais converti)
//     lit hotspot — ses appels produit passent, plus de 404 wrong_usage ;
//   - exemption plateforme : la session support (impersonation d'un
//     compte léger homenet par l'admin) passe partout ;
//   - N°324 : la bascule admin PUT /api/admin/accounts/{id}/usage est
//     SUPPRIMÉE avec le mode — le mux répond 404 route inconnue ;
//   - normalisation : un compte sans usage (ère pré-colonne) est lu comme
//     hotspot, au store (Reload → migrateMultiTenant) comme à la garde
//     (repli défensif sans rechargement).

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
)

// uniquePhone — S5 dédoublonne email/WhatsApp : chaque inscription de test
// porte un numéro distinct (compteur global, 10 chiffres).
var uniquePhoneCounter atomic.Int64

func uniquePhone() string {
	return fmt.Sprintf("070707%04d", uniquePhoneCounter.Add(1))
}

// registerUsageBody — corps d'inscription publique avec usage EXPLICITE
// (le helper registerAccount teste déjà le contrat « champ absent »).
// N°324 : le champ est ignoré par le serveur — le helper sert précisément
// à vérifier cette neutralité (vieux frontend « homenet », valeur libre).
func registerUsageBody(username, usage string) map[string]string {
	body := map[string]string{
		"name":     "Gérant " + username,
		"username": username,
		"password": "mot-de-passe-8+",
		"email":    username + "@example.ci",
		"phone":    uniquePhone(),
		"country":  "CI",
		"city":     "Abidjan",
	}
	if usage != "" {
		body["usage"] = usage
	}
	return body
}

// TestRegisterUsageMonoMode — N°324 : l'inscription publique est mono-mode.
// Champ absent → compte hotspot (les clients existants ne changent pas d'un
// octet) ; champ « homenet » envoyé par un vieux frontend → 201 compte
// HOTSPOT (le champ est ignoré, la réponse transporte usage=hotspot et
// l'essai unique de 60 jours) ; valeur inconnue → 201 hotspot AUSSI (plus
// aucune validation : seul l'admin refuse les valeurs inconnues).
func TestRegisterUsageMonoMode(t *testing.T) {
	ts := newTestServer(t)

	// Champ absent → 201, compte hotspot.
	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", registerUsageBody("usage-absent", ""))
	if status != http.StatusCreated {
		t.Fatalf("inscription sans usage : statut %d, corps %v", status, out)
	}
	user, _ := out["user"].(map[string]any)
	if user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("usage par défaut = %v, attendu %q", user["usage"], model.AccountUsageHotspot)
	}

	// N°324 — « homenet » (vieux frontend) → 201 compte HOTSPOT : le champ
	// est silencieusement normalisé, l'inscription ne casse jamais.
	status, out = doJSON(t, ts, "POST", "/api/auth/register", "", registerUsageBody("usage-hn", model.AccountUsageHomeNet))
	if status != http.StatusCreated {
		t.Fatalf("inscription homenet : statut %d, attendu 201 (champ ignoré — N°324)", status)
	}
	user, _ = out["user"].(map[string]any)
	if user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("usage renvoyé = %v, attendu %q (mono-mode)", user["usage"], model.AccountUsageHotspot)
	}
	tok, _ := out["token"].(string)

	// Essai UNIQUE de 60 jours (l'essai segmenté 30 j foyer est retiré
	// avec le mode — même envoyé « homenet », même durée).
	status, sub := doJSON(t, ts, "GET", "/api/subscription", tok, nil)
	if status != http.StatusOK {
		t.Fatalf("GET /api/subscription : statut %d", status)
	}
	s, _ := sub["subscription"].(map[string]any)
	start, _ := s["periodStart"].(string)
	end, _ := s["periodEnd"].(string)
	t0, e0 := time.Parse(time.RFC3339, start)
	t1, e1 := time.Parse(time.RFC3339, end)
	if e0 != nil || e1 != nil {
		t.Fatalf("période d'essai illisible : %q → %q (%v / %v)", start, end, e0, e1)
	}
	if days := t1.Sub(t0).Hours() / 24; days < 59 || days > 61 {
		t.Fatalf("essai = %.1f jours, attendu 60 (essai unique mono-mode)", days)
	}

	// Valeur inconnue (« cybercafe ») → 201 hotspot : le champ n'est plus
	// validé côté public (cf. TestAdminCreateUsageValidation pour le
	// refus côté console plateforme).
	status, out = doJSON(t, ts, "POST", "/api/auth/register", "", registerUsageBody("usage-x", "cybercafe"))
	if status != http.StatusCreated {
		t.Fatalf("usage inconnu : statut %d, attendu 201 (champ ignoré — N°324)", status)
	}
	if user, _ = out["user"].(map[string]any); user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("usage inconnu : usage renvoyé = %v, attendu %q", user["usage"], model.AccountUsageHotspot)
	}
}

// TestLoginMeCarryUsage — l'usage voyage dans la session : register, login
// ET /api/auth/me renvoient la même clé « usage » (la coquille lira
// toujours « hotspot » — N°324 mono-mode).
func TestLoginMeCarryUsage(t *testing.T) {
	ts := newTestServer(t)

	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", registerUsageBody("session-usage", ""))
	if status != http.StatusCreated {
		t.Fatalf("inscription : statut %d, corps %v", status, out)
	}
	user, _ := out["user"].(map[string]any)
	if user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("register : usage = %v, attendu %q", user["usage"], model.AccountUsageHotspot)
	}

	status, out = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{
		"username": "session-usage",
		"password": "mot-de-passe-8+",
	})
	if status != http.StatusOK {
		t.Fatalf("login : statut %d, corps %v", status, out)
	}
	token, _ := out["token"].(string)
	user, _ = out["user"].(map[string]any)
	if user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("login : usage = %v, attendu %q", user["usage"], model.AccountUsageHotspot)
	}

	status, out = doJSON(t, ts, "GET", "/api/auth/me", token, nil)
	if status != http.StatusOK {
		t.Fatalf("me : statut %d", status)
	}
	user, _ = out["user"].(map[string]any)
	if user["usage"] != model.AccountUsageHotspot {
		t.Fatalf("me : usage = %v, attendu %q", user["usage"], model.AccountUsageHotspot)
	}
}

// adminLogin — token de l'admin plateforme bootstrappé par ADMIN_PASSWORD
// (username « admin » — cf. applyAdminOverride).
func adminLogin(t *testing.T, ts *httptest.Server) string {
	t.Helper()
	status, out := doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{
		"username": "admin",
		"password": "admin-test-1234",
	})
	if status != http.StatusOK {
		t.Fatalf("login admin : statut %d, corps %v", status, out)
	}
	token, _ := out["token"].(string)
	return token
}

// createAdminAccount — POST /api/admin/accounts avec un usage donné ;
// retourne (accountID, token du owner créé). Vérifie AUSSI que le login du
// owner transporte l'usage demandé. N°324 : seul « hotspot » (ou vide) est
// accepté — les tests qui créent des comptes légers « homenet » les posent
// DIRECTEMENT au store (cf. TestUsageGuardNormalizesLegacyHomeNet).
func createAdminAccount(t *testing.T, ts *httptest.Server, adminToken, username, usage string) (string, string) {
	t.Helper()
	body := map[string]string{
		"name":     "Compte " + username,
		"username": username,
		"password": "mot-de-passe-8+",
		"email":    username + "@example.ci",
		"phone":    uniquePhone(),
		"country":  "CI",
		"city":     "Abidjan",
	}
	if usage != "" {
		body["usage"] = usage
	}
	status, out := doJSON(t, ts, "POST", "/api/admin/accounts", adminToken, body)
	if status != http.StatusCreated {
		t.Fatalf("création admin %s (usage=%s) : statut %d, corps %v", username, usage, status, out)
	}
	acc, _ := out["account"].(map[string]any)
	accID, _ := acc["id"].(string)

	// Usage inconnu → refusé côté création admin aussi.
	status, out = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{
		"username": username,
		"password": "mot-de-passe-8+",
	})
	if status != http.StatusOK {
		t.Fatalf("login du owner %s : statut %d, corps %v", username, status, out)
	}
	token, _ := out["token"].(string)
	user, _ := out["user"].(map[string]any)
	want := usage
	if want == "" {
		want = model.AccountUsageHotspot
	}
	if user["usage"] != want {
		t.Fatalf("login du owner %s : usage = %v, attendu %q", username, user["usage"], want)
	}
	return accID, token
}

// TestAdminCreateUsageValidation — la création plateforme valide l'usage :
// N°324 — valeur inconnue ET « homenet » → 400 (mode foyer retiré) ; champ
// absent → hotspot (défaut historique).
func TestAdminCreateUsageValidation(t *testing.T) {
	ts := newTestServer(t)
	adminToken := adminLogin(t, ts)

	// Valeur inconnue → 400.
	body := map[string]string{
		"name":     "Compte bizarre",
		"username": "compte-bizarre",
		"password": "mot-de-passe-8+",
		"email":    "bizarre@example.ci",
		"phone":    uniquePhone(),
		"country":  "CI",
		"usage":    "cybercafe",
	}
	if status, out := doJSON(t, ts, "POST", "/api/admin/accounts", adminToken, body); status != http.StatusBadRequest {
		t.Fatalf("création admin usage inconnu : statut %d, attendu 400, corps %v", status, out)
	}

	// N°324 — « homenet » → 400 : le mode foyer est retiré du système.
	body = map[string]string{
		"name":     "Compte foyer",
		"username": "compte-foyer",
		"password": "mot-de-passe-8+",
		"email":    "foyer@example.ci",
		"phone":    uniquePhone(),
		"country":  "CI",
		"usage":    model.AccountUsageHomeNet,
	}
	if status, out := doJSON(t, ts, "POST", "/api/admin/accounts", adminToken, body); status != http.StatusBadRequest {
		t.Fatalf("création admin usage homenet : statut %d, attendu 400 (mode retiré — N°324), corps %v", status, out)
	}

	// Champ absent → défaut hotspot.
	accID, ownerToken := createAdminAccount(t, ts, adminToken, "compte-sans-usage", "")
	if status, _ := doJSON(t, ts, "GET", "/api/vouchers", ownerToken, nil); status != http.StatusOK {
		t.Fatalf("compte sans usage : GET /api/vouchers statut %d, attendu 200 (défaut hotspot)", status)
	}
	_ = accID
}

// TestUsageGuardNormalizesLegacyHomeNet — N°324 : un compte « homenet » posé
// DIRECTEMENT en base (état léger de test) est LU hotspot par
// normalizeAccountUsage — ses appels produit hotspot passent 200 (plus de
// 404 wrong_usage), les familles partagées restent ouvertes — même token,
// zéro re-login.
func TestUsageGuardNormalizesLegacyHomeNet(t *testing.T) {
	st, ts := newTestServerWithStore(t)

	// 1) Compte homenet léger injecté APRÈS le boot (jamais passé par
	// migrateHomeNetRetirement).
	st.Lock()
	st.Data().Accounts = append(st.Data().Accounts, model.Account{
		ID: "acc-maison", Name: "Maison Légacy", Status: "active",
		CreatedAt: model.NowISO(), Usage: model.AccountUsageHomeNet,
	})
	st.Unlock()
	seedUser(t, st, "usr-maison", "acc-maison", "gerant-maison", model.RoleOwner)
	token := auth.Sign(testJWTSecret, auth.NewClaims("usr-maison", "gerant-maison", model.RoleOwner, "acc-maison", 0))

	// Endpoints PRODUIT hotspot : 200 — la garde relit l'usage à CHAQUE
	// requête et normalizeAccountUsage rabat « homenet » sur « hotspot ».
	produit := []struct {
		label string
		path  string
	}{
		{"vouchers", "/api/vouchers"},
		{"profils", "/api/profiles"},
		{"utilisateurs hotspot", "/api/users"},
		{"revendeurs", "/api/resellers"},
		{"modèles", "/api/templates"},
		{"transactions", "/api/transactions"},
		{"rapports", "/api/reports"},
		{"WiFi jetable (sites)", "/api/wifi/sites"},
		{"inscriptions publiques", "/api/registrations"},
		{"journaux utilisateurs", "/api/user-logs"},
	}
	for _, tc := range produit {
		if status, _ := doJSON(t, ts, "GET", tc.path, token, nil); status != http.StatusOK {
			t.Fatalf("%s : statut %d, attendu 200 (compte léger lu hotspot — N°324)", tc.label, status)
		}
	}

	// Familles partagées : ouvertes comme avant (même token).
	ouvert := []struct {
		label string
		path  string
	}{
		{"dashboard (partagé)", "/api/dashboard"},
		{"routeurs (partagé)", "/api/routers"},
		{"sessions (partagé)", "/api/sessions"},
		{"réglages (partagé)", "/api/settings"},
		{"me (partagé)", "/api/auth/me"},
	}
	for _, tc := range ouvert {
		if status, _ := doJSON(t, ts, "GET", tc.path, token, nil); status != http.StatusOK {
			t.Fatalf("%s : statut %d, attendu 200 (familles partagées)", tc.label, status)
		}
	}
}

// TestUsageGuardExemptsPlatformAdmin — la session support (impersonation)
// passe la garde : l'opérateur du SaaS debug un compte homenet LÉGACY (posé
// directement en base) sans être coupé de la console produit (même choix
// que guardAccountWrite : le garde sépare les CLIENTS, pas l'opérateur).
func TestUsageGuardExemptsPlatformAdmin(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	adminToken := adminLogin(t, ts)

	// Compte homenet léger injecté après le boot (N°324 : plus aucune
	// voie de création ne produit « homenet » — cf. la migration de
	// retraite côté store).
	st.Lock()
	st.Data().Accounts = append(st.Data().Accounts, model.Account{
		ID: "acc-maison-support", Name: "Maison Support", Status: "active",
		CreatedAt: model.NowISO(), Usage: model.AccountUsageHomeNet,
	})
	st.Save()
	st.Unlock()

	status, out := doJSON(t, ts, "POST", "/api/admin/accounts/acc-maison-support/impersonate", adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("impersonation : statut %d, corps %v", status, out)
	}
	supportToken, _ := out["token"].(string)
	if supportToken == "" {
		t.Fatal("impersonation : token manquant")
	}
	if status, _ := doJSON(t, ts, "GET", "/api/vouchers", supportToken, nil); status != http.StatusOK {
		t.Fatalf("session support sur compte homenet léger : GET /api/vouchers statut %d, attendu 200 (exemption plateforme)", status)
	}
}

// TestAdminAccountUsageRouteRemoved — N°324 : la bascule d'usage
// (PUT /api/admin/accounts/{id}/usage, N°98) est SUPPRIMÉE avec le mode
// foyer. Le mux Go 1.22 répond 404 route inconnue — SANS corps JSON
// spécifique (ni wrong_usage ni validation : la route n'existe plus du
// tout) — pour l'admin plateforme comme pour un client.
func TestAdminAccountUsageRouteRemoved(t *testing.T) {
	ts := newTestServer(t)
	adminToken := adminLogin(t, ts)
	_, ownerToken := createAdminAccount(t, ts, adminToken, "compte-sans-bascule", "")

	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/acc-fantome/usage", adminToken, map[string]string{"usage": model.AccountUsageHotspot}); status != http.StatusNotFound {
		t.Fatalf("PUT usage (admin) : statut %d, attendu 404 (route supprimée — N°324)", status)
	}
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/acc-fantome/usage", ownerToken, map[string]string{"usage": model.AccountUsageHotspot}); status != http.StatusNotFound {
		t.Fatalf("PUT usage (client) : statut %d, attendu 404 (route supprimée — N°324)", status)
	}
}

// TestAccountUsageNormalization — un compte de l'ère pré-colonne (usage
// vide) est lu comme HOTSPOT : (1) repli défensif de la garde sur un état
// injecté SANS rechargement ; (2) normalisation du store au Reload
// (migrateMultiTenant — la valeur est persistée au Save suivant).
func TestAccountUsageNormalization(t *testing.T) {
	st, ts := newTestServerWithStore(t)

	// 1) Repli défensif de la garde : compte usage vide injecté APRÈS le
	// boot (jamais passé par migrateMultiTenant).
	st.Lock()
	st.Data().Accounts = append(st.Data().Accounts, model.Account{
		ID: "acc-vide", Name: "Pré-colonne", Status: "active",
		CreatedAt: model.NowISO(), Usage: "",
	})
	st.Unlock()
	seedUser(t, st, "usr-vide", "acc-vide", "vieux-compte", model.RoleOwner)
	token := auth.Sign(testJWTSecret, auth.NewClaims("usr-vide", "vieux-compte", model.RoleOwner, "acc-vide", 0))
	if status, _ := doJSON(t, ts, "GET", "/api/vouchers", token, nil); status != http.StatusOK {
		t.Fatalf("compte pré-colonne (usage vide) : GET /api/vouchers statut %d, attendu 200 (repli hotspot)", status)
	}

	// 2) Normalisation du store : compte usage vide PERSISTÉ, puis Reload
	// → migrateMultiTenant pose « hotspot » (et le diff PG le persistrait
	// au Save suivant — ici mode JSON).
	st.Lock()
	st.Data().Accounts = append(st.Data().Accounts, model.Account{
		ID: "acc-vide2", Name: "Pré-colonne 2", Status: "active",
		CreatedAt: model.NowISO(), Usage: "",
	})
	st.Save()
	st.Unlock()
	if _, err := st.Reload(); err != nil {
		t.Fatalf("Reload impossible : %v", err)
	}
	st.Lock()
	normalized := "(introuvable)"
	for i := range st.Data().Accounts {
		if st.Data().Accounts[i].ID == "acc-vide2" {
			normalized = st.Data().Accounts[i].Usage
			break
		}
	}
	st.Unlock()
	if normalized != model.AccountUsageHotspot {
		t.Fatalf("normalisation store : usage = %q, attendu %q", normalized, model.AccountUsageHotspot)
	}
}

// TestUsageGuardHelpers — unitaires purs des helpers : normalizeAccountUsage
// rabat TOUT vers hotspot (N°324 — mono-mode, y compris le léger « homenet »
// résiduel) ; accountUsageLocked (compte inconnu → hotspot défensif).
func TestUsageGuardHelpers(t *testing.T) {
	for _, u := range []string{"", "nimporte-quoi", model.AccountUsageHotspot, model.AccountUsageHomeNet} {
		if normalizeAccountUsage(u) != model.AccountUsageHotspot {
			t.Fatalf("normalizeAccountUsage(%q) = %q, attendu %q (rabat tout — mono-mode N°324)",
				u, normalizeAccountUsage(u), model.AccountUsageHotspot)
		}
	}
	db := &model.DB{
		Accounts: []model.Account{
			{ID: "acc-a", Usage: model.AccountUsageHomeNet}, // léger pré-migration
			{ID: "acc-b", Usage: ""},                        // ère pré-colonne
		},
	}
	if got := accountUsageLocked(db, "acc-a"); got != model.AccountUsageHotspot {
		t.Fatalf("accountUsageLocked(acc-a) = %q, attendu %q (compte homenet léger lu hotspot)", got, model.AccountUsageHotspot)
	}
	if got := accountUsageLocked(db, "acc-b"); got != model.AccountUsageHotspot {
		t.Fatalf("accountUsageLocked(acc-b) = %q, attendu %q (usage vide)", got, model.AccountUsageHotspot)
	}
	if got := accountUsageLocked(db, "acc-inconnu"); got != model.AccountUsageHotspot {
		t.Fatalf("accountUsageLocked(inconnu) = %q, attendu %q (défensif)", got, model.AccountUsageHotspot)
	}
}
