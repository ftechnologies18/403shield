// handlers_vpn_remote_test.go — N°312 — tests de la forme « remote » (P-A,
// accès distant du gérant — supervision B2B de ses routeurs via le tunnel).
//
// Couverture :
//   - wgAllowedSourcesLocked : socle PERMANENT + IP des peers remote du
//     compte UNIQUEMENT (les fulltunnel jamais, les comptes étrangers jamais,
//     doublons/IP vides écartés) ;
//   - queueWgSetupRefreshLocked : re-livraison aux routeurs agents ACTIFS
//     complets seulement, pas de doublon sur une commande en file/vol, état
//     « pending_setup » posé, payload portant la liste fraîche ;
//   - wgMiniAdd : PREUVE PAR LA CONF — remote exige « AllowedIPs =
//     10.8.0.0/24 » sans 0.0.0.0/0 (un wg-mini/wg-peer.sh antérieur rend une
//     conf full-tunnel → refus explicite ops-wg-mini-install), fulltunnel
//     exige 0.0.0.0/0, kind inconnu refusé SANS appel réseau ;
//   - POST /api/vpn/peers {kind:"remote"} : peer actif au registre + wg_setup
//     re-filé au routeur actif du compte avec l'IP nouvelle dans
//     allowedSources ;
//   - dégradation honnête (wg-mini antérieur) : 502 wg_mini_error, ligne en
//     « error », peer VM nettoyé, AUCUN wg_setup filé ;
//   - kind inconnu : 400 vpn_kind_unavailable, aucune ligne créée ;
//   - révocation remote : wg_setup re-filé avec la liste RÉDUITE (socle seul).
//
// AUCUNE connexion réseau réelle : wgMiniAddFn / wgMiniRemoveFn /
// wgMiniCallFn remplacés par des indirections (discipline maison).
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// Clé WireGuard de test (44 caractères base64, « = » final — ValidWgKey).
const wgRemoteTestKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

// newVpnRemoteTest — API + store JSON éphémère (harnais maison, zéro réseau).
func newVpnRemoteTest(t *testing.T) (*API, *store.Store) {
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

// reqWithClaims — requête porteuse de claims (rôle « admin » plateforme :
// guardAccountWrite passe, accountScope suit le compte visé).
func reqWithClaims(method, target, body string, acc string) *http.Request {
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, target, nil)
	} else {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
	}
	req.Header.Set("Content-Type", "application/json")
	return req.WithContext(context.WithValue(req.Context(), claimsCtxKey{},
		&auth.Claims{Sub: "u-test", Name: "Test", Role: "admin", Acc: acc}))
}

// enableVpnModule — active le module VPN du compte (sous verrou).
func enableVpnModule(db *model.DB, acc string) {
	on := true
	s := ensureSettings(db, acc)
	s.Tenant.WgVpnEnabled = &on
	db.SettingsByAccount[acc] = s
}

// remoteTestRouter — routeur agent ACTIF au tunnel complet (payload complet,
// clés valides) pour le compte donné.
func remoteTestRouter(id, acc, wgIPv4 string) model.Router {
	return model.Router{
		ID: id, AccountID: acc, Name: "Boutique " + id, Mode: "agent",
		WgState: "active", WgPub: wgRemoteTestKey, WgPeerName: "r-" + id,
		WgIPv4: wgIPv4, WgServerPub: wgRemoteTestKey, WgPSK: wgRemoteTestKey,
		WgEndpoint: "203.0.113.10:51820", WgAppliedAt: "2026-10-01T00:00:00Z",
	}
}

// confRemoteFake — conf client « remote » conforme à wg-peer.sh v4
// (N°313 : segment 10.8.2.0/24, AllowedIPs gestion + remote, ULA de segment).
func confRemoteFake(ip string) string {
	return "[Interface]\nPrivateKey = k\nAddress = " + ip + "/32, fd00:8:2::7/128\nMTU = 1420\n\n[Peer]\nPublicKey = k\nPresharedKey = k\nEndpoint = 203.0.113.10:51820\nAllowedIPs = 10.8.0.0/24, 10.8.2.0/24\nPersistentKeepalive = 25\n"
}

// confRemoteV3Fake — conf remote de la VM v3 (N°312, mono-segment) : la
// PREUVE PAR LA CONF doit la REFUSER (dégradation honnête → ops-wg-mini-install).
func confRemoteV3Fake(ip string) string {
	return "[Interface]\nPrivateKey = k\nAddress = " + ip + "/32, fd00:8::7/128\nMTU = 1420\n\n[Peer]\nPublicKey = k\nPresharedKey = k\nEndpoint = 203.0.113.10:51820\nAllowedIPs = 10.8.0.0/24\nPersistentKeepalive = 25\n"
}

// confFulltunnelFake — conf client « fulltunnel » (v2 historique comprise).
func confFulltunnelFake(ip string) string {
	return "[Interface]\nPrivateKey = k\nAddress = " + ip + "/32, fd00:8::7/128\nDNS = 1.1.1.1, 8.8.8.8\nMTU = 1420\n\n[Peer]\nPublicKey = k\nPresharedKey = k\nEndpoint = 203.0.113.10:51820\nAllowedIPs = 0.0.0.0/0, ::/0\nPersistentKeepalive = 25\n"
}

// ---------------------------------------------------------------------------
// wgAllowedSourcesLocked — la liste par compte (isolation multi-tenant)
// ---------------------------------------------------------------------------

func TestWgAllowedSourcesLocked(t *testing.T) {
	db := &model.DB{
		VpnPeers: []model.VpnPeer{
			{ID: "vp-1", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.0.7", State: model.VpnStateActive},
			{ID: "vp-2", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.0.9", State: model.VpnStateError},       // error : IP encore allouée → incluse
			{ID: "vp-3", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "", State: model.VpnStatePending},             // pas d'IP → exclue
			{ID: "vp-4", AccountID: "acc-a", Kind: model.VpnKindFullTunnel, IPv4: "10.8.0.11", State: model.VpnStateActive}, // fulltunnel : JAMAIS
			{ID: "vp-5", AccountID: "acc-b", Kind: model.VpnKindRemote, IPv4: "10.8.0.13", State: model.VpnStateActive},     // compte étranger : JAMAIS
			{ID: "vp-6", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.0.7", State: model.VpnStateActive},      // doublon d'IP → une seule fois
			// N°313 — segments : remote FRAIS (10.8.2.x, inclus) ;
			// fulltunnel B2C sur le segment 1 (10.8.1.x) : REFUSÉ par
			// ValidWgSupervisionIP même si Kind était corrompu.
			{ID: "vp-7", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.2.7", State: model.VpnStateActive},
			{ID: "vp-8", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.1.7", State: model.VpnStateActive},
		},
	}
	if got := wgAllowedSourcesLocked(db, "acc-a"); got != "10.8.0.1/32,10.8.0.7/32,10.8.0.9/32,10.8.2.7/32" {
		t.Errorf("wgAllowedSourcesLocked(acc-a) = %q, attendu socle + .7 + .9 (legacy) + 10.8.2.7 (segment remote)", got)
	}
	// Compte ÉTRANGER : ses propres peers remote entrent, ceux d'acc-a JAMAIS
	// (l'IP .13 de acc-b figure ; les .7/.9/.2.7/.1.7 d'acc-a non).
	if got := wgAllowedSourcesLocked(db, "acc-b"); got != "10.8.0.1/32,10.8.0.13/32" {
		t.Errorf("wgAllowedSourcesLocked(acc-b) = %q, attendu le socle + son propre .13", got)
	}
	// Compte SANS peer remote : socle seul — comportement N°285 au byte près.
	if got := wgAllowedSourcesLocked(db, "acc-c"); got != "10.8.0.1/32" {
		t.Errorf("wgAllowedSourcesLocked(acc-c) = %q, attendu le socle seul", got)
	}
	if got := wgAllowedSourcesLocked(&model.DB{}, "acc-vide"); got != "10.8.0.1/32" {
		t.Errorf("wgAllowedSourcesLocked(vide) = %q, attendu le socle seul", got)
	}
}

// ---------------------------------------------------------------------------
// queueWgSetupRefreshLocked — la re-livraison ciblée aux ACTIFS complets
// ---------------------------------------------------------------------------

func TestQueueWgSetupRefreshLocked(t *testing.T) {
	a, st := newVpnRemoteTest(t)
	st.Lock()
	db := st.Data()
	db.VpnPeers = []model.VpnPeer{
		{ID: "vp-1", AccountID: "acc-a", Kind: model.VpnKindRemote, IPv4: "10.8.0.7", State: model.VpnStateActive},
	}
	db.Routers = []model.Router{
		remoteTestRouter("r-ok", "acc-a", "10.8.0.2"),                       // cible : actif + complet
		remoteTestRouter("r-incomplet", "acc-a", "10.8.0.3"),                // PSK absente → écarté
		remoteTestRouter("r-pending", "acc-a", "10.8.0.4"),                  // pas actif → écarté
		{ID: "r-real", AccountID: "acc-a", Mode: "real", WgState: "active"}, // pas agent → écarté
		remoteTestRouter("r-vol", "acc-a", "10.8.0.5"),                      // wg_setup déjà en file → écarté (dédup N°115)
		remoteTestRouter("r-autre", "acc-b", "10.8.0.6"),                    // compte étranger → écarté
	}
	db.Routers[1].WgPSK = ""
	db.Routers[2].WgState = "pending_setup"
	db.Routers[4].WgState = "active"
	db.Commands = []model.Command{{
		ID: "cmd-vol", RouterID: "r-vol", AccountID: "acc-a", Kind: model.CmdWgSetup, Status: "sent",
	}}
	st.Save()
	st.Unlock()

	st.Lock()
	db = st.Data()
	n := a.queueWgSetupRefreshLocked(nil, db, "acc-a", "test")
	st.Save()
	st.Unlock()

	if n != 1 {
		t.Fatalf("queueWgSetupRefreshLocked = %d re-livraison(s), attendu 1 (r-ok seul)", n)
	}
	if len(db.Commands) != 2 {
		t.Fatalf("%d commande(s) au total, attendu 2 (l'existante + la re-livraison)", len(db.Commands))
	}
	var fresh *model.Command
	for i := range db.Commands {
		if db.Commands[i].ID != "cmd-vol" {
			fresh = &db.Commands[i]
		}
	}
	if fresh == nil || fresh.RouterID != "r-ok" || fresh.Kind != model.CmdWgSetup || fresh.Status != "queued" {
		t.Fatalf("commande re-filée inattendue : %+v", fresh)
	}
	if got, _ := fresh.Payload["allowedSources"].(string); got != "10.8.0.1/32,10.8.0.7/32" {
		t.Fatalf("allowedSources re-filée = %q, attendu le socle + l'IP du peer remote", got)
	}
	// Le routeur ciblé passe « pending_setup » ; les autres restent intacts.
	for i := range db.Routers {
		rot := &db.Routers[i]
		switch rot.ID {
		case "r-ok":
			if rot.WgState != "pending_setup" || rot.WgError != "" {
				t.Errorf("r-ok : état %q (erreur %q), attendu pending_setup net", rot.WgState, rot.WgError)
			}
		case "r-incomplet", "r-autre":
			if rot.WgState != "active" {
				t.Errorf("%s ne doit pas être touché (état %q)", rot.ID, rot.WgState)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// wgMiniAdd — la PREUVE PAR LA CONF (défense en profondeur)
// ---------------------------------------------------------------------------

func TestWgMiniAddKindProof(t *testing.T) {
	oldCall := wgMiniCallFn
	t.Cleanup(func() { wgMiniCallFn = oldCall })

	var gotKind string
	respond := func(conf string) func(string, string, any) ([]byte, error) {
		return func(method, path string, payload any) ([]byte, error) {
			if m, ok := payload.(map[string]string); ok {
				gotKind = m["kind"]
			}
			return json.Marshal(map[string]any{"ok": true, "conf": conf, "ip": "10.8.0.7", "kind": gotKind})
		}
	}

	// remote conforme : accepté, kind transmis à wg-mini.
	wgMiniCallFn = respond(confRemoteFake("10.8.0.7"))
	if _, _, err := wgMiniAdd("vpn-proof1", model.VpnKindRemote); err != nil {
		t.Errorf("wgMiniAdd(remote conforme) : %v", err)
	}
	if gotKind != "remote" {
		t.Errorf("kind transmis à wg-mini = %q, attendu remote", gotKind)
	}

	// wg-mini ANTÉRIEUR v3 (mono-segment) : conf remote sans le segment
	// 10.8.2.0/24 → refus explicite avec la consigne exploitant (jamais de
	// trompe-l'œil). Un antérieur v2- rend une conf full-tunnel : même refus.
	wgMiniCallFn = respond(confRemoteV3Fake("10.8.0.7"))
	if _, _, err := wgMiniAdd("vpn-proof2", model.VpnKindRemote); err == nil || !strings.Contains(err.Error(), "ops-wg-mini-install") {
		t.Errorf("wgMiniAdd(remote, conf v3 mono-segment) : attendu le refus ops-wg-mini-install, eu %v", err)
	}
	wgMiniCallFn = respond(confFulltunnelFake("10.8.0.7"))
	if _, _, err := wgMiniAdd("vpn-proof2b", model.VpnKindRemote); err == nil || !strings.Contains(err.Error(), "ops-wg-mini-install") {
		t.Errorf("wgMiniAdd(remote, conf full-tunnel v2) : attendu le refus ops-wg-mini-install, eu %v", err)
	}

	// fulltunnel conforme : accepté.
	wgMiniCallFn = respond(confFulltunnelFake("10.8.0.8"))
	if _, _, err := wgMiniAdd("vpn-proof3", model.VpnKindFullTunnel); err != nil {
		t.Errorf("wgMiniAdd(fulltunnel conforme) : %v", err)
	}

	// fulltunnel sans 0.0.0.0/0 : refus (la preuve protège les DEUX formes).
	wgMiniCallFn = respond(confRemoteFake("10.8.0.8"))
	if _, _, err := wgMiniAdd("vpn-proof4", model.VpnKindFullTunnel); err == nil {
		t.Error("wgMiniAdd(fulltunnel, conf sans 0.0.0.0/0) : attendu un refus, eu nil")
	}

	// Kind inconnu : refus SANS aucun appel réseau.
	called := false
	wgMiniCallFn = func(method, path string, payload any) ([]byte, error) {
		called = true
		return json.Marshal(map[string]any{"ok": true, "conf": confRemoteFake("10.8.0.7")})
	}
	if _, _, err := wgMiniAdd("vpn-proof5", "bogus"); err == nil {
		t.Error("wgMiniAdd(kind inconnu) : attendu un refus, eu nil")
	}
	if called {
		t.Error("wgMiniAdd(kind inconnu) ne doit JAMAIS atteindre le réseau")
	}
}

// wgMiniCallRecorder — « VM » de test : remplace wgMiniCallFn SEUL — la
// VRAIE chaîne tourne (handler → wgMiniAdd + PREUVE PAR LA CONF → appel
// signé simulé) ; l'enregistreur capture kinds demandés et removes exécutés.
type wgMiniCallRecorder struct {
	mu      sync.Mutex
	adds    []string // kinds demandés via /v1/add
	removes []string // noms passés à /v1/remove
	conf    string   // conf que la « VM » rend
	err     error    // si non nil : échec réseau simulé
}

func (rec *wgMiniCallRecorder) call(method, path string, payload any) ([]byte, error) {
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if rec.err != nil {
		return nil, rec.err
	}
	kind := ""
	if m, ok := payload.(map[string]string); ok {
		kind = m["kind"]
		switch path {
		case "/v1/add":
			rec.adds = append(rec.adds, kind)
		case "/v1/remove":
			rec.removes = append(rec.removes, m["name"])
		}
	}
	return json.Marshal(map[string]any{"ok": true, "conf": rec.conf, "ip": "10.8.2.7", "kind": kind})
}

func (rec *wgMiniCallRecorder) snapshot() (adds, removes []string) {
	rec.mu.Lock()
	defer rec.mu.Unlock()
	return append([]string{}, rec.adds...), append([]string{}, rec.removes...)
}

// installWgMiniVM — branche l'enregistreur comme VM (restauré par t.Cleanup).
func installWgMiniVM(t *testing.T, conf string) *wgMiniCallRecorder {
	t.Helper()
	old := wgMiniCallFn
	rec := &wgMiniCallRecorder{conf: conf}
	t.Cleanup(func() { wgMiniCallFn = old })
	wgMiniCallFn = rec.call
	return rec
}

// ---------------------------------------------------------------------------
// POST /api/vpn/peers {kind:"remote"} — création + élargissement
// ---------------------------------------------------------------------------

func TestVpnPeerCreateRemote(t *testing.T) {
	a, st := newVpnRemoteTest(t)
	// La VRAIE chaîne : wgMiniAdd (preuve comprise) au-dessus de la VM simulée.
	rec := installWgMiniVM(t, confRemoteFake("10.8.0.7"))

	st.Lock()
	db := st.Data()
	enableVpnModule(db, "acc-a")
	db.Routers = []model.Router{remoteTestRouter("r-ok", "acc-a", "10.8.0.2")}
	st.Save()
	st.Unlock()

	rec2 := httptest.NewRecorder()
	a.handleVpnPeerCreate(rec2, reqWithClaims(http.MethodPost, "/api/vpn/peers",
		`{"label":"Téléphone du gérant","kind":"remote","salePrice":0}`, "acc-a"))
	if rec2.Code != http.StatusOK {
		t.Fatalf("création remote : HTTP %d — %s", rec2.Code, rec2.Body.String())
	}
	adds, removes := rec.snapshot()
	if len(adds) != 1 || adds[0] != model.VpnKindRemote {
		t.Errorf("kind transmis à wg-mini = %v, attendu [remote]", adds)
	}
	if len(removes) != 0 {
		t.Errorf("aucun nettoyage attendu (succès), eu %v", removes)
	}

	var out model.VpnPeer
	if err := json.Unmarshal(rec2.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.Kind != model.VpnKindRemote || out.State != model.VpnStateActive || out.IPv4 != "10.8.2.7" {
		t.Fatalf("peer créé inattendu : %+v", out)
	}

	// Le wg_setup élargi part AU routeur actif du compte (≤ 45 s).
	st.Lock()
	db = st.Data()
	if len(db.VpnPeers) != 1 || db.VpnPeers[0].Kind != model.VpnKindRemote {
		t.Fatalf("registre : %+v", db.VpnPeers)
	}
	var fresh *model.Command
	for i := range db.Commands {
		if db.Commands[i].Kind == model.CmdWgSetup {
			fresh = &db.Commands[i]
		}
	}
	if fresh == nil || fresh.RouterID != "r-ok" {
		t.Fatalf("wg_setup non re-filé au routeur actif : %+v", db.Commands)
	}
	if got, _ := fresh.Payload["allowedSources"].(string); got != "10.8.0.1/32,10.8.2.7/32" {
		t.Fatalf("allowedSources = %q, attendu socle + IP nouvelle du segment remote", got)
	}
	if db.Routers[0].WgState != "pending_setup" {
		t.Errorf("routeur cible : état %q, attendu pending_setup", db.Routers[0].WgState)
	}
	st.Unlock()
}

// TestVpnPeerCreateRemoteOldWgMini — dégradation honnête : la VM antérieure
// rend une conf full-tunnel pour une demande remote → la PREUVE PAR LA CONF
// (wgMiniAdd, chaîne réelle) refuse → 502, ligne « error », peer VM nettoyé,
// AUCUN wg_setup filé (le trompe-l'œil ne se déploie pas).
func TestVpnPeerCreateRemoteOldWgMini(t *testing.T) {
	a, st := newVpnRemoteTest(t)
	// VM « v2 » : ignore le kind et rend TOUJOURS une conf full-tunnel.
	rec := installWgMiniVM(t, confFulltunnelFake("10.8.0.7"))

	st.Lock()
	db := st.Data()
	enableVpnModule(db, "acc-a")
	db.Routers = []model.Router{remoteTestRouter("r-ok", "acc-a", "10.8.0.2")}
	st.Save()
	st.Unlock()

	rec2 := httptest.NewRecorder()
	a.handleVpnPeerCreate(rec2, reqWithClaims(http.MethodPost, "/api/vpn/peers",
		`{"kind":"remote"}`, "acc-a"))

	if rec2.Code != http.StatusBadGateway {
		t.Fatalf("attendu 502 wg_mini_error, eu HTTP %d — %s", rec2.Code, rec2.Body.String())
	}
	if !strings.Contains(rec2.Body.String(), "ops-wg-mini-install") {
		t.Errorf("le message doit porter la consigne exploitant : %s", rec2.Body.String())
	}
	// Nettoyage VM (goroutine, via le VRAI wgMiniRemove) : converger sous 2 s.
	_, removes := rec.snapshot()
	for i := 0; i < 100 && len(removes) == 0; i++ {
		time.Sleep(20 * time.Millisecond)
		_, removes = rec.snapshot()
	}
	if len(removes) != 1 || !strings.HasPrefix(removes[0], "vpn-") {
		t.Fatalf("nettoyage VM attendu (1 peer vpn-*), eu %v", removes)
	}
	st.Lock()
	db = st.Data()
	if len(db.VpnPeers) != 1 || db.VpnPeers[0].State != model.VpnStateError {
		t.Fatalf("ligne attendue en « error » (nettoyage cloud du geste), eu %+v", db.VpnPeers)
	}
	if len(db.Commands) != 0 {
		t.Fatalf("AUCUN wg_setup ne doit partir sur un refus, eu %d commande(s)", len(db.Commands))
	}
	st.Unlock()
}

// TestVpnPeerCreateKindInconnu — toute forme hors fulltunnel|remote : 400
// vpn_kind_unavailable, aucune ligne, aucun appel réseau.
func TestVpnPeerCreateKindInconnu(t *testing.T) {
	a, st := newVpnRemoteTest(t)
	rec := installWgMiniVM(t, confRemoteFake("10.8.0.7"))

	st.Lock()
	db := st.Data()
	enableVpnModule(db, "acc-a")
	st.Save()
	st.Unlock()

	rec2 := httptest.NewRecorder()
	a.handleVpnPeerCreate(rec2, reqWithClaims(http.MethodPost, "/api/vpn/peers",
		`{"kind":"halfpipe"}`, "acc-a"))
	if rec2.Code != http.StatusBadRequest || !strings.Contains(rec2.Body.String(), "vpn_kind_unavailable") {
		t.Fatalf("attendu 400 vpn_kind_unavailable, eu HTTP %d — %s", rec2.Code, rec2.Body.String())
	}
	adds, removes := rec.snapshot()
	if len(adds)+len(removes) != 0 {
		t.Errorf("aucun appel wg-mini ne doit partir pour une forme inconnue, eu adds=%v removes=%v", adds, removes)
	}
	st.Lock()
	if len(st.Data().VpnPeers) != 0 {
		t.Error("aucune ligne ne doit exister pour une forme inconnue")
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Révocation remote — re-livraison avec la liste RÉDUITE
// ---------------------------------------------------------------------------

func TestVpnPeerRevokeRemoteRelay(t *testing.T) {
	a, st := newVpnRemoteTest(t)
	rec := installWgMiniVM(t, confRemoteFake("10.8.0.7"))

	st.Lock()
	db := st.Data()
	enableVpnModule(db, "acc-a")
	db.Routers = []model.Router{remoteTestRouter("r-ok", "acc-a", "10.8.0.2")}
	db.VpnPeers = []model.VpnPeer{{
		ID: "vp-r1", AccountID: "acc-a", Name: "vpn-remote1111", Label: "Gérant",
		Kind: model.VpnKindRemote, IPv4: "10.8.2.7", State: model.VpnStateActive,
		Conf: confRemoteFake("10.8.2.7"), CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	}}
	st.Save()
	st.Unlock()

	rec2 := httptest.NewRecorder()
	req := reqWithClaims(http.MethodPost, "/api/vpn/peers/vp-r1/revoke", "", "acc-a")
	req.SetPathValue("id", "vp-r1")
	a.handleVpnPeerRevoke(rec2, req)

	if rec2.Code != http.StatusOK {
		t.Fatalf("révocation remote : HTTP %d — %s", rec2.Code, rec2.Body.String())
	}
	_, removes := rec.snapshot()
	if len(removes) != 1 || removes[0] != "vpn-remote1111" {
		t.Errorf("remove wg-mini attendu pour vpn-remote1111, eu %v", removes)
	}
	st.Lock()
	db = st.Data()
	if len(db.VpnPeers) != 0 {
		t.Fatalf("peer attendu retiré du registre, eu %+v", db.VpnPeers)
	}
	var fresh *model.Command
	for i := range db.Commands {
		if db.Commands[i].Kind == model.CmdWgSetup {
			fresh = &db.Commands[i]
		}
	}
	if fresh == nil || fresh.RouterID != "r-ok" {
		t.Fatalf("wg_setup d'hygiène non re-filé après révocation : %+v", db.Commands)
	}
	// Liste RÉDUITE : socle seul (l'IP révoquée ne doit plus y figurer).
	if got, _ := fresh.Payload["allowedSources"].(string); got != "10.8.0.1/32" {
		t.Fatalf("allowedSources après révocation = %q, attendu le socle seul", got)
	}
	st.Unlock()
}
