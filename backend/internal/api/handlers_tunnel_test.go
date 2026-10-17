// handlers_tunnel_test.go — N°313 — tests du module tunnel (Programme
// Tunnel, phase 1 : fondations de la console séparée).
//
// Couverture :
//   - POST /api/tunnel/auth/request-code : e-mail RÉEL capturé (stub
//     sendAccountEmail + dispatch observable, pattern transactional_emails_test),
//     code à 6 chiffres dans le corps, trace NotifLog kind « tunnel_code »
//     SANS le code, cooldown 60 s (429), honeypot (succès factice, zéro
//     envoi), e-mail invalide (400), relais non configuré (503) ;
//   - POST /api/tunnel/auth/verify : succès → JWT rôle « tunnel » (signature
//     vérifiée, sub = client) + client NÉ dans tunnel_clients (D-T2) ;
//     usage unique (le code meurt au succès), tentatives bornées (5 faux
//     codes → 429 + entrée détruite), code expiré/inconnu (400) ;
//   - GET /api/tunnel/me : profil + commandes B2C appariées par e-mail,
//     refus rôle console (403), session inconnue (401) ;
//   - middleware : le token « tunnel » n'atteint QUE /api/tunnel/* (403 sur
//     une route console SaaS — miroir du garde reseller) et les routes
//     d'auth restent publiques.
//
// AUCUNE connexion réseau réelle : stubs + indirections (discipline maison).
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// withClaims — pose des claims sur un contexte de requête (miroir de
// reqWithClaims, pour un rôle arbitraire — ici « tunnel »).
func withClaims(ctx context.Context, c *auth.Claims) context.Context {
	return context.WithValue(ctx, claimsCtxKey{}, c)
}

// newTunnelTest — API + store JSON éphémère (même harnais que N°312).
func newTunnelTest(t *testing.T) (*API, *store.Store) {
	t.Helper()
	t.Setenv("DATABASE_URL", "")
	t.Setenv("ADMIN_PASSWORD", "admin-test-1234")
	t.Setenv("ADMIN_USERNAME", "")
	st, err := store.New(t.TempDir())
	if err != nil {
		t.Fatalf("store.New impossible : %v", err)
	}
	return New(st, testJWTSecret), st
}

// enableTunnelEmail — relais e-mail du compte principal opérationnel (SMTP
// factice — l'envoi réel est stubbé par stubAccountEmailCapture).
func enableTunnelEmail(db *model.DB) {
	db.NotifSettings = map[string]model.NotificationSettings{
		model.AccountMainID: {AccountID: model.AccountMainID, SMTPHost: "smtp.test.local"},
	}
}

// tunnelPost — requête publique POST JSON (sans JWT — routes publiques).
func tunnelPost(target, body string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// tunnelCodeFromEmail — extrait le code à 6 chiffres du corps texte capturé.
var tunnelCodeRe = regexp.MustCompile(`\b(\d{6})\b`)

func tunnelCodeFromEmail(textBody string) string {
	if m := tunnelCodeRe.FindStringSubmatch(textBody); m != nil {
		return m[1]
	}
	return ""
}

// ---------------------------------------------------------------------------
// request-code — envoi, cooldown, honeypot, validations
// ---------------------------------------------------------------------------

func TestTunnelAuthCodeRequest(t *testing.T) {
	a, st := newTunnelTest(t)
	var calls []sentEmail
	wg := stubAccountEmailCapture(t, &calls)

	st.Lock()
	enableTunnelEmail(st.Data())
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec, tunnelPost("/api/tunnel/auth/request-code",
		`{"email":"Client@Example.COM"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("demande de code : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	wg.Wait()
	if len(calls) != 1 {
		t.Fatalf("1 e-mail attendu, %d parti(s)", len(calls))
	}
	if calls[0].to != "client@example.com" {
		t.Errorf("destinataire = %q, attendu la forme canonique minuscules", calls[0].to)
	}
	code := tunnelCodeFromEmail(calls[0].body)
	if code == "" {
		t.Fatalf("code à 6 chiffres absent du corps : %q", calls[0].body)
	}
	if !strings.Contains(calls[0].title, "MikTunnel") {
		t.Errorf("titre inattendu : %q", calls[0].title)
	}

	// Trace NotifLog : kind tunnel_code, SANS le code (le journal n'est pas
	// un coffre).
	st.Lock()
	db := st.Data()
	if len(db.NotifLog) != 1 || db.NotifLog[0].Kind != "tunnel_code" {
		t.Fatalf("trace NotifLog inattendue : %+v", db.NotifLog)
	}
	if strings.Contains(db.NotifLog[0].Body, code) {
		t.Fatalf("LE CODE NE DOIT JAMAIS VIVRE DANS LE JOURNAL : %q", db.NotifLog[0].Body)
	}
	st.Unlock()

	// Cooldown 60 s : une deuxième demande immédiate → 429, AUCUN nouvel envoi.
	rec2 := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec2, tunnelPost("/api/tunnel/auth/request-code",
		`{"email":"client@example.com"}`))
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("cooldown : HTTP %d attendu (429), eu %d — %s", http.StatusTooManyRequests, rec2.Code, rec2.Body.String())
	}
	wg.Wait()
	if len(calls) != 1 {
		t.Errorf("le cooldown ne doit envoyer AUCUN nouvel e-mail, %d au total", len(calls))
	}

	// Honeypot rempli : succès factice, RIEN n'est créé ni envoyé.
	rec3 := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec3, tunnelPost("/api/tunnel/auth/request-code",
		`{"email":"bot@example.com","website":"spam"}`))
	if rec3.Code != http.StatusOK {
		t.Fatalf("honeypot : HTTP %d attendu (200 factice), eu %d", http.StatusOK, rec3.Code)
	}
	wg.Wait()
	if len(calls) != 1 {
		t.Errorf("l'honeypot ne doit RIEN envoyer, %d e-mail(s) au total", len(calls))
	}

	// E-mail invalide : 400.
	rec4 := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec4, tunnelPost("/api/tunnel/auth/request-code",
		`{"email":"pas-une-adresse"}`))
	if rec4.Code != http.StatusBadRequest {
		t.Fatalf("e-mail invalide : HTTP %d attendu (400), eu %d", http.StatusBadRequest, rec4.Code)
	}
}

// TestTunnelAuthCodeNoRelay — relais e-mail non configuré : refus honnête 503
// (email_relay_unavailable), aucun code stocké.
func TestTunnelAuthCodeNoRelay(t *testing.T) {
	a, _ := newTunnelTest(t)
	var calls []sentEmail
	_ = stubAccountEmailCapture(t, &calls)

	rec := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec, tunnelPost("/api/tunnel/auth/request-code",
		`{"email":"client@example.com"}`))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "email_relay_unavailable") {
		t.Fatalf("attendu 503 email_relay_unavailable, eu HTTP %d — %s", rec.Code, rec.Body.String())
	}
	if len(calls) != 0 {
		t.Errorf("aucun e-mail ne doit partir sans relais configuré")
	}
	a.tunnelMu.Lock()
	n := len(a.tunnelCodes)
	a.tunnelMu.Unlock()
	if n != 0 {
		t.Errorf("aucun code ne doit être stocké sans relais, %d en mémoire", n)
	}
}

// ---------------------------------------------------------------------------
// verify — naissance du client, JWT tunnel, usage unique, tentatives bornées
// ---------------------------------------------------------------------------

func TestTunnelAuthVerifyLifecycle(t *testing.T) {
	a, st := newTunnelTest(t)
	var calls []sentEmail
	wg := stubAccountEmailCapture(t, &calls)

	st.Lock()
	enableTunnelEmail(st.Data())
	st.Save()
	st.Unlock()

	// 1. Demande de code.
	rec := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec, tunnelPost("/api/tunnel/auth/request-code", `{"email":"ali@example.com"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("demande de code : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	wg.Wait()
	if len(calls) != 1 {
		t.Fatalf("1 e-mail attendu, %d", len(calls))
	}
	code := tunnelCodeFromEmail(calls[0].body)

	// 2. Mauvais code : 400, tentative comptée.
	recWrong := httptest.NewRecorder()
	a.handleTunnelAuthVerify(recWrong, tunnelPost("/api/tunnel/auth/verify",
		`{"email":"ali@example.com","code":"000000"}`))
	if recWrong.Code != http.StatusBadRequest {
		t.Fatalf("code incorrect : HTTP %d attendu (400), eu %d", http.StatusBadRequest, recWrong.Code)
	}

	// 3. Bon code : 200, token + client NÉ.
	recOK := httptest.NewRecorder()
	a.handleTunnelAuthVerify(recOK, tunnelPost("/api/tunnel/auth/verify",
		`{"email":"Ali@Example.com","code":"`+code+`"}`))
	if recOK.Code != http.StatusOK {
		t.Fatalf("vérification : HTTP %d — %s", recOK.Code, recOK.Body.String())
	}
	var out struct {
		Token  string `json:"token"`
		Client struct {
			ID    string `json:"id"`
			Email string `json:"email"`
		} `json:"client"`
	}
	if err := json.Unmarshal(recOK.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.Token == "" || out.Client.ID == "" || out.Client.Email != "ali@example.com" {
		t.Fatalf("réponse inattendue : %+v", out)
	}
	claims, err := auth.Verify(testJWTSecret, out.Token)
	if err != nil || claims.Role != "tunnel" || claims.Sub != out.Client.ID || claims.Acc != "" {
		t.Fatalf("JWT tunnel inattendu : %+v (err %v)", claims, err)
	}
	st.Lock()
	db := st.Data()
	if len(db.TunnelClients) != 1 || db.TunnelClients[0].Status != model.TunnelClientActive {
		t.Fatalf("client léger attendu (actif), eu %+v", db.TunnelClients)
	}
	st.Unlock()

	// 4. Usage unique : rejouer le MÊME code → plus rien en attente.
	recReplay := httptest.NewRecorder()
	a.handleTunnelAuthVerify(recReplay, tunnelPost("/api/tunnel/auth/verify",
		`{"email":"ali@example.com","code":"`+code+`"}`))
	if recReplay.Code != http.StatusBadRequest {
		t.Fatalf("rejeu du code : HTTP %d attendu (400), eu %d", http.StatusBadRequest, recReplay.Code)
	}

	// 5. Tentatives bornées : nouveau code (l'entrée précédente est MORTE au
	// succès — usage unique ; le cooldown vit AVEC l'entrée, c'est donc
	// l'IP-limiter qui borne le débit des demandes suivantes), 5 faux →
	// verrouillé (429), le VRAI code refuse ensuite.
	rec2 := httptest.NewRecorder()
	a.handleTunnelAuthCode(rec2, tunnelPost("/api/tunnel/auth/request-code", `{"email":"ali@example.com"}`))
	if rec2.Code != http.StatusOK {
		t.Fatalf("2e demande : HTTP %d — %s", rec2.Code, rec2.Body.String())
	}
	wg.Wait()
	if len(calls) != 2 {
		t.Fatalf("2 e-mails attendus, %d", len(calls))
	}
	fresh := tunnelCodeFromEmail(calls[1].body)
	for i := 0; i < tunnelCodeMaxTry; i++ {
		recBad := httptest.NewRecorder()
		a.handleTunnelAuthVerify(recBad, tunnelPost("/api/tunnel/auth/verify",
			`{"email":"ali@example.com","code":"999999"}`))
		if recBad.Code != http.StatusBadRequest {
			t.Fatalf("faux code #%d : HTTP %d attendu (400), eu %d", i+1, http.StatusBadRequest, recBad.Code)
		}
	}
	recLocked := httptest.NewRecorder()
	a.handleTunnelAuthVerify(recLocked, tunnelPost("/api/tunnel/auth/verify",
		`{"email":"ali@example.com","code":"`+fresh+`"}`))
	if recLocked.Code != http.StatusTooManyRequests {
		t.Fatalf("verrouillage : HTTP %d attendu (429), eu %d — %s", http.StatusTooManyRequests, recLocked.Code, recLocked.Body.String())
	}

	// 6. Format : code non numéraire / e-mail vide → 400 sans toucher au stock.
	recFmt := httptest.NewRecorder()
	a.handleTunnelAuthVerify(recFmt, tunnelPost("/api/tunnel/auth/verify",
		`{"email":"ali@example.com","code":"12a456"}`))
	if recFmt.Code != http.StatusBadRequest {
		t.Fatalf("code non numéraire : HTTP %d attendu (400), eu %d", http.StatusBadRequest, recFmt.Code)
	}
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/me — profil, commandes B2C, refus des rôles console
// ---------------------------------------------------------------------------

func TestTunnelMe(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	db.TunnelClients = []model.TunnelClient{{
		ID: "tc-1", Email: "ali@example.com", Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	}}
	db.PublicVpnOrders = []model.PublicVpnOrder{
		{ID: "o1", Ref: "MCV-AAAA1111", Email: "Ali@Example.com", PlanID: model.PublicVpnPlanMonthID,
			Status: model.PublicVpnOrderProvisioned, CreatedAt: model.NowISO(), ExpiresAt: "2026-11-01T00:00:00Z"},
		{ID: "o2", Ref: "MCV-BBBB2222", Email: "autre@example.com", PlanID: model.PublicVpnPlanMonthID,
			Status: model.PublicVpnOrderPending, CreatedAt: model.NowISO()},
	}
	st.Save()
	st.Unlock()

	// Rôle tunnel, client connu : profil + LA commande appariée (jamais celle
	// d'un autre e-mail).
	req := httptest.NewRequest(http.MethodGet, "/api/tunnel/me", nil)
	req = req.WithContext(withClaims(req.Context(), &auth.Claims{Sub: "tc-1", Role: "tunnel"}))
	rec := httptest.NewRecorder()
	a.handleTunnelMe(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("me : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Client  map[string]any   `json:"client"`
		Orders  []map[string]any `json:"orders"`
		Devices int              `json:"devices"`
		Scope   string           `json:"scope"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	// N°314 — contrat phase2 : portfolio enrichi (kind, drapeaux d'action,
	// compte d'appareils). N°315 — contrat phase3 : + famille de formule
	// (b2c|pro — la console propose les BONNES formules de renouvellement).
	// La commande de test n'a PAS de PeerID → appareil incomplet : renewable
	// faux, revealable faux, devices 0 — le drapeau reste honnête tant que le
	// peer n'existe pas.
	if out.Client["email"] != "ali@example.com" || out.Scope != "phase3" {
		t.Fatalf("client/scope inattendus : %+v", out)
	}
	if len(out.Orders) != 1 || out.Orders[0]["ref"] != "MCV-AAAA1111" {
		t.Fatalf("commandes appariées inattendues : %+v", out.Orders)
	}
	if out.Orders[0]["kind"] != "" || out.Orders[0]["renewTargetRef"] != "" {
		t.Fatalf("genre de commande inattendu (sale implicite) : %+v", out.Orders[0])
	}
	if out.Orders[0]["family"] != model.PublicVpnPlanFamilyB2C {
		t.Fatalf("famille de formule inattendue (b2c attendu pour un plan vitrine) : %+v", out.Orders[0])
	}
	if out.Orders[0]["renewable"] != false || out.Orders[0]["revealable"] != false {
		t.Fatalf("drapeaux d'action inattendus sans peer lié : %+v", out.Orders[0])
	}
	if out.Devices != 0 {
		t.Fatalf("appareils vivants attendus : 0 (aucun PeerID), eu %d", out.Devices)
	}

	// Rôle console (admin) : refusé — l'espace tunnel n'est PAS la console.
	reqAdmin := httptest.NewRequest(http.MethodGet, "/api/tunnel/me", nil)
	reqAdmin = reqAdmin.WithContext(withClaims(reqAdmin.Context(), &auth.Claims{Sub: "u-x", Role: "admin"}))
	recAdmin := httptest.NewRecorder()
	a.handleTunnelMe(recAdmin, reqAdmin)
	if recAdmin.Code != http.StatusForbidden {
		t.Fatalf("rôle console : HTTP %d attendu (403), eu %d", http.StatusForbidden, recAdmin.Code)
	}

	// Session inconnue (client supprimé) : 401.
	reqGhost := httptest.NewRequest(http.MethodGet, "/api/tunnel/me", nil)
	reqGhost = reqGhost.WithContext(withClaims(reqGhost.Context(), &auth.Claims{Sub: "tc-fantome", Role: "tunnel"}))
	recGhost := httptest.NewRecorder()
	a.handleTunnelMe(recGhost, reqGhost)
	if recGhost.Code != http.StatusUnauthorized {
		t.Fatalf("session inconnue : HTTP %d attendu (401), eu %d", http.StatusUnauthorized, recGhost.Code)
	}
}

// ---------------------------------------------------------------------------
// Middleware — le token « tunnel » ne sort JAMAIS de /api/tunnel/*
// ---------------------------------------------------------------------------

func TestTunnelMiddlewareWhitelist(t *testing.T) {
	a, _ := newTunnelTest(t)
	handler := a.Handler()
	token := auth.Sign(testJWTSecret, auth.NewClaims("tc-x", "x@y.z", "tunnel", "", 0))

	// Une route console SaaS avec un token tunnel : 403 (miroir reseller).
	req := httptest.NewRequest(http.MethodGet, "/api/vpn/peers", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "console tunnel") {
		t.Fatalf("attendu 403 « console tunnel » sur une route SaaS, eu HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Une route d'auth tunnel sans AUCUN token : publique (le middleware
	// laisse passer — le handler répond lui-même 400 faute de corps valide).
	reqPub := httptest.NewRequest(http.MethodPost, "/api/tunnel/auth/verify", strings.NewReader(`{}`))
	reqPub.Header.Set("Content-Type", "application/json")
	recPub := httptest.NewRecorder()
	handler.ServeHTTP(recPub, reqPub)
	if recPub.Code != http.StatusBadRequest {
		t.Fatalf("route publique : HTTP %d attendu (400 du handler, pas 401 du middleware), eu %d — %s",
			http.StatusBadRequest, recPub.Code, recPub.Body.String())
	}
}
