// N°285 — renfort WireGuard des routeurs agents : endpoints console.
//
//	POST /api/routers/{id}/wg-enable   → file wg_keygen (ou passe « ready » si clé connue)
//	GET  /api/routers/{id}/wg          → état du tunnel (JAMAIS la PSK ni la clé serveur)
//	PUT  /api/routers/{id}/wg-params   → pose les valeurs du peer serveur (livret wg-peer.sh) + file wg_setup
//	POST /api/routers/{id}/wg-auto     → N°307 : provisionnement AUTOMATIQUE (wg-mini add-router) — zéro valeur à saisir
//	POST /api/routers/{id}/wg-test     → dial direct 10.8.0.N:8728 (preuve de joignabilité du tunnel)
//	POST /api/routers/{id}/wg-disable  → file wg_teardown (démontage routeur) + révocation serveur AUTO (N°307) si wg-mini
//
// DOCTRINE (N°285) : le mode agent reste le SOCLE — le tunnel n'est JAMAIS
// sur le chemin critique du check-in (aucune réécriture de scheduler, aucun
// DNS static) : un tunnel mort dégrade le RENFORT, jamais le contrôle.
//
// N°307 — AUTOMATISATION : le cycle expert N°285 (dispatch ops-wg → livret
// SSH → 4 valeurs collées) reste ENTIER (wg-params, voie repli) mais la voie
// ROYALE est wg-auto : le rapport de wg_keygen enchaîne tout seul (peer VM
// via wg-mini, wg_setup filé, ≤ 45 s par étape) — le gérant ne saisit plus
// AUCUNE valeur technique. wg-mini absent/v1 → dégradation propre vers la
// voie experte, jamais d'échec silencieux.
package api

import (
	"encoding/json"
	"fmt"
	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// wgResult — réponse générique des endpoints WG (l'état complet est lu via
// GET /api/routers/{id}/wg — les handlers de mutation répondent court).
type wgResult struct {
	OK      bool   `json:"ok"`
	State   string `json:"state"`
	Message string `json:"message"`
}

// wgRouterLocked — retrouve le routeur (périmètre compte) et impose le mode
// agent : le renfort WireGuard ne s'applique qu'au mode agent (le mode real
// a déjà son chemin direct, le simulé n'a pas de réseau réel).
func (a *API) wgRouterLocked(id, acc string) (*model.Router, *model.DB) {
	db := a.store.Data()
	cur := findRouterScoped(db, id, acc)
	if cur == nil || cur.Mode != "agent" {
		return nil, db
	}
	return cur, db
}

// parseEndpointWG — découpe "IP:port" du livret wg-peer.sh (IPv4 v4-only :
// JoinHostPort ajouterait des crochets inutiles ; un hôte nu est accepté
// avec le port par défaut 51820).
func parseEndpointWG(raw string) (host string, port int, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", 0, fmt.Errorf("endpoint vide")
	}
	if i := strings.LastIndexByte(raw, ':'); i >= 0 {
		host = strings.TrimSpace(raw[:i])
		port, err = strconv.Atoi(strings.TrimSpace(raw[i+1:]))
		if err != nil {
			return "", 0, fmt.Errorf("port d'endpoint invalide")
		}
	} else {
		host = raw
		port = 51820
	}
	if !agent.ValidWgHost(host) {
		return "", 0, fmt.Errorf("hôte d'endpoint invalide")
	}
	if !agent.ValidWgPort(port) {
		return "", 0, fmt.Errorf("port d'endpoint invalide (1-65535)")
	}
	return host, port, nil
}

// handleRouterWgEnable — POST /api/routers/{id}/wg-enable : lance le cycle
// du renfort. Si la clé publique du routeur est déjà connue (re-activation),
// pas de commande : état « ready » immédiat (le routeur ne re-génère pas sa
// clé — l'interface mikcloud-wg est idempotente côté routeur).
func (a *API) handleRouterWgEnable(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("id")

	a.store.Lock()
	cur, db := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	// Dédup : une keygen en file/vol ne se re-file pas (pattern N°115).
	if cur.WgState == "pending_keygen" {
		a.store.Unlock()
		writeJSON(w, http.StatusOK, wgResult{OK: true, State: cur.WgState,
			Message: "Génération de clé déjà en attente du prochain check-in (≤ 45 s)"})
		return
	}
	suggestion := agent.WgPeerNameSuggestion(cur.Name, cur.ID)
	if cur.WgPub != "" {
		cur.WgState = "ready"
		cur.WgError = ""
		a.logActivityBy(r, db, cur.AccountID, "router", "Renfort WireGuard ré-armé sur «"+cur.Name+"» (clé déjà connue)")
		a.store.Save()
		a.store.Unlock()
		msg := "Clé du routeur déjà connue — posez le peer côté serveur puis livrez les paramètres"
		if wgMiniConfigured() {
			msg = "Clé du routeur déjà connue — terminez par « Terminer la configuration » (automatique) ou livrez les paramètres en mode expert"
		}
		writeJSON(w, http.StatusOK, wgResult{OK: true, State: "ready", Message: msg})
		return
	}
	cmd := queueCommandLocked(db, cur.AccountID, cur.ID, model.CmdWgKeygen, map[string]any{})
	cur.WgState = "pending_keygen"
	cur.WgError = ""
	cur.WgPeerName = suggestion
	a.logActivityBy(r, db, cur.AccountID, "router", "Renfort WireGuard demandé sur «"+cur.Name+"» — génération de clé au prochain check-in (≤ 45 s)")
	a.store.Save()
	cmdID := cmd.ID
	a.store.Unlock()

	genMsg := "Le routeur va générer sa clé WireGuard au prochain check-in (≤ 45 s) — sa clé privée ne quitte jamais l'appareil"
	if wgMiniConfigured() {
		genMsg = "Le routeur va générer sa clé WireGuard au prochain check-in (≤ 45 s) — la configuration se terminera ensuite TOUTE SEULE (aucune valeur à saisir)"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "state": "pending_keygen", "commandId": cmdID,
		"peerName": suggestion,
		"message":  genMsg,
	})
}

// handleRouterWgStatus — GET /api/routers/{id}/wg : état du renfort.
// Les secrets (PSK, clé publique serveur) ne sortent JAMAIS — seuls leur
// présence (hasParams) et les valeurs non sensibles sont retournées.
func (a *API) handleRouterWgStatus(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	id := r.PathValue("id")
	a.store.Lock()
	cur, _ := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	rc := *cur
	a.store.Unlock()

	online := false
	if t, err := time.Parse(time.RFC3339, rc.LastSeen); err == nil {
		online = time.Since(t) < OnlineWindow
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"state":        rc.WgState,
		"wgPub":        rc.WgPub,
		"peerName":     agent.WgPeerNameSuggestion(rc.Name, rc.ID),
		"wgPeerName":   rc.WgPeerName,
		"ipv4":         rc.WgIPv4,
		"endpoint":     rc.WgEndpoint,
		"appliedAt":    rc.WgAppliedAt,
		"error":        rc.WgError,
		"online":       online,
		"mode":         "agent",
		"hasParams":    rc.WgIPv4 != "" && rc.WgServerPub != "" && rc.WgPSK != "",
		"hasKeygen":    rc.WgPub != "",
		"serverTunnel": agent.WgServerTunnelIP,
		"auto":         wgMiniConfigured(),
		"note":         "PSK et clé serveur jamais exposés — livrés au routeur par wg_setup (canal agent TLS strict), automatiquement (N°307) ou via wg-params",
	})
}

// handleRouterWgParams — PUT /api/routers/{id}/wg-params : pose les valeurs
// du peer serveur (issues du livret /opt/wireguard/peers/<nom>.router.txt
// produit par wg-peer.sh add-router) et file wg_setup. Validations strictes :
// une valeur mal formée ne part jamais au routeur.
func (a *API) handleRouterWgParams(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("id")
	var req struct {
		PeerName  string `json:"peerName"`
		Address   string `json:"address"`
		ServerPub string `json:"serverPub"`
		PSK       string `json:"psk"`
		Endpoint  string `json:"endpoint"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<14)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	req.PeerName = strings.TrimSpace(req.PeerName)
	req.Address = strings.TrimSpace(req.Address)
	req.ServerPub = strings.TrimSpace(req.ServerPub)
	req.PSK = strings.TrimSpace(req.PSK)

	if !agent.ValidWgPeerName(req.PeerName) {
		writeErr(w, http.StatusBadRequest, "Nom de peer invalide (attendu [a-z0-9-], 1-32 — celui du dispatch ops-wg)")
		return
	}
	if !agent.ValidWgIPv4(req.Address) {
		writeErr(w, http.StatusBadRequest, "Adresse tunnel invalide (attendu 10.8.0.N, N entre 2 et 254)")
		return
	}
	if !agent.ValidWgKey(req.ServerPub) {
		writeErr(w, http.StatusBadRequest, "Clé publique serveur invalide (44 caractères base64 terminés par « = »)")
		return
	}
	if !agent.ValidWgKey(req.PSK) {
		writeErr(w, http.StatusBadRequest, "PresharedKey invalide (44 caractères base64 terminés par « = »)")
		return
	}
	host, port, err := parseEndpointWG(req.Endpoint)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "Endpoint invalide : "+err.Error())
		return
	}

	a.store.Lock()
	cur, db := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	if cur.WgPub == "" {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Générez d'abord la clé WireGuard du routeur (Activer le tunnel) — le livret serveur en dépend")
		return
	}
	// Anti-collision : une adresse tunnel = UN routeur (pool global à la VM).
	for i := range db.Routers {
		other := &db.Routers[i]
		if other.ID != cur.ID && other.WgIPv4 == req.Address {
			a.store.Unlock()
			writeErr(w, http.StatusConflict, "Adresse tunnel "+req.Address+" déjà attribuée à un autre routeur («"+other.Name+"»)")
			return
		}
	}
	payload := agent.WgSetupPayloadFrom(req.ServerPub, req.PSK, agent.WgIPv4WithPrefix(req.Address), host, port, wgAllowedSourcesLocked(db, cur.AccountID))
	cmd := queueCommandLocked(db, cur.AccountID, cur.ID, model.CmdWgSetup, payload)
	cur.WgPeerName = req.PeerName
	cur.WgIPv4 = req.Address
	cur.WgServerPub = req.ServerPub
	cur.WgPSK = req.PSK
	cur.WgEndpoint = host + ":" + strconv.Itoa(port)
	cur.WgState = "pending_setup"
	cur.WgError = ""
	a.logActivityBy(r, db, cur.AccountID, "router", "Tunnel WireGuard provisionné sur «"+cur.Name+"» (peer "+req.PeerName+", "+req.Address+") — application au prochain check-in (≤ 45 s)")
	a.store.Save()
	cmdID := cmd.ID
	a.store.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "state": "pending_setup", "commandId": cmdID,
		"message": "Paramètres livrés — le routeur configure son tunnel au prochain check-in (≤ 45 s), puis teste-le (Bouton Tester)",
	})
}

// ---------------------------------------------------------------------------
// N°307 — provisionnement AUTOMATIQUE (voie royale, zéro saisie)
// ---------------------------------------------------------------------------

// handleRouterWgAuto — POST /api/routers/{id}/wg-auto : termine le cycle SANS
// AUCUNE saisie. Deux chemins :
//   - paramètres déjà connus (hasParams) : re-livraison de wg_setup avec les
//     valeurs stockées (réparation d'un état « error », aucun appel VM) ;
//   - clé connue sans paramètres : wg-mini add-router embarque le peer côté
//     VM (adresse + PSK allouées là-bas, vérité du wg0.conf) puis wg_setup
//     est filé immédiatement — mêmes validations strictes que wg-params.
//
// Échec wg-mini → erreur explicite côté gérant, la voie experte reste entière.
func (a *API) handleRouterWgAuto(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("id")

	a.store.Lock()
	cur, _ := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	if cur.WgPub == "" {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Le routeur n'a pas encore généré sa clé WireGuard — lancez « Activer le tunnel » d'abord (≤ 45 s)")
		return
	}
	if cur.WgState == "pending_keygen" || cur.WgState == "pending_setup" {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Une étape est déjà en attente du prochain check-in (≤ 45 s) — laissez-la converger")
		return
	}
	// Chemin 1 — paramètres déjà connus : re-livraison self-healing.
	if cur.WgIPv4 != "" && cur.WgServerPub != "" && cur.WgPSK != "" {
		ipv4, spub, psk, ep := cur.WgIPv4, cur.WgServerPub, cur.WgPSK, cur.WgEndpoint
		peerName := cur.WgPeerName
		a.store.Unlock()
		res, code, msg := a.wgRedeliverStored(r, id, acc, peerName, ipv4, spub, psk, ep)
		if code != 0 {
			writeErr(w, code, msg)
			return
		}
		writeJSON(w, http.StatusOK, res)
		return
	}
	a.store.Unlock()

	// Chemin 2 — provisionnement neuf via wg-mini.
	if !wgMiniConfigured() {
		writeErr(w, http.StatusServiceUnavailable, "Automatisation indisponible sur cette installation (wg-mini non configuré) — livrez les paramètres en mode expert (livret wg-peer.sh) ou installez wg-mini v2 (cf. deploy/oracle/wg-mini/README.md)")
		return
	}
	res, code, msg := a.wgProvisionAuto(r, id, acc)
	if code != 0 {
		writeErr(w, code, msg)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// wgRedeliverStored — re-file wg_setup avec les valeurs DÉJÀ stockées (sans
// appel VM) : répare un état « error » ou re-synchronise un routeur. Les
// valeurs viennent du store (déjà validées à leur entrée) mais sont
// re-vérifiées : la défense en profondeur ne fait pas confiance au passé.
func (a *API) wgRedeliverStored(r *http.Request, id, acc, peerName, ipv4, spub, psk, ep string) (map[string]any, int, string) {
	if !agent.ValidWgIPv4(ipv4) || !agent.ValidWgKey(spub) || !agent.ValidWgKey(psk) {
		return nil, http.StatusConflict, "Paramètres stockés invalides — désactivez le tunnel puis réactivez-le (provisionnement automatique complet)"
	}
	host, port, err := parseEndpointWG(ep)
	if err != nil {
		return nil, http.StatusConflict, "Endpoint stocké invalide — désactivez le tunnel puis réactivez-le (provisionnement automatique complet)"
	}
	a.store.Lock()
	cur, db := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		return nil, http.StatusNotFound, "Routeur agent introuvable"
	}
	payload := agent.WgSetupPayloadFrom(spub, psk, agent.WgIPv4WithPrefix(ipv4), host, port, wgAllowedSourcesLocked(db, cur.AccountID))
	cmd := queueCommandLocked(db, cur.AccountID, cur.ID, model.CmdWgSetup, payload)
	cur.WgPeerName = peerName
	cur.WgState = "pending_setup"
	cur.WgError = ""
	a.logActivityBy(r, db, cur.AccountID, "router", "Tunnel WireGuard re-livré automatiquement sur «"+cur.Name+"» ("+ipv4+", paramètres déjà connus) — application au prochain check-in (≤ 45 s)")
	a.store.Save()
	cmdID := cmd.ID
	a.store.Unlock()
	return map[string]any{
		"ok": true, "state": "pending_setup", "commandId": cmdID,
		"message": "Paramètres re-livrés — le routeur reconfigure son tunnel au prochain check-in (≤ 45 s), puis testez-le",
	}, 0, ""
}

// wgProvisionAuto — embarque le peer serveur via wg-mini (add-router) et
// file wg_setup. SNAPSHOT sous verrou → appel réseau HORS verrou →
// ré-verrouillage + application (discipline handlers_vpn.go : jamais d'appel
// long sous le verrou global). Chaque fenêtre de concurrence est re-vérifiée
// (une livraison manuelle concurrente ne double jamais le provisionnement —
// le peer VM est retiré pour ne pas laisser de fantôme).
func (a *API) wgProvisionAuto(r *http.Request, id, acc string) (map[string]any, int, string) {
	// 1) Snapshot sous verrou.
	a.store.Lock()
	db := a.store.Data()
	cur := findRouterScoped(db, id, acc)
	if cur == nil || cur.Mode != "agent" || cur.WgPub == "" || cur.WgIPv4 != "" {
		a.store.Unlock()
		return nil, http.StatusNotFound, "Routeur agent introuvable (ou déjà provisionné)"
	}
	peerName := cur.WgPeerName
	if peerName == "" {
		peerName = agent.WgPeerNameSuggestion(cur.Name, cur.ID)
	}
	if !agent.ValidWgPeerName(peerName) {
		a.store.Unlock()
		return nil, http.StatusBadRequest, "Nom de peer invalide («" + peerName + "») — renommez le routeur (minuscules/chiffres/tirets) puis réessayez"
	}
	wgPub, rName := cur.WgPub, cur.Name
	a.store.Unlock()

	// 2) Appel wg-mini HORS verrou (12 s max).
	livret, err := wgMiniAddRouterFn(peerName, wgPub)
	if err != nil {
		// Rien n'a changé côté routeur (état « ready » conservé) : la
		// note borne la cause, la voie experte reste ouverte.
		a.store.Lock()
		if cur = findRouterScoped(a.store.Data(), id, acc); cur != nil && cur.WgPub == wgPub && cur.WgIPv4 == "" {
			cur.WgError = boundedString("provisionnement automatique impossible : "+err.Error(), 250)
		}
		a.store.Save()
		a.store.Unlock()
		return nil, http.StatusBadGateway, "Provisionnement automatique impossible : " + err.Error()
	}

	// Validations strictes (frontière VM → cloud : rien ne traverse non vérifié).
	host, port, epErr := parseEndpointWG(livret.Endpoint)
	if !agent.ValidWgIPv4(livret.Address) || !agent.ValidWgKey(livret.ServerPub) || !agent.ValidWgKey(livret.PSK) || epErr != nil {
		go func() { _ = wgMiniRemoveFn(peerName) }() // pas de peer fantôme
		a.store.Lock()
		if cur = findRouterScoped(a.store.Data(), id, acc); cur != nil && cur.WgPub == wgPub && cur.WgIPv4 == "" {
			cur.WgError = "livret serveur malformé (valeur invalide) — réessayez ou livrez les paramètres en mode expert"
		}
		a.store.Save()
		a.store.Unlock()
		return nil, http.StatusBadGateway, "Livret serveur malformé — réessayez ou livrez les paramètres en mode expert"
	}

	// 3) Ré-verrou + application.
	a.store.Lock()
	db = a.store.Data()
	cur = findRouterScoped(db, id, acc)
	if cur == nil || cur.WgPub != wgPub || cur.WgIPv4 != "" || cur.WgState == "pending_setup" {
		// Livraison manuelle/état changé entre-temps → pas de double :
		// le peer VM repart (le livret manuel reste la vérité).
		a.store.Unlock()
		go func() { _ = wgMiniRemoveFn(peerName) }()
		return nil, http.StatusConflict, "Le tunnel a été configuré entre-temps — aucune action doublée (le peer provisoire serveur a été retiré)"
	}
	// Anti-collision cloud (une adresse tunnel = UN routeur, hygiène wg-params).
	for i := range db.Routers {
		other := &db.Routers[i]
		if other.ID != cur.ID && other.WgIPv4 == livret.Address {
			a.store.Unlock()
			go func() { _ = wgMiniRemoveFn(peerName) }()
			return nil, http.StatusConflict, "Adresse tunnel " + livret.Address + " déjà attribuée à un autre routeur («" + other.Name + "») — réessayez"
		}
	}
	payload := agent.WgSetupPayloadFrom(livret.ServerPub, livret.PSK, agent.WgIPv4WithPrefix(livret.Address), host, port, wgAllowedSourcesLocked(db, cur.AccountID))
	cmd := queueCommandLocked(db, cur.AccountID, cur.ID, model.CmdWgSetup, payload)
	cur.WgPeerName = peerName
	cur.WgIPv4 = livret.Address
	cur.WgServerPub = livret.ServerPub
	cur.WgPSK = livret.PSK
	cur.WgEndpoint = host + ":" + strconv.Itoa(port)
	cur.WgState = "pending_setup"
	cur.WgError = ""
	if r != nil {
		a.logActivityBy(r, db, cur.AccountID, "router", "Tunnel WireGuard provisionné AUTOMATIQUEMENT sur «"+cur.Name+"» (peer "+peerName+", "+livret.Address+") — application au prochain check-in (≤ 45 s)")
	} else {
		a.logActivity(db, cur.AccountID, "router", "Tunnel WireGuard provisionné AUTOMATIQUEMENT sur «"+rName+"» (peer "+peerName+", "+livret.Address+") — application au prochain check-in (≤ 45 s)")
	}
	a.store.Save()
	cmdID := cmd.ID
	a.store.Unlock()

	return map[string]any{
		"ok": true, "state": "pending_setup", "commandId": cmdID,
		"peerName": peerName, "address": livret.Address,
		"message": "Le serveur a embarqué le peer et livré les paramètres au routeur — configuration au prochain check-in (≤ 45 s), puis testez-le",
	}, 0, ""
}

// wgAutoProvisionBg — chaînage automatique déclenché par le rapport de
// wg_keygen (agent_handlers.go) : pas de requête HTTP → journal via
// logActivity. Rejouable : toutes les conditions sont re-vérifiées, un état
// déjà convergé ressort immédiatement (idempotent).
func (a *API) wgAutoProvisionBg(id, acc string) {
	a.wgProvisionAuto(nil, id, acc)
}

// wgAutoRevoke — N°307 — révocation AUTOMATIQUE du peer serveur après un
// démontage demandé (goroutine : jamais sous le verrou, jamais bloquante).
// Échec → rappel exploitant au journal (le peer inoffensif reste : un routeur
// démonté n'initie plus de tunnel, il consomme juste une ligne de conf).
func (a *API) wgAutoRevoke(peerName, acc, routerName string) {
	if err := wgMiniRemoveFn(peerName); err != nil {
		a.store.Lock()
		a.logActivity(a.store.Data(), acc, "router", "Tunnel WireGuard démonté sur «"+routerName+"» mais révocation du peer serveur "+peerName+" impossible : "+boundedString(err.Error(), 150)+" — dispatch ops-wg mode=peer-remove peer_name="+peerName)
		a.store.Save()
		a.store.Unlock()
		return
	}
	a.store.Lock()
	a.logActivity(a.store.Data(), acc, "router", "Peer serveur "+peerName+" révoqué automatiquement (tunnel WireGuard de «"+routerName+"» démonté de bout en bout)")
	a.store.Save()
	a.store.Unlock()
}

// dialWGPort — dial TCP direct à travers le tunnel (le backend tourne sur
// l'hôte : wg0 est joignable nativement). Retourne la latence en ms.
func dialWGPort(ipv4 string, port int) (int64, bool) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(ipv4, strconv.Itoa(port)), 3*time.Second)
	if err != nil {
		return 0, false
	}
	latency := time.Since(start).Milliseconds()
	_ = conn.Close()
	return latency, true
}

// handleRouterWgTest — POST /api/routers/{id}/wg-test : preuve de
// joignabilité directe du tunnel depuis la VM. Diagnostic en deux ports :
// 8728 (API RouterOS, activée par défaut) puis 8291 (Winbox) — un tunnel UP
// avec 8728 fermé est rapporté « joignable mais API désactivée », jamais
// « tunnel mort » (honnêteté du diagnostic).
func (a *API) handleRouterWgTest(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	id := r.PathValue("id")
	a.store.Lock()
	cur, _ := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	rc := *cur
	a.store.Unlock()

	if rc.WgIPv4 == "" {
		writeErr(w, http.StatusBadRequest, "Aucune adresse tunnel connue pour ce routeur — livrez d'abord les paramètres (wg-params)")
		return
	}
	if latency, ok := dialWGPort(rc.WgIPv4, 8728); ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": true, "reachable": true, "port": 8728, "latencyMs": latency,
			"message": fmt.Sprintf("Tunnel joignable — API RouterOS répond sur %s:8728 (%d ms)", rc.WgIPv4, latency),
		})
		return
	}
	if latency, ok := dialWGPort(rc.WgIPv4, 8291); ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": true, "reachable": true, "port": 8291, "latencyMs": latency,
			"message": "Tunnel joignable (Winbox répond) — mais l'API RouterOS est fermée : /ip service enable api pour le pilotage direct",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": false, "reachable": false, "port": 0, "latencyMs": 0,
		"message": "Tunnel non joignable (" + rc.WgIPv4 + ") — vérifiez : handshake côté VM (ops-wg status), peer posé, Security List UDP 51820",
	})
}

// handleRouterWgDisable — POST /api/routers/{id}/wg-disable : file le
// démontage côté routeur (wg_teardown) ; N°307 — la révocation serveur est
// AUTOMATIQUE (wg-mini remove) quand l'automatisation est active, sinon le
// message rappelle le geste ops-wg (voie experte inchangée).
func (a *API) handleRouterWgDisable(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("id")
	a.store.Lock()
	cur, db := a.wgRouterLocked(id, acc)
	if cur == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur agent introuvable")
		return
	}
	if cur.WgPub == "" && cur.WgIPv4 == "" {
		a.store.Unlock()
		writeJSON(w, http.StatusOK, wgResult{OK: true, State: "", Message: "Tunnel déjà absent de ce routeur"})
		return
	}
	peerName, rName := cur.WgPeerName, cur.Name
	if pend := pendingCommandOfKind(db, cur.ID, model.CmdWgTeardown); pend == nil {
		queueCommandLocked(db, cur.AccountID, cur.ID, model.CmdWgTeardown, map[string]any{})
	}
	msg := "Démontage demandé — application au prochain check-in (≤ 45 s)"
	if peerName != "" {
		if wgMiniConfigured() {
			msg += ". Le peer serveur " + peerName + " sera révoqué automatiquement"
			go a.wgAutoRevoke(peerName, acc, rName)
		} else {
			msg += ". Pensez à révoquer le peer côté serveur : dispatch ops-wg mode=peer-remove peer_name=" + peerName
		}
	}
	a.logActivityBy(r, db, cur.AccountID, "router", "Démontage du tunnel WireGuard demandé sur «"+cur.Name+"»")
	a.store.Save()
	a.store.Unlock()

	writeJSON(w, http.StatusOK, wgResult{OK: true, State: "active", Message: msg})
}
