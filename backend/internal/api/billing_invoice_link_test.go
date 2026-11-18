// Tests N°352 — facture imprimable par LIEN SIGNÉ court terme : window.open
// (nouvel onglet) ne peut pas porter l'en-tête Authorization, l'ouverture de
// /api/billing/invoice/{id}?t=<jeton> s'authentifie donc par un jeton
// HMAC-SHA256 (secret du service) couvrant la PAIRE facture+compte et
// l'expiration (10 min). L'émission du lien RESTE derrière le JWT, et le
// chemin historique (en-tête Authorization) demeure inchangé.
package api

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// seedDoneInvoice — dépose une facture RÉSOLUE (status done) sur le compte.
func seedDoneInvoice(t *testing.T, st *store.Store, accID, id string, amount int, resolvedAt time.Time) {
	t.Helper()
	st.Lock()
	st.Data().BillingRequests = append(st.Data().BillingRequests, model.BillingRequest{
		ID: id, AccountID: accID, PlanID: "hotspot-mensuel", PlanName: "Hotspot Essentiel",
		AmountFcfa: amount, BaseAmountFcfa: amount, PeriodLabel: "1 mois", RouterCount: 1,
		Ref: "MC-TEST3521", Status: "done",
		CreatedAt:  resolvedAt.Add(-time.Hour).Format(time.RFC3339),
		ResolvedAt: resolvedAt.Format(time.RFC3339),
		ResolvedBy: "webhook Wave", PaidVia: "wave",
	})
	st.Save()
	st.Unlock()
}

// TestInvoiceLinkFlow — parcours complet : émission du lien derrière le JWT,
// puis ouverture de la facture SANS en-tête via ?t= (HTML imprimable avec
// numéro de facture et montant).
func TestInvoiceLinkFlow(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	tok, accID, _ := registerAccount(t, ts, "facture-352", "")
	resolved := time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC)
	seedDoneInvoice(t, st, accID, "br-352-aaa", 15000, resolved)

	// Émission : JWT du compte, facture done → 200 + jeton + expiration.
	code, out := doJSON(t, ts, "GET", "/api/billing/invoice-link/br-352-aaa", tok, nil)
	if code != http.StatusOK {
		t.Fatalf("émission du lien : code %d, corps %v", code, out)
	}
	token, _ := out["token"].(string)
	if token == "" {
		t.Fatal("le lien doit renvoyer un jeton non vide")
	}
	if exp, _ := out["expiresAt"].(string); exp == "" {
		t.Fatal("le lien doit renvoyer l'expiration (RFC3339)")
	}

	// Ouverture en nouvel onglet : AUCUN en-tête Authorization, le jeton
	// fait l'authentification — la facture HTML s'imprime avec son numéro
	// séquentiel annuel et son montant.
	code2, hdr, body := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-aaa?t="+token, "")
	if code2 != http.StatusOK {
		t.Fatalf("facture par lien signé : code %d, corps %v", code2, body)
	}
	if ct := hdr.Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Fatalf("Content-Type = %q, attendu text/html", ct)
	}
	if !strings.Contains(body, "MC-2026-0001") {
		t.Fatalf("la facture doit porter son numéro MC-2026-0001, corps : %s", body[:min(len(body), 200)])
	}
	if !strings.Contains(body, "15 000 FCFA") {
		t.Fatal("la facture doit afficher le montant 15 000 FCFA")
	}
	if !strings.Contains(body, "window.print()") {
		t.Fatal("la facture reste imprimable (bouton window.print)")
	}
}

// TestInvoiceLinkRequiresJWT — l'ÉMISSION du lien et la facture SANS jeton ni
// en-tête restent derrière le JWT (comportement inchangé) : c'est bien le
// rapport d'origine « Token d'authentification manquant ».
func TestInvoiceLinkRequiresJWT(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	_, accID, _ := registerAccount(t, ts, "facture-352-auth", "")
	seedDoneInvoice(t, st, accID, "br-352-auth", 2500, time.Now().UTC())

	// Émission sans en-tête → 401.
	code, out := doJSON(t, ts, "GET", "/api/billing/invoice-link/br-352-auth", "", nil)
	if code != http.StatusUnauthorized {
		t.Fatalf("émission sans JWT : code %d, corps %v", code, out)
	}
	if msg, _ := out["error"].(string); msg != "Token d'authentification manquant" {
		t.Fatalf("message = %q, attendu « Token d'authentification manquant »", msg)
	}

	// Facture sans jeton ni en-tête → 401 (le rapport d'origine).
	code2, out2 := doJSON(t, ts, "GET", "/api/billing/invoice/br-352-auth", "", nil)
	if code2 != http.StatusUnauthorized {
		t.Fatalf("facture sans jeton : code %d, corps %v", code2, out2)
	}
}

// TestInvoiceLinkTamperedExpired — jeton falsifié (signature modifiée,
// facture du chemin substituée) et jeton expiré : refus 401 avec la page
// d'erreur HTML lisible dans le nouvel onglet.
func TestInvoiceLinkTamperedExpired(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	_, accID, _ := registerAccount(t, ts, "facture-352-tamper", "")
	now := time.Now().UTC()
	seedDoneInvoice(t, st, accID, "br-352-t1", 2500, now)
	seedDoneInvoice(t, st, accID, "br-352-t2", 5000, now.Add(time.Minute))

	// Jeton valide pour t1, demandé sur le chemin de t2 : la signature
	// couvre la facture du chemin → refus.
	good := signInvoiceToken(testJWTSecret, "br-352-t1", accID, now.Add(invoiceLinkTTL))
	code, _, body := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-t2?t="+good, "")
	if code != http.StatusUnauthorized || !strings.Contains(body, "invalide ou expiré") {
		t.Fatalf("jeton d'une autre facture : code %d, corps %v", code, body[:min(len(body), 120)])
	}

	// Signature falsifiée (un octet hex modifié) → refus.
	bad := good[:len(good)-2] + "00"
	if bad == good {
		bad = good[:len(good)-2] + "ff"
	}
	code2, _, body2 := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-t1?t="+bad, "")
	if code2 != http.StatusUnauthorized || !strings.Contains(body2, "invalide ou expiré") {
		t.Fatalf("signature falsifiée : code %d, corps %v", code2, body2[:min(len(body2), 120)])
	}

	// Jeton expiré (signé avec une expiration passée) → refus.
	expired := signInvoiceToken(testJWTSecret, "br-352-t1", accID, now.Add(-time.Minute))
	code3, _, body3 := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-t1?t="+expired, "")
	if code3 != http.StatusUnauthorized || !strings.Contains(body3, "invalide ou expiré") {
		t.Fatalf("jeton expiré : code %d, corps %v", code3, body3[:min(len(body3), 120)])
	}

	// Jeton malformé (pas 3 parties) → refus.
	code4, _, _ := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-t1?t=pasunjeton", "")
	if code4 != http.StatusUnauthorized {
		t.Fatalf("jeton malformé : code %d", code4)
	}
}

// TestInvoiceLinkScopedToAccount — la signature couvre le COMPTE : un jeton
// forgé pour le compte A sur la facture du compte B (signature valide, paire
// facture+compte légitime côté HMAC) ne trouve AUCUNE facture de A à cet
// identifiant → 404, jamais la facture de B. Et l'émission ne délivre un
// lien QUE pour une facture done de SON compte.
func TestInvoiceLinkScopedToAccount(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	tokA, accA, _ := registerAccount(t, ts, "facture-352-scopea", "")
	// Garde anti-abus : téléphone DISTINCT pour le second compte (N°197).
	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"name": "Gérant facture-352-scopeb", "username": "facture-352-scopeb", "password": "mot-de-passe-8+",
		"email": "facture-352-scopeb@example.ci", "phone": "0707070708", "country": "CI", "city": "Abidjan",
	})
	if status != http.StatusCreated {
		t.Fatalf("inscription facture-352-scopeb : statut %d, corps %v", status, out)
	}
	tokB, _ := out["token"].(string)
	user, _ := out["user"].(map[string]any)
	accB, _ := user["accountId"].(string)
	now := time.Now().UTC()
	seedDoneInvoice(t, st, accA, "br-352-sa", 2500, now)
	seedDoneInvoice(t, st, accB, "br-352-sb", 7000, now)

	// Le compte B ne peut PAS émettre de lien pour la facture de A.
	code, out := doJSON(t, ts, "GET", "/api/billing/invoice-link/br-352-sa", tokB, nil)
	if code != http.StatusNotFound {
		t.Fatalf("émission pour la facture d'autrui : code %d, corps %v", code, out)
	}

	// Jeton (facture B, compte A) : signature valide mais le compte A n'a
	// pas cette facture → 404, la facture de B ne fuit pas.
	forged := signInvoiceToken(testJWTSecret, "br-352-sb", accA, now.Add(invoiceLinkTTL))
	code2, _, body := doRaw(t, ts, ts.URL+"/api/billing/invoice/br-352-sb?t="+forged, "")
	if code2 != http.StatusNotFound || strings.Contains(body, "7 000") {
		t.Fatalf("jeton du compte A sur facture B : code %d — la facture de B ne doit pas fuir", code2)
	}

	// L'émission refuse aussi une demande PENDING (pas encore payée) du
	// propre compte : seule une facture done est justiciable d'un lien.
	st.Lock()
	st.Data().BillingRequests = append(st.Data().BillingRequests, model.BillingRequest{
		ID: "br-352-pending", AccountID: accA, PlanID: "hotspot-mensuel", PlanName: "Hotspot Essentiel",
		AmountFcfa: 2500, PeriodLabel: "1 mois", Ref: "MC-TEST352P", Status: "pending",
		CreatedAt: now.Format(time.RFC3339),
	})
	st.Unlock()
	code3, _ := doJSON(t, ts, "GET", "/api/billing/invoice-link/br-352-pending", tokA, nil)
	if code3 != http.StatusNotFound {
		t.Fatalf("émission pour une demande pending : code %d, attendu 404", code3)
	}
}
