// handlers_tunnel_guests_test.go — N°342 — tests de l'ACCÈS INVITÉ
// (confs invité expirables à périmètre minimal — hôte/32 + pin-holes).
//
// Couverture :
//   - GET /api/tunnel/pro/guests : liste antichronologique + jauge du plafond
//   - hôtes possibles (appareils Pro vivants) ; décor vide (sans compte
//     gérant) = listes vides, jamais d'erreur ;
//   - POST /api/tunnel/pro/guests : validations (ports csv 1-6, TTL 1-72 h,
//     hôte = appareil Pro VIVANT du compte), honeypot (zéro ligne), plafond
//     (409 guest_cap), non-éligible (403), provisioning 3 phases avec PREUVE
//     PAR LA CONF (stub rendant AllowedIPs = hôte/32 SEUL — un périmètre
//     élargi serait refusé par wgMiniGuestAdd), échec wg-mini (502 + état
//     error explicite, jamais un invité fantôme actif) ;
//   - POST /api/tunnel/pro/guests/{id}/reveal : conf + self-healing wg-mini
//     (copie cloud vide → conf fraîche re-sauvegardée), révoqué/échué → 410
//     honnête, anti-énumération (404 sur ID d'un autre compte ≡ inconnu),
//     401 session fantôme ;
//   - POST /api/tunnel/pro/guests/{id}/revoke : état posé sous verrou (conf
//     vidée — pas de coffre fantôme), peer retiré HORS verrou (stub enregistré),
//     idempotent (200 sur déjà révoqué), échec retrait → 502 guest_revoke_delayed
//   - ErrorMsg (reprise par le balayage) ;
//   - RunVpnGuestSweep : échéance naturelle (invité actif échué → peer retiré
//   - état revoked + trace), échec de retrait → ErrorMsg et l'état reste
//     actif (la vérité « encore sur wg0 » n'est jamais mensongère), reprise
//     réussie → ErrorMsg effacé, révocation antérieure manquée → retrait
//     différé finalisé ;
//   - routes invités : 401 sans JWT (bout en bout sur le mux réel).
//
// AUCUNE connexion réseau réelle : stubs + indirections (discipline maison).
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Harnais spécifique invités
// ---------------------------------------------------------------------------

// confGuestFake — une conf invité CONFORME (AllowedIPs = hôte/32 SEUL — la
// forme exacte exigée par la preuve par la conf, 3e frontière).
func confGuestFake(host string) string {
	return "[Interface]\nPrivateKey = " + proKey + "\nAddress = 10.8.3.9/32, fd00:8:3::9/128\nMTU = 1420\n\n[Peer]\nPublicKey = " + proKey +
		"\nPresharedKey = " + proKey + "\nEndpoint = 203.0.113.10:51820\nAllowedIPs = " + host + "/32\nPersistentKeepalive = 25\n"
}

// tunnelGuestSeed — un invité du compte Pro du décor tunnelProSeed.
func tunnelGuestSeed(db *model.DB, id, name, state, expiresAt, conf string) *model.VpnGuest {
	db.VpnGuests = append(db.VpnGuests, model.VpnGuest{
		ID: id, AccountID: "acc-pro", Name: name, Label: "Ami test",
		HostPeerID: "vp-pro1", HostIP: "10.8.2.7", Ports: "25565",
		IPv4: "10.8.3.9", State: state, Conf: conf, ExpiresAt: expiresAt,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	return &db.VpnGuests[len(db.VpnGuests)-1]
}

// tunnelGuestReq — requête authentifiée rôle tunnel avec le segment {id}
// posé à la main (appels directs hors mux — discipline N°314/315).
func tunnelGuestReq(method, target string, claims *auth.Claims, body string) *http.Request {
	req := tunnelAuthReq(method, target, claims, body)
	if i := strings.Index(target, "/guests/"); i != -1 {
		rest := strings.TrimPrefix(target[i+len("/guests/"):], "/")
		if j := strings.LastIndex(rest, "/"); j != -1 {
			rest = rest[:j]
		}
		req.SetPathValue("id", rest)
	}
	return req
}

// guestStubVM — stub wgMiniGuestAddFn conforme + wgMiniRemoveFn enregistreur :
// retourne des LECTEURS DE SNAPSHOT mutex-protégés (le remove best-effort du
// handler d'échec part en GOROUTINE — le -race exige la synchronisation des
// lectures du test avec les écritures du stub).
func guestStubVM(addErr error, removeErr error) (func() [][3]string, func() []string, func()) {
	var mu sync.Mutex
	adds := [][3]string{}
	removes := []string{}
	oldAdd, oldRemove := wgMiniGuestAddFn, wgMiniRemoveFn
	wgMiniGuestAddFn = func(name, host, ports string) (string, string, error) {
		mu.Lock()
		adds = append(adds, [3]string{name, host, ports})
		mu.Unlock()
		if addErr != nil {
			return "", "", addErr
		}
		return confGuestFake(host), "10.8.3.9", nil
	}
	wgMiniRemoveFn = func(name string) error {
		mu.Lock()
		removes = append(removes, name)
		mu.Unlock()
		return removeErr
	}
	readAdds := func() [][3]string {
		mu.Lock()
		defer mu.Unlock()
		return append([][3]string(nil), adds...)
	}
	readRemoves := func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), removes...)
	}
	return readAdds, readRemoves, func() { wgMiniGuestAddFn, wgMiniRemoveFn = oldAdd, oldRemove }
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/pro/guests — liste + jauge
// ---------------------------------------------------------------------------

func TestTunnelGuestList(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	tunnelGuestSeed(db, "vg-1", "vpn-aaaa1111", model.VpnGuestStateActive, model.NowISO()[:4]+"-12-31T23:59:59Z", confGuestFake("10.8.2.7"))
	tunnelGuestSeed(db, "vg-2", "vpn-bbbb2222", model.VpnGuestStateRevoked, model.NowISO()[:4]+"-01-01T00:00:00Z", "")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestsList(rec, tunnelGuestReq(http.MethodGet, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("list : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Guests      []map[string]any `json:"guests"`
		ActiveCount int              `json:"activeCount"`
		MaxPerAcct  int              `json:"maxPerAccount"`
		Hosts       []map[string]any `json:"hosts"`
		TTLMaxHours int              `json:"ttlMaxHours"`
		TTLMinHours int              `json:"ttlMinHours"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if len(out.Guests) != 2 {
		t.Fatalf("2 invités attendus, eu %d", len(out.Guests))
	}
	// Antichronologique : vg-2 (dernier inséré) d'abord.
	if out.Guests[0]["id"] != "vg-2" || out.Guests[1]["id"] != "vg-1" {
		t.Fatalf("ordre antichronologique attendu, eu %v puis %v", out.Guests[0]["id"], out.Guests[1]["id"])
	}
	if out.Guests[0]["state"] != model.VpnGuestStateRevoked || out.Guests[1]["state"] != model.VpnGuestStateActive {
		t.Fatalf("états dérivés inattendus : %v / %v", out.Guests[0]["state"], out.Guests[1]["state"])
	}
	// Jamais de conf ni de nom VM dans la liste (le journal n'est pas un coffre).
	if s := rec.Body.String(); strings.Contains(s, "PrivateKey") || strings.Contains(s, "vpn-aaaa1111") {
		t.Fatalf("la liste ne doit contenir NI conf NI nom VM : %s", rec.Body.String())
	}
	if out.ActiveCount != 1 || out.MaxPerAcct != model.MaxVpnGuestsPerAccount {
		t.Fatalf("jauge active 1/%d attendue, eu %d/%d", model.MaxVpnGuestsPerAccount, out.ActiveCount, out.MaxPerAcct)
	}
	if len(out.Hosts) != 1 || out.Hosts[0]["peerId"] != "vp-pro1" || out.Hosts[0]["ipv4"] != "10.8.2.7" {
		t.Fatalf("l'hôte possible = l'appareil Pro vivant : %v", out.Hosts)
	}
	if out.TTLMinHours != model.MinGuestTTLHours || out.TTLMaxHours != model.MaxGuestTTLHours {
		t.Fatalf("bornes TTL inattendues : %d-%d", out.TTLMinHours, out.TTLMaxHours)
	}
}

// TestTunnelGuestListEmpty — décor sans compte gérant (consommateur pur) :
// listes vides et honnêtes, jamais d'erreur — la page /pro s'affiche toujours.
func TestTunnelGuestListEmpty(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	tunnelSeedClient(st.Data(), "tc-1", "consommateur@example.com")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestsList(rec, tunnelGuestReq(http.MethodGet, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("list vide : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	if s := rec.Body.String(); !strings.Contains(s, `"guests":[]`) || !strings.Contains(s, `"hosts":[]`) {
		t.Fatalf("listes vides attendues : %s", rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests — création
// ---------------------------------------------------------------------------

func TestTunnelGuestCreateValidations(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	order, peer := tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	_ = order
	_ = peer
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	cases := []struct {
		name, body, wantErr string
		wantCode            int
	}{
		{"ports vides", `{"hostPeerId":"vp-pro1","ports":"","ttlHours":2}`, "Ports invalides", 400},
		{"ports hors bornes", `{"hostPeerId":"vp-pro1","ports":"99999","ttlHours":2}`, "Ports invalides", 400},
		{"trop de ports", `{"hostPeerId":"vp-pro1","ports":"1,2,3,4,5,6,7","ttlHours":2}`, "Ports invalides", 400},
		{"ports non numériques", `{"hostPeerId":"vp-pro1","ports":"abc","ttlHours":2}`, "Ports invalides", 400},
		{"ttl nul", `{"hostPeerId":"vp-pro1","ports":"25565","ttlHours":0}`, "Durée invalide", 400},
		{"ttl excessif", `{"hostPeerId":"vp-pro1","ports":"25565","ttlHours":73}`, "Durée invalide", 400},
		{"hôte inconnu", `{"hostPeerId":"vp-inconnu","ports":"25565","ttlHours":2}`, "Hôte introuvable", 400},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests", claims, tc.body))
		if rec.Code != tc.wantCode || !strings.Contains(rec.Body.String(), tc.wantErr) {
			t.Fatalf("%s : HTTP %d — %s (attendu %d/%q)", tc.name, rec.Code, rec.Body.String(), tc.wantCode, tc.wantErr)
		}
	}

	// Honeypot : succès factice, zéro ligne (pattern join N°27).
	st.Lock()
	before := len(st.Data().VpnGuests)
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests", claims,
		`{"hostPeerId":"vp-pro1","ports":"25565","ttlHours":2,"website":"bot"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("honeypot : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if after := len(st.Data().VpnGuests); after != before {
		t.Fatalf("honeypot : %d invités créés (attendu 0 delta)", after-before)
	}
	st.Unlock()
}

// TestTunnelGuestCreateIneligible — sans compte gérant (consommateur pur) :
// refus honnête 403, jamais une création muette.
func TestTunnelGuestCreateIneligible(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	st.Lock()
	tunnelSeedClient(st.Data(), "tc-1", "consommateur@example.com")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"},
		`{"hostPeerId":"vp-rien","ports":"25565","ttlHours":2}`))
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "Accès Pro") {
		t.Fatalf("non-éligible : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if n := len(st.Data().VpnGuests); n != 0 {
		t.Fatalf("zéro invité attendu, eu %d", n)
	}
	st.Unlock()
}

// TestTunnelGuestCreateCap — plafond MaxVpnGuestsPerAccount sur les VIVANTS
// seuls : 409 avec message honnête, les révoqués ne comptent pas.
func TestTunnelGuestCreateCap(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	future := model.NowISO()[:4] + "-12-31T23:59:59Z"
	for i := 0; i < model.MaxVpnGuestsPerAccount; i++ {
		tunnelGuestSeed(db, model.NewID("vg-"), model.NewVpnPeerName(), model.VpnGuestStateActive, future, "")
	}
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"},
		`{"hostPeerId":"vp-pro1","ports":"25565","ttlHours":2}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "Plafond atteint") {
		t.Fatalf("plafond : HTTP %d — %s", rec.Code, rec.Body.String())
	}
}

// TestTunnelGuestCreateSuccess — le chemin complet : stub VM conforme
// (preuve par la conf — hôte/32 SEUL), invité actif + conf chiffrée au
// repos + échéance ~TTL, réponse SANS conf (la livraison passe par reveal).
func TestTunnelGuestCreateSuccess(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	addsFn, _, restore := guestStubVM(nil, nil)
	defer restore()
	var confCalls []string
	oldConf := wgMiniConfFn
	wgMiniConfFn = func(name string) (string, error) {
		confCalls = append(confCalls, name)
		return "", errors.New("absent")
	}
	defer func() { wgMiniConfFn = oldConf }()

	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"},
		`{"label":"Ami du samedi","hostPeerId":"vp-pro1","ports":"25565,3000","ttlHours":2}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("create : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Guest map[string]any `json:"guest"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	// La réponse ne porte JAMAIS la conf (miroir create Pro).
	if s := rec.Body.String(); strings.Contains(s, "PrivateKey") || strings.Contains(s, `"conf"`) {
		t.Fatalf("la création ne doit pas livrer la conf : %s", rec.Body.String())
	}
	if out.Guest["state"] != model.VpnGuestStateActive || out.Guest["hostIp"] != "10.8.2.7" || out.Guest["ports"] != "25565,3000" {
		t.Fatalf("invité inattendu : %v", out.Guest)
	}
	// Le stub VM a reçu l'hôte et les ports EXACTS (pin-holes de la bonne cible).
	if got := addsFn(); len(got) != 1 || got[0][1] != "10.8.2.7" || got[0][2] != "25565,3000" {
		t.Fatalf("appel wg-mini add-guest inattendu : %v", got)
	}
	// Échéance ~2 h (tolérance large : l'horloge du test et celle du handler
	// sont indépendantes à quelques dizaines de ms près).
	st.Lock()
	db = st.Data()
	if n := len(db.VpnGuests); n != 1 {
		st.Unlock()
		t.Fatalf("1 invité attendu, eu %d", n)
	}
	g := &db.VpnGuests[0]
	if g.State != model.VpnGuestStateActive || g.Conf != confGuestFake("10.8.2.7") || g.IPv4 != "10.8.3.9" {
		st.Unlock()
		t.Fatalf("invité persisté inattendu : %+v", g)
	}
	if g.AccountID != "acc-pro" || g.HostPeerID != "vp-pro1" || g.HostIP != "10.8.2.7" {
		st.Unlock()
		t.Fatalf("rattachement hôte/compte inattendu : %+v", g)
	}
	exp, err := time.Parse(time.RFC3339, g.ExpiresAt)
	st.Unlock()
	if err != nil {
		t.Fatalf("ExpiresAt non RFC3339 : %q", g.ExpiresAt)
	}
	if d := time.Until(exp); d < 90*time.Minute || d > 150*time.Minute {
		t.Fatalf("échéance ~2 h attendue, eu %v", d)
	}
	_ = confCalls
}

// TestTunnelGuestCreateVMFailure — échec wg-mini : 502 honnête + état error
// explicite (revivable par une nouvelle création — jamais un invité actif
// fantôme), et le peer VM éventuellement posé est retiré best-effort.
func TestTunnelGuestCreateVMFailure(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	_, removesFn, restore := guestStubVM(errors.New("wg-mini injoignable (test)"), nil)
	defer restore()

	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestCreate(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"},
		`{"hostPeerId":"vp-pro1","ports":"25565","ttlHours":2}`))
	if rec.Code != http.StatusBadGateway || !strings.Contains(rec.Body.String(), "Création impossible") {
		t.Fatalf("échec VM : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	db = st.Data()
	if n := len(db.VpnGuests); n != 1 {
		st.Unlock()
		t.Fatalf("la ligne d'échec reste tracée (1), eu %d", n)
	}
	if g := &db.VpnGuests[0]; g.State != model.VpnGuestStateError || g.ErrorMsg == "" {
		st.Unlock()
		t.Fatalf("état error explicite attendu : %+v", g)
	}
	st.Unlock()
	// Best-effort : le remove du peer a été TENTÉ (nettoyage wg-mini) — la
	// goroutine part ASYNCHRONE, on attend son passage (borné, mutex du stub).
	for i := 0; i < 200 && len(removesFn()) < 1; i++ {
		time.Sleep(10 * time.Millisecond)
	}
	if got := removesFn(); len(got) < 1 {
		t.Fatalf("remove best-effort attendu après échec add, appels : %v", got)
	}
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests/{id}/reveal
// ---------------------------------------------------------------------------

func TestTunnelGuestReveal(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// Self-healing : conf cloud VIDE, wg-mini rend la vérité VM.
	var confFetches []string
	oldConf := wgMiniConfFn
	wgMiniConfFn = func(name string) (string, error) {
		confFetches = append(confFetches, name)
		return confGuestFake("10.8.2.7"), nil
	}
	defer func() { wgMiniConfFn = oldConf }()

	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	tunnelGuestSeed(db, "vg-1", "vpn-aaaa1111", model.VpnGuestStateActive, model.NowISO()[:4]+"-12-31T23:59:59Z", "")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelGuestReveal(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/reveal", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("reveal : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Conf      string `json:"conf"`
		IPv4      string `json:"ipv4"`
		HostIP    string `json:"hostIp"`
		ExpiresAt string `json:"expiresAt"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !strings.Contains(out.Conf, "AllowedIPs = 10.8.2.7/32") || out.IPv4 != "10.8.3.9" || out.HostIP != "10.8.2.7" {
		t.Fatalf("conf/périmètre inattendus : %+v", out)
	}
	if len(confFetches) != 1 {
		t.Fatalf("self-healing : 1 fetch wg-mini attendu, eu %v", confFetches)
	}
	// La copie cloud a été RE-SAUVÉE (pattern D5-a).
	st.Lock()
	if g := model.FindVpnGuestScoped(st.Data(), "vg-1", "acc-pro"); g == nil || g.Conf == "" {
		st.Unlock()
		t.Fatal("la conf self-healed doit être persistée")
	}
	st.Unlock()

	// Révoqué → 410 (jamais de re-livraison d'un accès mort, même à l'hôte).
	st.Lock()
	if g := model.FindVpnGuestScoped(st.Data(), "vg-1", "acc-pro"); g != nil {
		g.State = model.VpnGuestStateRevoked
	}
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelGuestReveal(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/reveal", claims, ""))
	if rec.Code != http.StatusGone || !strings.Contains(rec.Body.String(), "révoqué") {
		t.Fatalf("révoqué : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Échué → 410 avec le terme honnête.
	st.Lock()
	if g := model.FindVpnGuestScoped(st.Data(), "vg-1", "acc-pro"); g != nil {
		g.State = model.VpnGuestStateActive
		g.ExpiresAt = model.NowISO()[:4] + "-01-01T00:00:00Z"
	}
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelGuestReveal(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/reveal", claims, ""))
	if rec.Code != http.StatusGone || !strings.Contains(rec.Body.String(), "terme") {
		t.Fatalf("échué : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Anti-énumération : ID d'un autre compte ≡ inconnu → même 404.
	st.Lock()
	db = st.Data()
	db.VpnGuests = append(db.VpnGuests, model.VpnGuest{ID: "vg-autre", AccountID: "acc-etranger", Name: "vpn-eeee4444",
		State: model.VpnGuestStateActive, ExpiresAt: model.NowISO()[:4] + "-12-31T23:59:59Z"})
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelGuestReveal(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-autre/reveal", claims, ""))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("anti-énumération : HTTP %d attendu 404 — %s", rec.Code, rec.Body.String())
	}

	// Session fantôme → 401.
	rec = httptest.NewRecorder()
	a.handleTunnelGuestReveal(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/reveal",
		&auth.Claims{Sub: "tc-fantome", Role: "tunnel"}, ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("session fantôme : HTTP %d attendu 401", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests/{id}/revoke
// ---------------------------------------------------------------------------

func TestTunnelGuestRevoke(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// 1. Succès : état posé sous verrou, conf VIDÉE, peer retiré hors verrou.
	_, removesFn, restore := guestStubVM(nil, nil)
	defer restore()
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro1", "MCV-PROGUEST1", model.NowISO()[:4]+"-12-31T23:59:59Z")
	tunnelGuestSeed(db, "vg-1", "vpn-aaaa1111", model.VpnGuestStateActive, model.NowISO()[:4]+"-12-31T23:59:59Z", confGuestFake("10.8.2.7"))
	st.Save()
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleTunnelGuestRevoke(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/revoke", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("revoke : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	g := model.FindVpnGuestScoped(st.Data(), "vg-1", "acc-pro")
	if g == nil || g.State != model.VpnGuestStateRevoked || g.Conf != "" {
		st.Unlock()
		t.Fatalf("révoqué + conf vidée attendus : %+v", g)
	}
	st.Unlock()
	if got := removesFn(); len(got) != 1 || got[0] != "vpn-aaaa1111" {
		t.Fatalf("remove wg-mini attendu pour vpn-aaaa1111 : %v", got)
	}

	// 2. Idempotent : déjà révoqué → 200 sans second remove.
	rec = httptest.NewRecorder()
	a.handleTunnelGuestRevoke(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-1/revoke", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("revoke idempotent : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	if got := removesFn(); len(got) != 1 {
		t.Fatalf("pas de second remove attendu : %v", got)
	}

	// 3. Échec du retrait VM : 502 guest_revoke_delayed + ErrorMsg (le
	// balayage reprendra) — l'état reste révélé côté API (vérité immédiate).
	st.Lock()
	if g := model.FindVpnGuestScoped(st.Data(), "vg-1", "acc-pro"); g != nil {
		g.ErrorMsg = ""
	}
	st.Save()
	st.Unlock()
	st.Lock()
	db = st.Data()
	tunnelGuestSeed(db, "vg-2", "vpn-bbbb2222", model.VpnGuestStateActive, model.NowISO()[:4]+"-12-31T23:59:59Z", confGuestFake("10.8.2.7"))
	st.Save()
	st.Unlock()
	oldRemove := wgMiniRemoveFn
	wgMiniRemoveFn = func(name string) error { return errors.New("wg-mini injoignable (test)") }
	rec = httptest.NewRecorder()
	a.handleTunnelGuestRevoke(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-2/revoke", claims, ""))
	wgMiniRemoveFn = oldRemove
	if rec.Code != http.StatusBadGateway || !strings.Contains(rec.Body.String(), "retenté automatiquement") {
		t.Fatalf("échec retrait : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	g2 := model.FindVpnGuestScoped(st.Data(), "vg-2", "acc-pro")
	if g2 == nil || g2.State != model.VpnGuestStateRevoked || g2.ErrorMsg == "" {
		st.Unlock()
		t.Fatalf("révoqué + ErrorMsg de reprise attendus : %+v", g2)
	}
	st.Unlock()

	// 4. Anti-énumération + session fantôme.
	rec = httptest.NewRecorder()
	a.handleTunnelGuestRevoke(rec, tunnelGuestReq(http.MethodPost, "/api/tunnel/pro/guests/vg-inconnu/reveal", claims, ""))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("anti-énumération revoke : HTTP %d attendu 404", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Balayage TTL (RunVpnGuestSweep)
// ---------------------------------------------------------------------------

func TestVpnGuestSweep(t *testing.T) {
	a, st := newTunnelTest(t)

	// 1. Échéance naturelle : invité actif échué → remove + revoked + trace.
	_, removesFn, restore := guestStubVM(nil, nil)
	defer restore()
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	past := model.NowISO()[:4] + "-01-01T00:00:00Z"
	tunnelGuestSeed(db, "vg-exp", "vpn-aaaa1111", model.VpnGuestStateActive, past, confGuestFake("10.8.2.7"))
	// 2. Invité vivant : INTACT (le balayage ne touche que les échus).
	tunnelGuestSeed(db, "vg-vif", "vpn-bbbb2222", model.VpnGuestStateActive, model.NowISO()[:4]+"-12-31T23:59:59Z", confGuestFake("10.8.2.7"))
	// 3. Révoqué dont le retrait avait ÉCHOUÉ : reprise par le balayage.
	tunnelGuestSeed(db, "vg-att", "vpn-cccc3333", model.VpnGuestStateRevoked, past, "")
	if g := model.FindVpnGuestScoped(st.Data(), "vg-att", "acc-pro"); g != nil {
		g.ErrorMsg = "retrait VM en attente : wg-mini injoignable"
	}
	st.Save()
	st.Unlock()

	a.RunVpnGuestSweep()

	removedNames := map[string]bool{}
	for _, n := range removesFn() {
		removedNames[n] = true
	}
	if len(removedNames) != 2 || !removedNames["vpn-aaaa1111"] || !removedNames["vpn-cccc3333"] {
		t.Fatalf("mauvais peers retirés : %v", removesFn())
	}
	st.Lock()
	db = st.Data()
	if g := model.FindVpnGuestScoped(db, "vg-exp", "acc-pro"); g == nil || g.State != model.VpnGuestStateRevoked || g.ErrorMsg != "" || g.Conf != "" {
		st.Unlock()
		t.Fatalf("échu finalisé en révoqué propre : %+v", g)
	}
	if g := model.FindVpnGuestScoped(db, "vg-att", "acc-pro"); g == nil || g.ErrorMsg != "" {
		st.Unlock()
		t.Fatalf("reprise de retrait : ErrorMsg effacé attendu : %+v", g)
	}
	if g := model.FindVpnGuestScoped(db, "vg-vif", "acc-pro"); g == nil || g.State != model.VpnGuestStateActive || g.Conf == "" {
		st.Unlock()
		t.Fatalf("l'invité VIVANT doit rester intact : %+v", g)
	}
	st.Unlock()

	// Trace d'activité : l'expiration est consignée (mot « terme »).
	st.Lock()
	found := false
	for _, act := range st.Data().Activity {
		if strings.Contains(act.Message, "terme") && strings.Contains(act.Message, "Ami test") {
			found = true
		}
	}
	st.Unlock()
	if !found {
		t.Fatal("trace d'expiration attendue dans le journal d'activité")
	}
}

// TestVpnGuestSweepRetryOnError — retrait wg-mini en échec : l'invité reste
// ACTIVE avec ErrorMsg (jamais un état mensonger « révoqué » pendant que le
// peer vit encore sur wg0) — le passage suivant retentera.
func TestVpnGuestSweepRetryOnError(t *testing.T) {
	a, st := newTunnelTest(t)
	_, _, restore := guestStubVM(nil, errors.New("wg-mini injoignable (test)"))
	defer restore()
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	past := model.NowISO()[:4] + "-01-01T00:00:00Z"
	tunnelGuestSeed(db, "vg-exp", "vpn-aaaa1111", model.VpnGuestStateActive, past, confGuestFake("10.8.2.7"))
	st.Save()
	st.Unlock()

	a.RunVpnGuestSweep()

	st.Lock()
	g := model.FindVpnGuestScoped(st.Data(), "vg-exp", "acc-pro")
	if g == nil || g.State != model.VpnGuestStateActive || g.ErrorMsg == "" {
		st.Unlock()
		t.Fatalf("échec retrait : état actif + ErrorMsg attendus (vérité non mensongère) : %+v", g)
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Routes invités : authentification obligatoire (mux réel)
// ---------------------------------------------------------------------------

func TestTunnelGuestRoutesRequireAuth(t *testing.T) {
	a, _ := newTunnelTest(t)
	targets := []struct {
		method, path string
	}{
		{http.MethodGet, "/api/tunnel/pro/guests"},
		{http.MethodPost, "/api/tunnel/pro/guests"},
		{http.MethodPost, "/api/tunnel/pro/guests/vg-x/reveal"},
		{http.MethodPost, "/api/tunnel/pro/guests/vg-x/revoke"},
	}
	for _, tt := range targets {
		req := httptest.NewRequest(tt.method, tt.path, nil)
		rec := httptest.NewRecorder()
		a.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s sans JWT : HTTP %d attendu 401", tt.method, tt.path, rec.Code)
		}
	}
}
