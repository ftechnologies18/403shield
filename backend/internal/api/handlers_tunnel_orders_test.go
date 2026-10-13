// handlers_tunnel_orders_test.go — N°314 — tests de la gestion des commandes
// B2C depuis la console tunnel (reveal + renouvellement) et du chemin
// « renewal » du provisioning (extension d'échéance sans nouveau peer).
//
// Couverture :
//   - POST /api/tunnel/orders/{ref}/reveal : 200 + conf (appariement e-mail
//     strict), self-healing wg-mini (copie cloud vide → conf fraîche
//     re-sauvegardée), une RENEWAL suit sa cible, anti-énumération (404 sur
//     e-mail divergent ≡ référence inconnue), 410 expirée, 401 session
//     fantôme, 403 rôle console ;
//   - POST /api/tunnel/orders/{ref}/renew : 200 (kind renewal, cible, montants
//     vitrine), bascule honnête manual sans clés GeniusPay, 404 e-mail
//     divergent, 409 cible non active, 400 validations, honeypot (succès
//     factice, zéro ligne créée), boutique fermée (403) ;
//   - provisionPublicVpnOrder chemin renewal : cible vivante → échéance
//     étendue au max(now, terme)+mois, ligne renewal provisionnée SANS peer
//     propre, e-mail de confirmation parti (kind vpn_renew, sans conf),
//     AUCUN nouveau peer posé ; cible morte → dégénérescence honnête en
//     vente (nouveau peer, conf neuve) ; idempotence (rejeu = no-op).
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

// tunnelSeedOrder — commande B2C minimale appartenant à un e-mail (status
// libre) avec peer lié optionnel.
func tunnelSeedOrder(db *model.DB, id, ref, email, status string, peerID string, expiresAt string) *model.PublicVpnOrder {
	db.PublicVpnOrders = append(db.PublicVpnOrders, model.PublicVpnOrder{
		ID: id, Ref: ref, Email: email, PlanID: model.PublicVpnPlanMonthID,
		Months: 1, BaseAmountFcfa: 1500, AmountFcfa: 1500, PayMethod: "manual",
		Status: status, PeerID: peerID, ExpiresAt: expiresAt,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	return &db.PublicVpnOrders[len(db.PublicVpnOrders)-1]
}

// tunnelSeedClient — client léger actif connu.
func tunnelSeedClient(db *model.DB, id, email string) {
	db.TunnelClients = append(db.TunnelClients, model.TunnelClient{
		ID: id, Email: email, Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

// tunnelAuthReq — requête authentifiée par claims rôle tunnel. Le segment
// dynamique {ref} est posé par SetPathValue (les appels directs hors mux ne
// remplissent PAS PathValue — discipline des tests N°301/313 revisitée).
func tunnelAuthReq(method, target string, claims *auth.Claims, body string) *http.Request {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	if i := strings.Index(target, "/orders/"); i != -1 {
		rest := target[i+len("/orders/"):]
		if j := strings.LastIndex(rest, "/"); j != -1 {
			rest = rest[:j]
		}
		req.SetPathValue("ref", rest)
	}
	return req.WithContext(withClaims(req.Context(), claims))
}

// ---------------------------------------------------------------------------
// reveal — re-livraison de la conf dans l'espace
// ---------------------------------------------------------------------------

func TestTunnelReveal(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "ali@example.com")
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "Ali@Example.com", model.PublicVpnOrderProvisioned,
		"vp-1", "2999-01-01T00:00:00Z")
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-1", AccountID: model.AccountMainID, Name: "vp-aaaa1111",
		Kind: model.VpnKindFullTunnel, State: model.VpnStateActive,
		IPv4: "10.8.1.7", Conf: "[Interface]\nPrivateKey = test\n",
	})
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// 1. Succès : conf complète + métadonnées (jamais dans un journal).
	rec := httptest.NewRecorder()
	a.handleTunnelReveal(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/reveal", claims, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("reveal : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref       string `json:"ref"`
		Conf      string `json:"conf"`
		IPv4      string `json:"ipv4"`
		Plan      string `json:"plan"`
		ExpiresAt string `json:"expiresAt"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.Conf == "" || !strings.Contains(out.Conf, "PrivateKey") {
		t.Fatalf("conf attendue dans la réponse, eu %q", out.Conf)
	}
	if out.IPv4 != "10.8.1.7" || out.Ref != "MCV-AAAA1111" {
		t.Fatalf("métadonnées inattendues : %+v", out)
	}

	// Trace d'activité SANS la conf (le journal n'est pas un coffre).
	st.Lock()
	for _, l := range st.Data().Activity {
		if strings.Contains(l.Message, "PrivateKey") {
			t.Fatalf("la conf a fui dans le journal d'activité : %s", l.Message)
		}
	}
	st.Unlock()

	// 2. Anti-énumération : référence inconnue → 404.
	recOther := httptest.NewRecorder()
	a.handleTunnelReveal(recOther, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-BBBB2222/reveal", claims, ""))
	if recOther.Code != http.StatusNotFound {
		t.Fatalf("référence inconnue : HTTP %d attendu (404)", recOther.Code)
	}
	// Client différent dont l'e-mail ne matche PAS la commande :
	st.Lock()
	tunnelSeedClient(st.Data(), "tc-2", "mallory@example.com")
	st.Save()
	st.Unlock()
	recMallory := httptest.NewRecorder()
	a.handleTunnelReveal(recMallory, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/reveal",
		&auth.Claims{Sub: "tc-2", Role: "tunnel"}, ""))
	if recMallory.Code != http.StatusNotFound {
		t.Fatalf("e-mail divergent : HTTP %d attendu (404, anti-énumération)", recMallory.Code)
	}

	// 3. Expirée : 410 avec le terme (honnête).
	st.Lock()
	tunnelSeedOrder(st.Data(), "o3", "MCV-CCCC3333", "ali@example.com", model.PublicVpnOrderProvisioned,
		"vp-3", "2020-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	recExp := httptest.NewRecorder()
	a.handleTunnelReveal(recExp, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-CCCC3333/reveal", claims, ""))
	if recExp.Code != http.StatusGone {
		t.Fatalf("commande expirée : HTTP %d attendu (410)", recExp.Code)
	}

	// 4. Rôle console : 403 — l'espace tunnel n'est pas la console SaaS.
	recAdmin := httptest.NewRecorder()
	a.handleTunnelReveal(recAdmin, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/reveal",
		&auth.Claims{Sub: "u-x", Role: "admin"}, ""))
	if recAdmin.Code != http.StatusForbidden {
		t.Fatalf("rôle console : HTTP %d attendu (403)", recAdmin.Code)
	}

	// 5. Session fantôme : 401.
	recGhost := httptest.NewRecorder()
	a.handleTunnelReveal(recGhost, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/reveal",
		&auth.Claims{Sub: "tc-fantome", Role: "tunnel"}, ""))
	if recGhost.Code != http.StatusUnauthorized {
		t.Fatalf("session fantôme : HTTP %d attendu (401)", recGhost.Code)
	}
}

func TestTunnelRevealSelfHealing(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "ali@example.com")
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "ali@example.com", model.PublicVpnOrderProvisioned,
		"vp-1", "2999-01-01T00:00:00Z")
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-1", AccountID: model.AccountMainID, Name: "vp-aaaa1111",
		Kind: model.VpnKindFullTunnel, State: model.VpnStateActive,
		IPv4: "10.8.1.7", Conf: "", // copie cloud VIDE → self-healing
	})
	st.Save()
	st.Unlock()

	oldConf := wgMiniConfFn
	wgMiniConfFn = func(name string) (string, error) {
		if name != "vp-aaaa1111" {
			return "", errors.New("peer inattendu")
		}
		return "[Interface]\nPrivateKey = fresh\n", nil
	}
	t.Cleanup(func() { wgMiniConfFn = oldConf })

	rec := httptest.NewRecorder()
	a.handleTunnelReveal(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/reveal",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("reveal self-healing : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Conf string `json:"conf"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if !strings.Contains(out.Conf, "fresh") {
		t.Fatalf("conf fraîche attendue, eu %q", out.Conf)
	}
	// La conf fraîche est re-sauvegardée sur le peer (self-healing D5-a).
	st.Lock()
	if p := model.FindVpnPeerScoped(st.Data(), "vp-1", model.AccountMainID); p == nil || !strings.Contains(p.Conf, "fresh") {
		t.Fatalf("conf fraîche non re-sauvegardée sur le peer")
	}
	st.Unlock()
}

func TestTunnelRevealRenewalFollowsTarget(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "ali@example.com")
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "ali@example.com", model.PublicVpnOrderProvisioned,
		"vp-1", "2999-01-01T00:00:00Z")
	// La renewal : provisioned, PeerID vide (transaction de facturation).
	tunnelSeedOrder(db, "o2", "MCV-RENE1111", "ali@example.com", model.PublicVpnOrderProvisioned,
		"", "2999-02-01T00:00:00Z")
	db.PublicVpnOrders[1].Kind = model.PublicVpnKindRenewal
	db.PublicVpnOrders[1].RenewTargetRef = "MCV-AAAA1111"
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-1", AccountID: model.AccountMainID, Name: "vp-aaaa1111",
		Kind: model.VpnKindFullTunnel, State: model.VpnStateActive,
		IPv4: "10.8.1.7", Conf: "[Interface]\nPrivateKey = cible\n",
	})
	st.Save()
	st.Unlock()

	// Reveal sur la RENEWAL → conf de la CIBLE (renouveler ne change pas la conf).
	rec := httptest.NewRecorder()
	a.handleTunnelReveal(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-RENE1111/reveal",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("reveal renewal : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref  string `json:"ref"`
		Conf string `json:"conf"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Ref != "MCV-AAAA1111" || !strings.Contains(out.Conf, "cible") {
		t.Fatalf("la renewal doit révéler la conf de sa cible : %+v", out)
	}
}

// ---------------------------------------------------------------------------
// renew — renouvellement 1-clic (création de la commande renewal)
// ---------------------------------------------------------------------------

func TestTunnelRenew(t *testing.T) {
	a, st := newTunnelTest(t)
	// Le test enchaîne ~10 requêtes renew : le limiter tunnelAction (8/fenêtre)
	// est élargi LOCALEMENT — les bornes production restent 8/40 (routes.go).
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "ali@example.com")
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "Ali@Example.com", model.PublicVpnOrderProvisioned,
		"vp-1", "2999-01-01T00:00:00Z")
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-1", AccountID: model.AccountMainID, Name: "vp-aaaa1111",
		Kind: model.VpnKindFullTunnel, State: model.VpnStateActive, IPv4: "10.8.1.7",
	})
	// ensureSettings retourne une COPIE : la mutation doit être réécrite dans
	// la map (et Platform initialisé — pointeur nil par défaut).
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

	// 1. Succès (canal manual — pas de réseau GeniusPay en test).
	rec := httptest.NewRecorder()
	a.handleTunnelRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew", claims,
		`{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("renew : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref       string `json:"ref"`
		TargetRef string `json:"targetRef"`
		Status    string `json:"status"`
		Online    bool   `json:"online"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.TargetRef != "MCV-AAAA1111" || out.Status != model.PublicVpnOrderPending {
		t.Fatalf("cible/statut inattendus : %+v", out)
	}
	st.Lock()
	created := model.FindPublicVpnOrderByRef(st.Data(), out.Ref)
	if created == nil {
		t.Fatalf("commande renewal non créée")
	}
	if created.Kind != model.PublicVpnKindRenewal || created.RenewTargetRef != "MCV-AAAA1111" {
		t.Fatalf("genre/cible de la renewal inattendus : %+v", created)
	}
	if !strings.EqualFold(created.Email, "ali@example.com") || created.AmountFcfa != 1500 {
		t.Fatalf("e-mail/montant inattendus : %+v", created)
	}
	st.Unlock()

	// 2. Garde-fou pending : une deuxième commande tant que la première est
	// en attente → 409 clair (le buyer répète = refus net, miroir vitrine).
	recDup := httptest.NewRecorder()
	a.handleTunnelRenew(recDup, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew", claims,
		`{"planId":"vpn-b2c-year","payMethod":"card"}`))
	if recDup.Code != http.StatusConflict || !strings.Contains(recDup.Body.String(), "order_pending_exists") {
		t.Fatalf("doublon pending : HTTP %d attendu (409 order_pending_exists) — %s", http.StatusConflict, recDup.Body.String())
	}

	// 3. Sans clés GeniusPay : « card » bascule honnêtement sur manual (une
	// fois la pending précédente réglée/annulée).
	st.Lock()
	if o := model.FindPublicVpnOrderByRef(st.Data(), out.Ref); o != nil {
		o.Status = model.PublicVpnOrderCancelled
		o.UpdatedAt = model.NowISO()
	}
	st.Save()
	st.Unlock()
	recCard := httptest.NewRecorder()
	a.handleTunnelRenew(recCard, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew", claims,
		`{"planId":"vpn-b2c-year","payMethod":"card"}`))
	if recCard.Code != http.StatusOK {
		t.Fatalf("renew card : HTTP %d — %s", recCard.Code, recCard.Body.String())
	}
	var outCard struct {
		PayMethod string `json:"payMethod"`
		Online    bool   `json:"online"`
	}
	_ = json.Unmarshal(recCard.Body.Bytes(), &outCard)
	if outCard.PayMethod != "manual" || outCard.Online {
		t.Fatalf("bascule manual attendue sans clés GeniusPay : %+v", outCard)
	}

	// 4. Anti-énumération : commande d'un autre e-mail → 404.
	st.Lock()
	tunnelSeedClient(st.Data(), "tc-2", "mallory@example.com")
	st.Save()
	st.Unlock()
	recMallory := httptest.NewRecorder()
	a.handleTunnelRenew(recMallory, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew",
		&auth.Claims{Sub: "tc-2", Role: "tunnel"}, `{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if recMallory.Code != http.StatusNotFound {
		t.Fatalf("e-mail divergent : HTTP %d attendu (404)", recMallory.Code)
	}

	// 5. Cible non active : 409 + code target_not_active.
	st.Lock()
	tunnelSeedOrder(st.Data(), "o9", "MCV-DEAD9999", "ali@example.com", model.PublicVpnOrderExpired, "", "")
	st.Save()
	st.Unlock()
	recDead := httptest.NewRecorder()
	a.handleTunnelRenew(recDead, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-DEAD9999/renew", claims,
		`{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if recDead.Code != http.StatusConflict {
		t.Fatalf("cible expirée : HTTP %d attendu (409)", recDead.Code)
	}
	if !strings.Contains(recDead.Body.String(), "target_not_active") {
		t.Fatalf("code d'erreur attendu target_not_active : %s", recDead.Body.String())
	}

	// 6. Validations : formule inconnue, moyen inconnu, Wave sans téléphone.
	for name, body := range map[string]string{
		"plan inconnu":  `{"planId":"vpn-??","payMethod":"manual"}`,
		"moyen inconnu": `{"planId":"vpn-b2c-month","payMethod":"crypto"}`,
		"wave sans tel": `{"planId":"vpn-b2c-month","payMethod":"wave"}`,
	} {
		recBad := httptest.NewRecorder()
		a.handleTunnelRenew(recBad, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew", claims, body))
		if recBad.Code != http.StatusBadRequest {
			t.Fatalf("%s : HTTP %d attendu (400)", name, recBad.Code)
		}
	}

	// 7. Honeypot : succès factice, RIEN n'est créé.
	st.Lock()
	before := len(st.Data().PublicVpnOrders)
	st.Unlock()
	recPot := httptest.NewRecorder()
	a.handleTunnelRenew(recPot, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew", claims,
		`{"planId":"vpn-b2c-month","payMethod":"manual","website":"spam"}`))
	if recPot.Code != http.StatusOK {
		t.Fatalf("honeypot : HTTP %d attendu (200 factice)", recPot.Code)
	}
	st.Lock()
	if len(st.Data().PublicVpnOrders) != before {
		t.Fatalf("honeypot : une commande a été créée (%d → %d)", before, len(st.Data().PublicVpnOrders))
	}
	st.Unlock()
}

func TestTunnelRenewShopDisabled(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	tunnelSeedClient(db, "tc-1", "ali@example.com")
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "ali@example.com", model.PublicVpnOrderProvisioned,
		"vp-1", "2999-01-01T00:00:00Z")
	// Boutique FERMÉE (défaut) : le renouvellement refuse honnêtement.
	st.Save()
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleTunnelRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/orders/MCV-AAAA1111/renew",
		&auth.Claims{Sub: "tc-1", Role: "tunnel"}, `{"planId":"vpn-b2c-month","payMethod":"manual"}`))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("boutique fermée : HTTP %d attendu (403)", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// provisionPublicVpnOrder — chemin renewal (extension d'échéance)
// ---------------------------------------------------------------------------

func TestPublicVpnRenewalProvisioning(t *testing.T) {
	a, st := newTunnelTest(t)
	var calls []sentEmail
	wg := stubAccountEmailCapture(t, &calls)

	st.Lock()
	db := st.Data()
	enableTunnelEmail(db)
	// Cible : provisionnée, échéance future lointaine (le client renouvelle
	// AVANT le terme — les jours restants ne se perdent pas).
	future := "2999-06-15T00:00:00Z"
	tunnelSeedOrder(db, "o1", "MCV-AAAA1111", "ali@example.com", model.PublicVpnOrderProvisioned,
		"vp-1", future)
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-1", AccountID: model.AccountMainID, Name: "vp-aaaa1111",
		Kind: model.VpnKindFullTunnel, State: model.VpnStateActive,
		IPv4: "10.8.1.7", Conf: "[Interface]\nPrivateKey = cible\n",
	})
	// Renewal payée (le webhook/poll/admin/sweep convergent ici).
	tunnelSeedOrder(db, "o2", "MCV-RENE1111", "ali@example.com", model.PublicVpnOrderPaid, "", "")
	db.PublicVpnOrders[1].Kind = model.PublicVpnKindRenewal
	db.PublicVpnOrders[1].RenewTargetRef = "MCV-AAAA1111"
	db.PublicVpnOrders[1].Months = 1
	db.PublicVpnOrders[1].PaidAt = model.NowISO()
	st.Save()
	st.Unlock()

	peersBefore := len(st.Data().VpnPeers)
	if _, err := a.provisionPublicVpnOrder("o2"); err != nil {
		t.Fatalf("provisioning renewal : %v", err)
	}

	st.Lock()
	db = st.Data()
	renewal := model.FindPublicVpnOrderByRef(db, "MCV-RENE1111")
	target := model.FindPublicVpnOrderByRef(db, "MCV-AAAA1111")
	if renewal == nil || target == nil {
		t.Fatalf("lignes disparues")
	}
	if renewal.Status != model.PublicVpnOrderProvisioned {
		t.Fatalf("renewal attendue provisioned, eu %s", renewal.Status)
	}
	if renewal.PeerID != "" || renewal.PeerName != "" {
		t.Fatalf("une renewal ne doit JAMAIS porter de peer propre : %+v", renewal)
	}
	// Extension : échéance future + 1 mois (les jours restants se conservent).
	want := model.AddMonthsISO(future, 1)
	if target.ExpiresAt != want {
		t.Fatalf("échéance cible étendue : attendu %s, eu %s", want, target.ExpiresAt)
	}
	if renewal.ExpiresAt != want {
		t.Fatalf("échéance miroir de la renewal : attendu %s, eu %s", want, renewal.ExpiresAt)
	}
	// AUCUN nouveau peer posé, le peer de la cible est intact.
	if len(db.VpnPeers) != peersBefore {
		t.Fatalf("aucun nouveau peer attendu (%d → %d)", peersBefore, len(db.VpnPeers))
	}
	if p := model.FindVpnPeerScoped(db, "vp-1", model.AccountMainID); p == nil || p.State != model.VpnStateActive {
		t.Fatalf("peer de la cible altéré")
	}
	st.Unlock()

	// E-mail de confirmation parti (kind vpn_renew, SANS la conf).
	wg.Wait()
	found := false
	for _, c := range calls {
		if strings.Contains(c.title, "renouvelé") {
			found = true
			if strings.Contains(c.body, "PrivateKey") {
				t.Fatalf("la conf ne doit JAMAIS sortir dans l'e-mail de renouvellement")
			}
		}
	}
	if !found {
		t.Fatalf("e-mail de confirmation de renouvellement non envoyé : %d appel(s)", len(calls))
	}

	// Idempotence : rejeu → no-op (l'échéance ne bouge plus).
	if _, err := a.provisionPublicVpnOrder("o2"); err != nil {
		t.Fatalf("rejeu renewal : %v", err)
	}
	st.Lock()
	if target := model.FindPublicVpnOrderByRef(st.Data(), "MCV-AAAA1111"); target.ExpiresAt != want {
		t.Fatalf("rejeu : l'échéance a bougé (%s → %s)", want, target.ExpiresAt)
	}
	st.Unlock()
}

func TestPublicVpnRenewalDegradesToSale(t *testing.T) {
	a, st := newTunnelTest(t)

	// wg-mini stub : le provisioning de la vente dégénérée pose un peer neuf.
	oldAdd, oldRemove := wgMiniAddFn, wgMiniRemoveFn
	wgMiniAddFn = func(name, kind string) (string, string, error) {
		return "[Interface]\nPrivateKey = neuve\n", "10.8.1.9", nil
	}
	wgMiniRemoveFn = func(name string) error { return nil }
	t.Cleanup(func() { wgMiniAddFn, wgMiniRemoveFn = oldAdd, oldRemove })

	st.Lock()
	db := st.Data()
	// Cible MORTE : expirée + peer révoqué (le balayage est passé).
	tunnelSeedOrder(db, "o1", "MCV-DEAD9999", "ali@example.com", model.PublicVpnOrderExpired, "", "2020-01-01T00:00:00Z")
	// Renewal payée qui vise la cible morte.
	tunnelSeedOrder(db, "o2", "MCV-RENE1111", "ali@example.com", model.PublicVpnOrderPaid, "", "")
	db.PublicVpnOrders[1].Kind = model.PublicVpnKindRenewal
	db.PublicVpnOrders[1].RenewTargetRef = "MCV-DEAD9999"
	db.PublicVpnOrders[1].Months = 1
	db.PublicVpnOrders[1].PaidAt = model.NowISO()
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicVpnOrder("o2"); err != nil {
		t.Fatalf("provisioning dégénéré : %v", err)
	}
	st.Lock()
	db = st.Data()
	renewal := model.FindPublicVpnOrderByRef(db, "MCV-RENE1111")
	if renewal.Status != model.PublicVpnOrderProvisioned {
		t.Fatalf("renewal dégénérée attendue provisioned (vente neuve), eu %s", renewal.Status)
	}
	if renewal.Kind != model.PublicVpnKindSale || renewal.RenewTargetRef != "" {
		t.Fatalf("dégénérescence en vente attendue : %+v", renewal)
	}
	if renewal.PeerID == "" || renewal.PeerName == "" {
		t.Fatalf("la vente dégénérée doit porter son propre peer : %+v", renewal)
	}
	if renewal.ExpiresAt == "" {
		t.Fatalf("la vente dégénérée doit avoir une échéance propre")
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Middleware — les routes orders restent authentifiées (jamais publiques)
// ---------------------------------------------------------------------------

func TestTunnelOrdersRequireAuth(t *testing.T) {
	a, _ := newTunnelTest(t)
	// Sans JWT : la whitelist middleware refuse (401) — bout en bout sur le
	// mux complet, miroir TestTunnelMiddlewareWhitelist.
	for _, path := range []string{
		"/api/tunnel/orders/MCV-AAAA1111/reveal",
		"/api/tunnel/orders/MCV-AAAA1111/renew",
	} {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		a.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s sans JWT : HTTP %d attendu (401)", path, rec.Code)
		}
	}
}
