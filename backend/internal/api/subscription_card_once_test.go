// Tests N°351 — la durée choisie (1·2·3·4·6·8·12 mois, formule mensuelle)
// s'applique AUSSI au paiement CARTE (Stripe via GeniusPay) :
//   - validation serveur du corps POST /api/subscription/stripe : grille et
//     verrou annuel AVANT la vérification des clés GeniusPay (400 propres,
//     sans réseau) ;
//   - branche PONCTUELLE (months > 1) : appariement PAR durée (réutilisation
//     d'une demande Wave identique basculée carte au prix de liste ;
//     remplacement d'une autre durée), AUCUNE fiche récurrente GeniusPaySub ;
//   - chaîne d'activation : le webhook payment.success SIGNÉ d'une demande
//     multi-mois payée au PRIX DE LISTE active exactement N mois
//     (finalizeBillingSuccess → monthsOfRequest), idempotence du rejoué.
//
// Le réseau GeniusPay n'est jamais joint : sans clés (environnement de test),
// geniusPayCall échoue immédiatement — la branche ponctuelle est appelée
// directement sur l'API de test (l'initiation /payments est simplement
// absente de la réponse, la demande reste réglable).
package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// TestStripePostMonthsValidation — la durée du corps carte est validée comme
// côté Wave : grille 1·2·3·4·6·8·12 sur la formule MENSUELLE uniquement,
// AVANT la vérification des clés (un 400 propre ne dépend pas de GeniusPay) ;
// une demande valide sans clés reste 503 geniuspay_disabled (défaut 1 mois,
// compat paywall — aucune fiche créée).
func TestStripePostMonthsValidation(t *testing.T) {
	// Clés absentes de l'environnement de test : validation d'abord, réseau
	// jamais atteint (le 503 prouve que la durée valide passe la validation).
	t.Setenv("GENIUSPAY_API_KEY", "")
	t.Setenv("GENIUSPAY_API_SECRET", "")
	_, ts := newTestServerWithStore(t)
	tok, _, _ := registerAccount(t, ts, "mois-carte-val-351", "")

	// Hors grille (5, 7, 13) → 400 bad_duration (avant toute clé/réseau).
	for _, m := range []int{5, 7, 13} {
		code, out := doJSON(t, ts, "POST", "/api/subscription/stripe", tok,
			map[string]any{"planId": "hotspot-mensuel", "months": m})
		if code != http.StatusBadRequest {
			t.Fatalf("carte %d mois : code %d, attendu 400 (hors grille)", m, code)
		}
		if ec, _ := out["code"].(string); ec != "bad_duration" {
			t.Fatalf("carte %d mois : code erreur = %q, attendu bad_duration", m, ec)
		}
	}

	// Formule ANNUELLE verrouillée : months > 1 → 400 bad_duration.
	code, out := doJSON(t, ts, "POST", "/api/subscription/stripe", tok,
		map[string]any{"planId": "hotspot-annuel", "months": 6})
	if code != http.StatusBadRequest {
		t.Fatalf("annuel + months=6 : code %d, attendu 400", code)
	}
	if ec, _ := out["code"].(string); ec != "bad_duration" {
		t.Fatalf("annuel + months=6 : code erreur = %q, attendu bad_duration", ec)
	}

	// Durées VALIDES (grille élargie 4 et 8 compris) sans clés GeniusPay →
	// 503 geniuspay_disabled : la validation est passée, l'initiation seule
	// manque — aucun effet de bord (pas de fiche, pas de demande).
	for _, m := range []int{1, 4, 8} {
		code, out = doJSON(t, ts, "POST", "/api/subscription/stripe", tok,
			map[string]any{"planId": "hotspot-mensuel", "months": m})
		if code != http.StatusServiceUnavailable {
			t.Fatalf("carte %d mois sans clés : code %d, attendu 503", m, code)
		}
		if ec, _ := out["code"].(string); ec != "geniuspay_disabled" {
			t.Fatalf("carte %d mois sans clés : code erreur = %q, attendu geniuspay_disabled", m, ec)
		}
	}

	// Corps sans months (paywall / frontends antérieurs) → défaut 1 mois,
	// même 503 (le flux récurrent est inchangé).
	code, out = doJSON(t, ts, "POST", "/api/subscription/stripe", tok,
		map[string]any{"planId": "hotspot-mensuel"})
	if code != http.StatusServiceUnavailable {
		t.Fatalf("carte sans months sans clés : code %d, attendu 503", code)
	}
}

// TestStripeOnceRequestMatching — la branche PONCTUELLE (months > 1) pose la
// demande aux règles de POST /api/subscription : RÉUTILISATION d'une demande
// IDENTIQUE en attente (même formule, même base, même durée — bascule carte
// au prix de liste, même référence) et REMPLACEMENT d'une autre durée ; la
// réponse porte cycle « once » et le montant liste de LA transaction N mois ;
// AUCUNE fiche GeniusPaySub (récurrence) n'est créée.
func TestStripeOnceRequestMatching(t *testing.T) {
	t.Setenv("GENIUSPAY_API_KEY", "")
	t.Setenv("GENIUSPAY_API_SECRET", "")
	st, ts := newTestServerWithStore(t)
	tok, accID, _ := registerAccount(t, ts, "mois-carte-351", "")
	a := New(st, testJWTSecret)

	// 1. Demande Wave de 6 mois (assiette 1 routeur — base 15 000 F).
	code, out := doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 6})
	if code != http.StatusOK {
		t.Fatalf("demande Wave 6 mois : code %d, corps %v", code, out)
	}
	refWave, _ := out["ref"].(string)
	base6 := 2500 * 6
	if b, _ := out["baseAmountFcfa"].(float64); int(b) != base6 {
		t.Fatalf("base 6 mois = %v, attendu %d", out["baseAmountFcfa"], base6)
	}

	// 2. Branche ponctuelle carte 6 mois : la demande IDENTIQUE est réutilisée
	// (même référence), basculée carte au prix de liste de la même base.
	plan, ok := model.ResolvePlan("hotspot-mensuel", model.AccountUsageHotspot)
	if !ok {
		t.Fatal("formule hotspot-mensuel introuvable")
	}
	rec := httptest.NewRecorder()
	a.handleSubscriptionStripeOnce(rec, accID, "+2250707070707", "Gérant", "mois-carte-351@example.ci", plan, "hotspot-mensuel", 6, 1)
	if rec.Code != http.StatusOK {
		t.Fatalf("carte ponctuelle 6 mois : code %d, corps %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("réponse carte ponctuelle illisible : %v", err)
	}
	if resp["cycle"] != "once" {
		t.Fatalf("cycle = %v, attendu « once »", resp["cycle"])
	}
	if m, _ := resp["months"].(float64); int(m) != 6 {
		t.Fatalf("months = %v, attendu 6", resp["months"])
	}
	if lbl, _ := resp["periodLabel"].(string); lbl != "6 mois" {
		t.Fatalf("periodLabel = %q, attendu « 6 mois »", lbl)
	}
	wantList := cardListPriceFcfa(base6)
	if amt, _ := resp["amountFcfa"].(float64); int(amt) != wantList {
		t.Fatalf("amountFcfa = %v, attendu le prix de liste %d", resp["amountFcfa"], wantList)
	}
	if refOnce, _ := resp["ref"].(string); refOnce != refWave {
		t.Fatalf("réf carte = %q, attendue %q (réutilisation de la demande identique)", refOnce, refWave)
	}

	// Stockage : demande réutilisée — PayMethod carte, montant liste, Months=6.
	st.Lock()
	var stored *model.BillingRequest
	pending := 0
	for i := range st.Data().BillingRequests {
		br := &st.Data().BillingRequests[i]
		if br.AccountID == accID {
			if br.Status == "pending" {
				pending++
				stored = br
			}
		}
	}
	st.Unlock()
	if pending != 1 || stored == nil {
		t.Fatalf("une seule demande en attente attendue, obtenu %d", pending)
	}
	if stored.Ref != refWave || stored.PayMethod != "card" || stored.Months != 6 ||
		stored.AmountFcfa != wantList || stored.BaseAmountFcfa != base6 {
		t.Fatalf("demande stockée = %+v (réutilisation carte au prix de liste attendue)", *stored)
	}
	// AUCUNE fiche récurrente GeniusPaySub ne doit exister (paiement une fois).
	for _, g := range st.Data().GeniusPaySubs {
		if g.AccountID == accID {
			t.Fatalf("fiche récurrente inattendue %s — la transaction multi-mois est PONCTUELLE", g.UUID)
		}
	}

	// 3. Branche ponctuelle carte 4 mois : durée différente → la demande 6
	// mois est REMPLACÉE (annulée), une nouvelle référence est posée.
	rec = httptest.NewRecorder()
	a.handleSubscriptionStripeOnce(rec, accID, "+2250707070707", "Gérant", "mois-carte-351@example.ci", plan, "hotspot-mensuel", 4, 1)
	if rec.Code != http.StatusOK {
		t.Fatalf("carte ponctuelle 4 mois : code %d", rec.Code)
	}
	var resp4 map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp4)
	ref4, _ := resp4["ref"].(string)
	if ref4 == "" || ref4 == refWave {
		t.Fatalf("réf 4 mois = %q : une nouvelle référence était attendue (remplacement)", ref4)
	}
	base4 := 2500 * 4
	if amt, _ := resp4["amountFcfa"].(float64); int(amt) != cardListPriceFcfa(base4) {
		t.Fatalf("amountFcfa 4 mois = %v, attendu %d", resp4["amountFcfa"], cardListPriceFcfa(base4))
	}
	st.Lock()
	states := map[string]string{}
	for _, br := range st.Data().BillingRequests {
		if br.AccountID == accID {
			states[br.Ref] = br.Status
		}
	}
	st.Unlock()
	if states[refWave] != "cancelled" || states[ref4] != "pending" {
		t.Fatalf("états des demandes = %v (ancienne cancellée, nouvelle pending attendues)", states)
	}
}

// TestGeniusPayWebhookCardMultiMonth — chaîne complète d'une durée réglée par
// CARTE : une demande multi-mois basculée carte au prix de liste (état posé
// par handleSubscriptionStripeOnce), payée en ligne, est activée
// EXACTEMENT N mois par le webhook payment.success SIGNÉ (appariement
// metadata.ref + confrontation du montant liste) — et le webhook rejoué
// reste idempotent.
func TestGeniusPayWebhookCardMultiMonth(t *testing.T) {
	t.Setenv("GENIUSPAY_WEBHOOK_SECRET", "gp-secret-351")
	st, ts := newTestServerWithStore(t)
	tok, _, _ := registerAccount(t, ts, "mois-carte-webhook-351", "")

	// Demande de 8 mois (assiette 1 routeur — base 20 000 F).
	code, out := doJSON(t, ts, "POST", "/api/subscription", tok,
		map[string]any{"planId": "hotspot-mensuel", "months": 8})
	if code != http.StatusOK {
		t.Fatalf("demande 8 mois : code %d, corps %v", code, out)
	}
	ref, _ := out["ref"].(string)
	if ref == "" {
		t.Fatal("référence absente de la réponse")
	}

	// La branche carte ponctuelle (réseau coupé en test) aurait basculé la
	// demande sur le moyen carte au prix de liste : on pose cet état — c'est
	// la donnée d'entrée du webhook (moyen actif + montant attendu).
	// (Sans bascule, le webhook accepterait le montant liste dérivé de la
	// même base : la confrontation Wave ⇄ liste est générique ; on teste ici
	// le cas réel d'une initiation carte.)
	st.Lock()
	for i := range st.Data().BillingRequests {
		br := &st.Data().BillingRequests[i]
		if br.AccountID != "" && br.Ref == ref && br.Status == "pending" {
			br.PayMethod = "card"
			br.AmountFcfa = listPriceOfRequest(*br)
			br.GatewayRef = "MTX-CARD-ONCE-351"
			break
		}
	}
	st.Save()
	st.Unlock()

	// Webhook payment.success SIGNÉ (HMAC-SHA256 « <ts>.<corps> ») au montant
	// LISTE de la transaction 8 mois.
	listAmt := 0
	st.Lock()
	for _, br := range st.Data().BillingRequests {
		if br.Ref == ref {
			listAmt = br.AmountFcfa
		}
	}
	st.Unlock()
	if listAmt != cardListPriceFcfa(2500*8) {
		t.Fatalf("montant liste de la demande = %d, attendu %d", listAmt, cardListPriceFcfa(2500*8))
	}
	body := map[string]any{
		"event": "payment.success",
		"data": map[string]any{
			"reference": "MTX-CARD-ONCE-351",
			"amount":    listAmt,
			"status":    "completed",
			"metadata":  map[string]any{"ref": ref},
		},
	}
	code, out = postSignedGeniusPayWebhook(t, ts, body)
	if code != http.StatusOK {
		t.Fatalf("webhook carte 8 mois : code %d, corps %v", code, out)
	}
	if out["status"] != "done" {
		t.Fatalf("webhook carte 8 mois : statut = %v, attendu done", out["status"])
	}

	// Activation : période EXACTEMENT 8 mois, montant linéaire 2 500 × 8.
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
	if d := end.Sub(start.AddDate(0, 8, 0)); d < -2*time.Second || d > 2*time.Second {
		t.Fatalf("période activée = %v → écart %v avec 8 mois AddDate attendu", end.Sub(start), d)
	}
	if last, _ := sub["lastAmountFcfa"].(float64); int(last) != 20000 {
		t.Fatalf("montant appliqué = %v, attendu 20000 (2 500 × 1 × 8)", sub["lastAmountFcfa"])
	}

	// Demande close : done, moyen carte conservé (traçabilité + reçu).
	st.Lock()
	var done *model.BillingRequest
	for i := range st.Data().BillingRequests {
		if st.Data().BillingRequests[i].Ref == ref {
			done = &st.Data().BillingRequests[i]
		}
	}
	st.Unlock()
	if done == nil || done.Status != "done" || done.PayMethod != "card" || done.PaidVia != "geniuspay" {
		t.Fatalf("demande après webhook = %+v (done/carte/geniuspay attendus)", done)
	}

	// Webhook REJOUÉ : idempotent — la période ne s'empile pas.
	code, out = postSignedGeniusPayWebhook(t, ts, body)
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

// postSignedGeniusPayWebhook — POST /api/webhooks/geniuspay avec la signature
// HMAC-SHA256 valide (« <timestamp>.<corps> », anti-replay 5 min).
func postSignedGeniusPayWebhook(t *testing.T, ts *httptest.Server, body any) (int, map[string]any) {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encodage du webhook impossible : %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/webhooks/geniuspay", bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("requête webhook impossible : %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept-Encoding", "identity")
	tsStr := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte("gp-secret-351"))
	mac.Write([]byte(tsStr + "."))
	mac.Write(raw)
	req.Header.Set("X-Webhook-Timestamp", tsStr)
	req.Header.Set("X-Webhook-Signature", hex.EncodeToString(mac.Sum(nil)))
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("webhook : %v", err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}
