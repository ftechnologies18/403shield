// handlers_tunnel_pro_test.go — N°315 — tests de l'ACCÈS PRO + LAN étendu
// (offre « Pro » de la console 403Shield, design D-B1).
//
// Couverture :
//   - GET /api/tunnel/pro : éligibilité (compte gérant + routeur agent),
//     état LAN par routeur (WgLan appliqué, détection, règles), portefeuille
//     Pro, formules famille pro ; 401 session fantôme, 403 rôle console ;
//   - POST /api/tunnel/pro/order : refus honnête hors éligibilité (403),
//     formule b2c refusée (famille VERROUILLÉE), honeypot (zéro ligne),
//     succès canal manual (kind pro) ;
//   - provisionPublicVpnOrder chemin PRO : peer « remote » sous le COMPTE
//     GÉRANT (jamais AccountMain — isolation D-B2), wg_setup re-filé aux
//     routeurs agents, LAN appliqué (set-lan VM + commande wg_lan + conf
//     étendue — preuve par la conf), e-mail vpn_pro avec la conf FRAÎCHE ;
//   - renouvellement : garde de famille (formule b2c sur un Pro → 400),
//     dégénérescence d'une renewal Pro qui RESTE Pro (jamais fulltunnel) ;
//   - POST /api/tunnel/pro/lan : application complète depuis une détection
//     convergée (WgLan posé APRÈS succès VM, wg_lan enfilé avec le périmètre
//     peers Pro, conf chiffrée REMPLACÉE), pas de détection → enfile
//     wg_lan_detect, sans Pro vivant → découverte seule (needPro), collision
//     VM → 502 honnête et WgLan JAMAIS posé ;
//   - POST /api/tunnel/pro/detect : enfile la lecture pure, déjà appliqué →
//     no-op idempotent, routeur d'un autre compte → 404 (anti-énumération) ;
//   - vitrine /vpn : formule pro REFUSÉE (canal séparé, doctrine N°301) ;
//   - routes Pro : 401 sans JWT (bout en bout sur le mux réel).
//
// AUCUNE connexion réseau réelle : stubs + indirections (discipline maison).
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Harnais spécifique Accès Pro
// ---------------------------------------------------------------------------

// proKey — clé publique WireGuard factice (44 caractères base64, « = » final).
const proKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

// tunnelProSeed — le décor complet d'un gérant éligible : compte actif
// apparié par e-mail + routeur agent au tunnel ACTIF (les paramètres wg
// complets permettent le re-file wg_setup) + client tunnel du même e-mail.
func tunnelProSeed(db *model.DB) {
	db.Accounts = append(db.Accounts, model.Account{
		ID: "acc-pro", Name: "Café Pro", Status: "active", Email: "gerant@example.com",
	})
	db.Routers = append(db.Routers, model.Router{
		ID: "r-pro", AccountID: "acc-pro", Name: "Routeur Café",
		Mode: "agent", Status: "online",
		WgState: "active", WgPeerName: "r-cafe", WgIPv4: "10.8.0.5",
		WgServerPub: proKey, WgPSK: proKey, WgEndpoint: "203.0.113.10:51820",
	})
	tunnelSeedClient(db, "tc-1", "gerant@example.com")
}

// tunnelProSeedOrder — commande Pro provisionnée + peer remote vivant sous
// le compte (le décor d'un Accès Pro déjà actif).
func tunnelProSeedOrder(db *model.DB, id, ref string, expiresAt string) (*model.PublicVpnOrder, *model.VpnPeer) {
	db.PublicVpnOrders = append(db.PublicVpnOrders, model.PublicVpnOrder{
		ID: id, Ref: ref, Email: "gerant@example.com", PlanID: model.PublicVpnProPlanMonthID,
		Months: 1, BaseAmountFcfa: 3500, AmountFcfa: 3500, PayMethod: "manual",
		Kind: model.PublicVpnKindPro, Status: model.PublicVpnOrderProvisioned,
		ExpiresAt: expiresAt, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	order := &db.PublicVpnOrders[len(db.PublicVpnOrders)-1]
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-pro1", AccountID: "acc-pro", Name: "vpn-pro0001",
		Kind: model.VpnKindRemote, State: model.VpnStateActive,
		IPv4: "10.8.2.7", Conf: confRemoteFake("10.8.2.7"),
	})
	peer := &db.VpnPeers[len(db.VpnPeers)-1]
	order.PeerID = peer.ID
	order.PeerName = peer.Name
	return order, peer
}

// tunnelProSeedDetect — une détection wg_lan_detect CONVERGÉE (done) avec
// son rapport (lan + iface) — pattern « vérité dans Command.Result ».
func tunnelProSeedDetect(db *model.DB, routerID, lan string) {
	db.Commands = append(db.Commands, model.Command{
		ID: "cmd-detect1", RouterID: routerID, AccountID: "acc-pro",
		Kind: model.CmdWgLanDetect, Status: "done",
		Result: map[string]any{"lan": lan, "iface": "bridge-lan"},
	})
}

// tunnelProReq — requête authentifiée rôle tunnel avec le segment
// {routerId} posé à la main (appels directs hors mux — discipline N°314).
func tunnelProReq(method, target string, claims *auth.Claims, body string) *http.Request {
	req := tunnelAuthReq(method, target, claims, body)
	if i := strings.Index(target, "/pro/lan/"); i != -1 {
		req.SetPathValue("routerId", strings.TrimPrefix(target[i+len("/pro/lan/"):], "/"))
	}
	return req
}

// proSetLanRecorder — stub wgMiniSetLanFn qui enregistre les appels.
func proSetLanRecorder(err error) (*[][2]string, func()) {
	calls := &[][2]string{}
	old := wgMiniSetLanFn
	wgMiniSetLanFn = func(name, lan string) error {
		*calls = append(*calls, [2]string{name, lan})
		return err
	}
	return calls, func() { wgMiniSetLanFn = old }
}

// ---------------------------------------------------------------------------
// Statut Pro
// ---------------------------------------------------------------------------

func TestTunnelProStatus(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	// Un LAN déjà appliqué sur le routeur + une détection convergée pour un
	// second décor (état complet affiché d'un seul appel).
	db.Routers[0].WgLan = "192.168.88.0/24"
	tunnelProSeedDetect(db, "r-pro", "192.168.88.0/24")
	tunnelProSeedOrder(db, "o-pro", "MCV-PRO00001", "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	rec := httptest.NewRecorder()
	a.handleTunnelProStatus(rec, tunnelProReq(http.MethodGet, "/api/tunnel/pro", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("pro status : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Email     string           `json:"email"`
		Eligible  bool             `json:"eligible"`
		Scope     string           `json:"scope"`
		AnyActive bool             `json:"anyActive"`
		Routers   []map[string]any `json:"routers"`
		ProOrders []map[string]any `json:"proOrders"`
		Plans     []map[string]any `json:"plans"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !out.Eligible || out.Scope != "phase3" || out.Email != "gerant@example.com" {
		t.Fatalf("éligibilité/scope inattendus : %+v", out)
	}
	if !out.AnyActive || len(out.ProOrders) != 1 || out.ProOrders[0]["peerIpv4"] != "10.8.2.7" {
		t.Fatalf("portefeuille Pro inattendu : %+v", out.ProOrders)
	}
	if len(out.Routers) != 1 || out.Routers[0]["lanApplied"] != true || out.Routers[0]["wgLan"] != "192.168.88.0/24" {
		t.Fatalf("état LAN du routeur inattendu : %+v", out.Routers)
	}
	detect, _ := out.Routers[0]["lanDetect"].(map[string]any)
	if detect == nil || detect["state"] != "done" || detect["lan"] != "192.168.88.0/24" || detect["valid"] != true {
		t.Fatalf("détection attendue dans le statut : %+v", out.Routers[0])
	}
	if len(out.Plans) != 2 {
		t.Fatalf("formules famille pro attendues : 2, eu %d", len(out.Plans))
	}

	// 401 : session fantôme (client disparu).
	rec = httptest.NewRecorder()
	a.handleTunnelProStatus(rec, tunnelProReq(http.MethodGet, "/api/tunnel/pro", &auth.Claims{Sub: "tc-ghost", Role: "tunnel"}, ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("session fantôme : HTTP %d attendu 401", rec.Code)
	}
	// 403 : rôle console (l'espace tunnel n'est PAS la console).
	rec = httptest.NewRecorder()
	a.handleTunnelProStatus(rec, tunnelProReq(http.MethodGet, "/api/tunnel/pro", &auth.Claims{Sub: "u-x", Role: "admin"}, ""))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("rôle console : HTTP %d attendu 403", rec.Code)
	}
}

// TestTunnelProStatusNotEligible — sans compte gérant apparié : éligible
// faux, AUCUNE fuite de routeurs (la réponse reste honnête et vide).
func TestTunnelProStatusNotEligible(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "consommateur@example.com")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleTunnelProStatus(rec, tunnelProReq(http.MethodGet, "/api/tunnel/pro", &auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("pro status : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Eligible bool             `json:"eligible"`
		Routers  []map[string]any `json:"routers"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Eligible || len(out.Routers) != 0 {
		t.Fatalf("non-éligible attendu (aucun routeur exposé) : %+v", out)
	}
}

// ---------------------------------------------------------------------------
// Commande Pro
// ---------------------------------------------------------------------------

func TestTunnelProOrder(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	settings := ensureSettings(db, model.AccountMainID)
	if settings.Platform == nil {
		settings.Platform = &model.PlatformConfig{}
	}
	shopOn := true
	settings.Platform.PublicVpnShop = &shopOn
	db.SettingsByAccount[model.AccountMainID] = settings
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	// 1. Formule b2c sur le canal Pro : refusée (famille VERROUILLÉE).
	rec := httptest.NewRecorder()
	a.handleTunnelProOrder(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/order", claims,
		`{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "vitrine 403Shield") {
		t.Fatalf("formule b2c : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// 2. Honeypot : succès factice, zéro ligne créée.
	st.Lock()
	before := len(st.Data().PublicVpnOrders)
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelProOrder(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/order", claims,
		`{"planId":"vpn-pro-month","payMethod":"manual","website":"bot"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("honeypot : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if after := len(st.Data().PublicVpnOrders); after != before {
		t.Fatalf("honeypot : %d commandes créées (attendu 0 delta)", after-before)
	}
	st.Unlock()

	// 3. Succès (canal manual — pas de réseau GeniusPay en test) : kind pro.
	rec = httptest.NewRecorder()
	a.handleTunnelProOrder(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/order", claims,
		`{"planId":"vpn-pro-month","payMethod":"manual"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("order : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref    string `json:"ref"`
		Status string `json:"status"`
		Online bool   `json:"online"`
		PlanID string `json:"planId"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.Status != model.PublicVpnOrderPending || out.Online || out.PlanID != model.PublicVpnProPlanMonthID {
		t.Fatalf("commande inattendue : %+v", out)
	}
	st.Lock()
	order := model.FindPublicVpnOrderByRef(st.Data(), out.Ref)
	st.Unlock()
	if order == nil || order.Kind != model.PublicVpnKindPro || order.BaseAmountFcfa != 3500 {
		t.Fatalf("commande kind pro attendue (3500 FCFA) : %+v", order)
	}
}

// TestTunnelProOrderIneligible — sans compte gérant : refus honnête AVANT
// tout encaissement (on ne vend pas un Accès Pro qui ne superviserait rien).
func TestTunnelProOrderIneligible(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "consommateur@example.com")
	st.Save()
	st.Unlock()
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	rec := httptest.NewRecorder()
	a.handleTunnelProOrder(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/order", &auth.Claims{Sub: "tc-1", Role: "tunnel"},
		`{"planId":"vpn-pro-month","payMethod":"manual"}`))
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "compte gérant") {
		t.Fatalf("non-éligible : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if n := len(st.Data().PublicVpnOrders); n != 0 {
		t.Fatalf("zéro commande attendue, eu %d", n)
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Provisioning Pro (convergence du paiement)
// ---------------------------------------------------------------------------

func TestPublicVpnProProvisioning(t *testing.T) {
	a, st := newTunnelTest(t)

	// VM stubs : add remote conforme (preuve par la conf v4+), set-lan OK,
	// lan-extend rend la conf étendue (vérité VM), remove muet.
	setLanCalls, restoreSetLan := proSetLanRecorder(nil)
	oldExtend, oldAdd, oldRemove := wgMiniLanExtendFn, wgMiniAddFn, wgMiniRemoveFn
	wgMiniAddFn = func(name, kind string) (string, string, error) {
		if kind != model.VpnKindRemote {
			t.Errorf("forme remote attendue pour une commande Pro, eu %q", kind)
		}
		return confRemoteFake("10.8.2.7"), "10.8.2.7", nil
	}
	wgMiniLanExtendFn = func(name, lan string) (string, string, error) {
		return confRemoteFake("10.8.2.7")[:strings.Index(confRemoteFake("10.8.2.7"), "AllowedIPs")] +
			"AllowedIPs = 10.8.0.0/24, 10.8.2.0/24, " + lan + "\nPersistentKeepalive = 25\n", "10.8.2.7", nil
	}
	wgMiniRemoveFn = func(name string) error { return nil }
	t.Cleanup(func() { wgMiniLanExtendFn, wgMiniAddFn, wgMiniRemoveFn = oldExtend, oldAdd, oldRemove; restoreSetLan() })

	// E-mail capturé (relais plateforme + stub d'envoi).
	var sent []sentEmail
	wgMail := stubAccountEmailCapture(t, &sent)

	st.Lock()
	db := st.Data()
	enableTunnelEmail(db)
	tunnelProSeed(db)
	// Le LAN est DÉJÀ détecté : le provisioning doit l'appliquer d'emblée.
	tunnelProSeedDetect(db, "r-pro", "192.168.88.0/24")
	// Commande Pro payée (le webhook/poll a convergé).
	db.PublicVpnOrders = append(db.PublicVpnOrders, model.PublicVpnOrder{
		ID: "o-pay", Ref: "MCV-PROPAY1", Email: "gerant@example.com", PlanID: model.PublicVpnProPlanMonthID,
		Months: 1, BaseAmountFcfa: 3500, AmountFcfa: 3500, PayMethod: "manual",
		Kind: model.PublicVpnKindPro, Status: model.PublicVpnOrderPaid,
		PaidAt: model.NowISO(), CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicVpnOrder("o-pay"); err != nil {
		t.Fatalf("provisioning Pro : %v", err)
	}
	st.Lock()
	db = st.Data()
	order := model.FindPublicVpnOrderByRef(db, "MCV-PROPAY1")
	if order.Status != model.PublicVpnOrderProvisioned || order.PeerID == "" {
		t.Fatalf("commande Pro attendue provisionnée avec peer : %+v", order)
	}
	peer := model.FindVpnPeerByID(db, order.PeerID)
	if peer == nil {
		t.Fatalf("peer Pro introuvable")
	}
	// ISOLATION D-B2 : le peer vit sous le COMPTE GÉRANT (jamais AccountMain).
	if peer.AccountID != "acc-pro" {
		t.Fatalf("peer Pro sous %q — attendu acc-pro (compte gérant apparié)", peer.AccountID)
	}
	if peer.Kind != model.VpnKindRemote || peer.State != model.VpnStateActive || peer.IPv4 != "10.8.2.7" {
		t.Fatalf("peer remote actif attendu : %+v", peer)
	}
	// La conf livrée est ÉTENDUE au LAN (preuve par la conf — 3e entrée).
	if !strings.Contains(peer.Conf, "AllowedIPs = 10.8.0.0/24, 10.8.2.0/24, 192.168.88.0/24") {
		t.Fatalf("conf Pro étendue attendue, eu :\n%s", peer.Conf)
	}
	// wg_setup re-filé au routeur agent (élargissement allowed-address D-B2).
	wgSetupQueued := false
	wgLanQueued := false
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.RouterID == "r-pro" && c.Kind == model.CmdWgSetup && c.Status == "queued" {
			wgSetupQueued = true
			// La liste allowedSources porte le peer Pro (supervision immédiate).
			if srcs, _ := c.Payload["allowedSources"].(string); !strings.Contains(srcs, "10.8.2.7/32") {
				t.Fatalf("allowedSources sans le peer Pro : %q", srcs)
			}
		}
		if c.RouterID == "r-pro" && c.Kind == model.CmdWgLan && c.Status == "queued" {
			wgLanQueued = true
			if lan, _ := c.Payload["lan"].(string); lan != "192.168.88.0/24" {
				t.Fatalf("payload wg_lan inattendu : %q", lan)
			}
			if peers, _ := c.Payload["peers"].(string); !strings.Contains(peers, "10.8.2.7") {
				t.Fatalf("périmètre wg_lan sans le peer Pro : %q", peers)
			}
		}
	}
	if !wgSetupQueued || !wgLanQueued {
		t.Fatalf("wg_setup (%v) et wg_lan (%v) attendus en file", wgSetupQueued, wgLanQueued)
	}
	// La mémoire cloud du LAN est posée (APRÈS succès VM).
	if db.Routers[0].WgLan != "192.168.88.0/24" {
		t.Fatalf("WgLan attendu sur le routeur, eu %q", db.Routers[0].WgLan)
	}
	st.Unlock()

	// set-lan bien appelé avec le peer routeur de la VM.
	if len(*setLanCalls) == 0 || (*setLanCalls)[0] != [2]string{"r-cafe", "192.168.88.0/24"} {
		t.Fatalf("set-lan attendu (r-cafe, 192.168.88.0/24), eu %+v", *setLanCalls)
	}

	// E-mail de livraison Pro : conf fraîche (étendue), kind vpn_pro.
	wgMail.Wait()
	found := false
	for _, m := range sent {
		if strings.Contains(m.title, "Accès Pro") && strings.Contains(m.body, "192.168.88.0/24") {
			found = true
		}
	}
	if !found {
		t.Fatalf("e-mail Accès Pro avec conf étendue attendu, eu %d envois", len(sent))
	}
}

// TestPublicVpnProProvisioningWithoutLan — LAN inconnu au paiement : le
// provisioning réussit quand même (supervision immédiate), la conf reste à
// DEUX segments et l'e-mail porte la consigne honnête d'activation.
func TestPublicVpnProProvisioningWithoutLan(t *testing.T) {
	a, st := newTunnelTest(t)
	setLanCalls, restoreSetLan := proSetLanRecorder(nil)
	oldAdd, oldRemove := wgMiniAddFn, wgMiniRemoveFn
	wgMiniAddFn = func(name, kind string) (string, string, error) {
		return confRemoteFake("10.8.2.8"), "10.8.2.8", nil
	}
	wgMiniRemoveFn = func(name string) error { return nil }
	t.Cleanup(func() { wgMiniAddFn, wgMiniRemoveFn = oldAdd, oldRemove; restoreSetLan() })

	var sent []sentEmail
	wgMail := stubAccountEmailCapture(t, &sent)

	st.Lock()
	db := st.Data()
	enableTunnelEmail(db)
	tunnelProSeed(db)
	// AUCUNE détection : le routeur n'a pas encore rapporté son LAN.
	db.PublicVpnOrders = append(db.PublicVpnOrders, model.PublicVpnOrder{
		ID: "o-pay2", Ref: "MCV-PROPAY2", Email: "gerant@example.com", PlanID: model.PublicVpnProPlanMonthID,
		Months: 1, BaseAmountFcfa: 3500, AmountFcfa: 3500, PayMethod: "manual",
		Kind: model.PublicVpnKindPro, Status: model.PublicVpnOrderPaid,
		PaidAt: model.NowISO(), CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicVpnOrder("o-pay2"); err != nil {
		t.Fatalf("provisioning Pro sans LAN : %v", err)
	}
	st.Lock()
	db = st.Data()
	order := model.FindPublicVpnOrderByRef(db, "MCV-PROPAY2")
	peer := model.FindVpnPeerByID(db, order.PeerID)
	if !strings.Contains(peer.Conf, "AllowedIPs = 10.8.0.0/24, 10.8.2.0/24") || strings.Count(peer.Conf, "/24") != 2 {
		t.Fatalf("conf à DEUX segments attendue sans LAN connu :\n%s", peer.Conf)
	}
	if db.Routers[0].WgLan != "" {
		t.Fatalf("WgLan doit rester vide (rien à appliquer)")
	}
	st.Unlock()
	if len(*setLanCalls) != 0 {
		t.Fatalf("aucun set-lan attendu sans LAN connu, eu %+v", *setLanCalls)
	}
	wgMail.Wait()
	// L'e-mail porte la consigne d'activation (honnêteté produit).
	hinted := false
	for _, m := range sent {
		if strings.Contains(m.body, "tendre au LAN") {
			hinted = true
		}
	}
	if !hinted {
		t.Fatalf("consigne d'activation LAN attendue dans l'e-mail Pro")
	}
}

// ---------------------------------------------------------------------------
// Renouvellement Pro : famille verrouillée + dégénérescence honnête
// ---------------------------------------------------------------------------

func TestTunnelProRenewFamilyGuard(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro", "MCV-PRO00001", "2999-01-01T00:00:00Z")
	settings := ensureSettings(db, model.AccountMainID)
	if settings.Platform == nil {
		settings.Platform = &model.PlatformConfig{}
	}
	shopOn := true
	settings.Platform.PublicVpnShop = &shopOn
	db.SettingsByAccount[model.AccountMainID] = settings
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	// Formule b2c sur un accès Pro : refusée (prix ET produit).
	rec := httptest.NewRecorder()
	a.handleTunnelRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-PRO00001/renew", claims,
		`{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "formule Pro") {
		t.Fatalf("renouvellement croisé b2c→Pro : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Formule Pro : renouvellement créé (kind renewal, cible Pro).
	rec = httptest.NewRecorder()
	a.handleTunnelRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-PRO00001/renew", claims,
		`{"planId":"vpn-pro-month","payMethod":"manual"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("renouvellement Pro : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	latest := &st.Data().PublicVpnOrders[len(st.Data().PublicVpnOrders)-1]
	if latest.Kind != model.PublicVpnKindRenewal || latest.RenewTargetRef != "MCV-PRO00001" {
		t.Fatalf("renewal Pro attendue : %+v", latest)
	}
	st.Unlock()
}

func TestPublicVpnProRenewalDegeneratesToProSale(t *testing.T) {
	a, st := newTunnelTest(t)
	oldAdd, oldRemove, oldExtend := wgMiniAddFn, wgMiniRemoveFn, wgMiniLanExtendFn
	wgMiniAddFn = func(name, kind string) (string, string, error) {
		if kind != model.VpnKindRemote {
			t.Errorf("forme remote attendue (dégénérescence Pro→Pro), eu %q", kind)
		}
		return confRemoteFake("10.8.2.9"), "10.8.2.9", nil
	}
	wgMiniRemoveFn = func(name string) error { return nil }
	wgMiniLanExtendFn = func(name, lan string) (string, string, error) { return "", "", nil }
	t.Cleanup(func() { wgMiniAddFn, wgMiniRemoveFn, wgMiniLanExtendFn = oldAdd, oldRemove, oldExtend })

	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	// Cible Pro MORTE (expirée + peer révoqué).
	tunnelProSeedOrder(db, "o-dead", "MCV-PRODEAD1", "2020-01-01T00:00:00Z")
	st.Data().PublicVpnOrders[0].Status = model.PublicVpnOrderExpired
	st.Data().VpnPeers = nil
	// Renewal Pro payée visant la cible morte.
	db.PublicVpnOrders = append(db.PublicVpnOrders, model.PublicVpnOrder{
		ID: "o-rene", Ref: "MCV-PRORNE1", Email: "gerant@example.com", PlanID: model.PublicVpnProPlanMonthID,
		Months: 1, BaseAmountFcfa: 3500, AmountFcfa: 3500, PayMethod: "manual",
		Kind: model.PublicVpnKindRenewal, RenewTargetRef: "MCV-PRODEAD1",
		Status: model.PublicVpnOrderPaid, PaidAt: model.NowISO(),
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicVpnOrder("o-rene"); err != nil {
		t.Fatalf("dégénérescence Pro : %v", err)
	}
	st.Lock()
	renewal := model.FindPublicVpnOrderByRef(st.Data(), "MCV-PRORNE1")
	if renewal.Status != model.PublicVpnOrderProvisioned {
		t.Fatalf("renewal dégénérée attendue provisioned, eu %s", renewal.Status)
	}
	// La famille est PRÉSERVÉE : vente Pro (remote), jamais fulltunnel B2C.
	if renewal.Kind != model.PublicVpnKindPro {
		t.Fatalf("dégénérescence en vente PRO attendue, eu %q", renewal.Kind)
	}
	peer := model.FindVpnPeerByID(st.Data(), renewal.PeerID)
	if peer == nil || peer.Kind != model.VpnKindRemote || peer.AccountID != "acc-pro" {
		t.Fatalf("peer Pro remplacé attendu sous le compte gérant : %+v", peer)
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Application du LAN étendu (activation manuelle dans l'espace)
// ---------------------------------------------------------------------------

func TestTunnelProLanApply(t *testing.T) {
	a, st := newTunnelTest(t)
	setLanCalls, restoreSetLan := proSetLanRecorder(nil)
	oldExtend := wgMiniLanExtendFn
	wgMiniLanExtendFn = func(name, lan string) (string, string, error) {
		return "[Interface]\nPrivateKey = k\nAddress = 10.8.2.7/32, fd00:8:2::7/128\nMTU = 1420\n\n[Peer]\nPublicKey = k\nPresharedKey = k\nEndpoint = 203.0.113.10:51820\nAllowedIPs = 10.8.0.0/24, 10.8.2.0/24, " + lan + "\nPersistentKeepalive = 25\n", "10.8.2.7", nil
	}
	t.Cleanup(func() { wgMiniLanExtendFn = oldExtend; restoreSetLan() })

	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro", "MCV-PRO00001", "2999-01-01T00:00:00Z")
	// Détection convergée mais JAMAIS appliquée (WgLan vide).
	tunnelProSeedDetect(db, "r-pro", "192.168.88.0/24")
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	rec := httptest.NewRecorder()
	a.handleTunnelProLan(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/lan/r-pro", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("lan apply : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Applied bool     `json:"applied"`
		Lan     string   `json:"lan"`
		Peers   []string `json:"peers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !out.Applied || out.Lan != "192.168.88.0/24" || len(out.Peers) != 1 || out.Peers[0] != "10.8.2.7" {
		t.Fatalf("application inattendue : %+v", out)
	}
	// set-lan appelé avec le peer routeur VM + la mémoire cloud posée.
	if len(*setLanCalls) != 1 || (*setLanCalls)[0] != [2]string{"r-cafe", "192.168.88.0/24"} {
		t.Fatalf("set-lan inattendu : %+v", *setLanCalls)
	}
	st.Lock()
	db = st.Data()
	if db.Routers[0].WgLan != "192.168.88.0/24" {
		t.Fatalf("WgLan attendu après application, eu %q", db.Routers[0].WgLan)
	}
	// wg_lan enfilé avec le périmètre peers Pro.
	found := false
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.Kind == model.CmdWgLan && c.RouterID == "r-pro" {
			found = true
			if lan, _ := c.Payload["lan"].(string); lan != "192.168.88.0/24" {
				t.Fatalf("payload lan inattendu : %q", lan)
			}
		}
	}
	if !found {
		t.Fatalf("commande wg_lan attendue en file")
	}
	// La copie chiffrée du peer est REMPLACÉE par la vérité VM (preuve).
	peer := model.FindVpnPeerByID(db, "vp-pro1")
	if !strings.Contains(peer.Conf, ", 192.168.88.0/24") {
		t.Fatalf("conf du peer Pro étendue attendue :\n%s", peer.Conf)
	}
	st.Unlock()
}

// TestTunnelProLanQueuesDetect — aucune détection : la demande enfile
// wg_lan_detect (l'application viendra après convergence agent).
func TestTunnelProLanQueuesDetect(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro", "MCV-PRO00001", "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	rec := httptest.NewRecorder()
	a.handleTunnelProLan(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/lan/r-pro", &auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusAccepted || !strings.Contains(rec.Body.String(), "queued") {
		t.Fatalf("détection attendue en fil : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	queued := false
	for i := range st.Data().Commands {
		if st.Data().Commands[i].Kind == model.CmdWgLanDetect && st.Data().Commands[i].RouterID == "r-pro" {
			queued = true
		}
	}
	st.Unlock()
	if !queued {
		t.Fatalf("wg_lan_detect attendue en file")
	}
}

// TestTunnelProLanNeedPro — LAN détecté mais AUCUN Pro vivant : découverte
// seule (pré-achat honnête), la mémoire cloud n'est PAS posée.
func TestTunnelProLanNeedPro(t *testing.T) {
	a, st := newTunnelTest(t)
	setLanCalls, restoreSetLan := proSetLanRecorder(nil)
	t.Cleanup(restoreSetLan)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedDetect(db, "r-pro", "192.168.88.0/24")
	st.Save()
	st.Unlock()
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	rec := httptest.NewRecorder()
	a.handleTunnelProLan(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/lan/r-pro", &auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("découverte seule : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Applied bool   `json:"applied"`
		NeedPro bool   `json:"needPro"`
		Lan     string `json:"lan"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Applied || !out.NeedPro || out.Lan != "192.168.88.0/24" {
		t.Fatalf("découverte pré-achat attendue : %+v", out)
	}
	if len(*setLanCalls) != 0 {
		t.Fatalf("aucun set-lan sans Pro vivant, eu %+v", *setLanCalls)
	}
	st.Lock()
	if st.Data().Routers[0].WgLan != "" {
		t.Fatalf("WgLan ne doit PAS être posé sans application")
	}
	st.Unlock()
}

// TestTunnelProLanCollision — refus VM (collision LAN) : 502 honnête et la
// mémoire cloud JAMAIS posée (la colonne reste un statut VÉRIDIQUE).
func TestTunnelProLanCollision(t *testing.T) {
	a, st := newTunnelTest(t)
	_, restoreSetLan := proSetLanRecorder(errors.New("192.168.88.0/24 déjà routé vers le routeur 'r-autre'"))
	t.Cleanup(restoreSetLan)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	tunnelProSeedOrder(db, "o-pro", "MCV-PRO00001", "2999-01-01T00:00:00Z")
	tunnelProSeedDetect(db, "r-pro", "192.168.88.0/24")
	st.Save()
	st.Unlock()
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	rec := httptest.NewRecorder()
	a.handleTunnelProLan(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/lan/r-pro", &auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusBadGateway || !strings.Contains(rec.Body.String(), "déjà routé") {
		t.Fatalf("collision : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if st.Data().Routers[0].WgLan != "" {
		t.Fatalf("WgLan ne doit JAMAIS être posé sur un échec VM (statut mensonger)")
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Détection + poll + isolation
// ---------------------------------------------------------------------------

func TestTunnelProDetect(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	// Un second routeur NON agent : la détection doit le refuser honnêtement.
	db.Routers = append(db.Routers, model.Router{ID: "r-sim", AccountID: "acc-pro", Name: "Simulé", Mode: "simulated", Status: "offline"})
	// Un routeur d'un AUTRE compte : anti-énumération (404 uniforme).
	db.Accounts = append(db.Accounts, model.Account{ID: "acc-other", Name: "Autre", Status: "active", Email: "autre@example.com"})
	db.Routers = append(db.Routers, model.Router{ID: "r-other", AccountID: "acc-other", Name: "Autre routeur", Mode: "agent", Status: "online"})
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}
	a.tunnelAction = newSignupLimiterLimits(200, 800)

	// Enfile la lecture pure sur le routeur agent.
	rec := httptest.NewRecorder()
	a.handleTunnelProDetect(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/detect", claims, `{"routerId":"r-pro"}`))
	if rec.Code != http.StatusAccepted || !strings.Contains(rec.Body.String(), "queued") {
		t.Fatalf("detect : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	// Routeur non agent : refus honnête (la commande ne convergerait jamais).
	rec = httptest.NewRecorder()
	a.handleTunnelProDetect(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/detect", claims, `{"routerId":"r-sim"}`))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("routeur simulé : HTTP %d attendu 400", rec.Code)
	}
	// Routeur d'un autre compte : 404 (anti-énumération).
	rec = httptest.NewRecorder()
	a.handleTunnelProDetect(rec, tunnelProReq(http.MethodPost, "/api/tunnel/pro/detect", claims, `{"routerId":"r-other"}`))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("routeur étranger : HTTP %d attendu 404", rec.Code)
	}
}

func TestTunnelProLanPoll(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelProSeed(db)
	// Détection convergée avec un réseau HORS périmètre (non RFC1918) : le
	// poll rapporte la valeur brute + valid faux + le message honnête.
	db.Commands = append(db.Commands, model.Command{
		ID: "cmd-d2", RouterID: "r-pro", AccountID: "acc-pro",
		Kind: model.CmdWgLanDetect, Status: "done",
		Result: map[string]any{"lan": "8.8.8.0/24", "iface": "ether2"},
	})
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	rec := httptest.NewRecorder()
	a.handleTunnelProLanPoll(rec, tunnelProReq(http.MethodGet, "/api/tunnel/pro/lan/r-pro", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("poll : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		State string `json:"state"`
		Lan   string `json:"lan"`
		Valid bool   `json:"valid"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.State != "done" || out.Lan != "8.8.8.0/24" || out.Valid {
		t.Fatalf("poll attendu done + lan brut + valid faux : %+v", out)
	}
	// Le poll est PUR : aucun WgLan posé, aucune nouvelle commande.
	st.Lock()
	if st.Data().Routers[0].WgLan != "" {
		t.Fatalf("le poll ne doit JAMAIS poser WgLan (lecture pure)")
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Vitrine : canal séparé (famille verrouillée aux deux bords)
// ---------------------------------------------------------------------------

func TestPublicVpnVitrineRefusesProPlan(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	settings := ensureSettings(db, model.AccountMainID)
	if settings.Platform == nil {
		settings.Platform = &model.PlatformConfig{}
	}
	shopOn := true
	settings.Platform.PublicVpnShop = &shopOn
	db.SettingsByAccount[model.AccountMainID] = settings
	st.Save()
	st.Unlock()

	req := tunnelPost("/api/public/vpn/order",
		`{"email":"client@example.com","planId":"vpn-pro-month","payMethod":"manual"}`)
	rec := httptest.NewRecorder()
	a.handlePublicVpnOrderCreate(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "réservée à la console 403Shield") {
		t.Fatalf("vitrine + formule pro : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	if n := len(st.Data().PublicVpnOrders); n != 0 {
		t.Fatalf("zéro commande attendue depuis la vitrine, eu %d", n)
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Routes Pro : authentification obligatoire (bout en bout sur le mux réel)
// ---------------------------------------------------------------------------

func TestTunnelProRoutesRequireAuth(t *testing.T) {
	a, _ := newTunnelTest(t)
	targets := []struct {
		method, path string
	}{
		{http.MethodGet, "/api/tunnel/pro"},
		{http.MethodPost, "/api/tunnel/pro/order"},
		{http.MethodGet, "/api/tunnel/pro/lan/r-x"},
		{http.MethodPost, "/api/tunnel/pro/lan/r-x"},
		{http.MethodPost, "/api/tunnel/pro/detect"},
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
