// handlers_tunnel_pro.go — N°315 — ACCÈS PRO + LAN ÉTENDU (caméras/NAS) —
// phase 3 du Programme Tunnel, design D-B1, livré comme offre « Pro » de la
// console MikTunnel (décision D-T4).
//
// PRODUIT : le gérant MikCloud dont l'e-mail de compte correspond à l'e-mail
// de login MikTunnel achète un ACCÈS PRO — un peer « remote » (supervision
// N°312 de SES routeurs : Winbox, API, SSH, web) posé sous SON COMPTE gérant
// (isolation multi-tenant D-B2 AUTOMATIQUE : wgAllowedSourcesLocked élargit
// l'allowed-address des routeurs du compte aux peers du compte, et RIEN
// d'autre), PLUS l'extension du routage vers le LAN de chaque routeur — les
// caméras et les NAS deviennent joignables à travers le même tunnel chiffré
// (promesse P-A de N°289 enfin tenue).
//
// LES TROIS BRIQUES D-B1 (où vit chaque vérité) :
//  1. DÉTECTION (wg_lan_detect, pattern ppp_provision N°310) : commande
//     agent LECTURE PURE — le routeur rapporte son interface LAN + le /24
//     dérivé de son adresse locale (Command.Result, état SANS colonne pour
//     la détection elle-même).
//  2. ROUTAGE (wg-peer.sh set-lan via wg-mini /v1/set-lan, VM) : l'AllowedIPs
//     du PEER ROUTEUR dans wg0.conf devient « 10.8.0.N/32, <lan> » — la VM
//     route le sous-réseau vers ce routeur (cryptokey routing). La mémoire
//     CLOUD de l'intention vit dans Router.WgLan (posée APRÈS succès VM).
//  3. NAT ROUTEUR (wg_lan, marqueur mikcloud-wg-lan) : pour chaque peer Pro,
//     un accept forward + un masquerade srcnat — les hôtes LAN répondent au
//     routeur sans route de retour. La vérité vit DANS la config routeur
//     (idempotent remove-then-add, re-qué au renouvellement).
//     Et la CONF CLIENT (wg-peer.sh lan-extend via wg-mini /v1/lan-extend) :
//     AllowedIPs = 10.8.0.0/24, 10.8.2.0/24, <lan> — la preuve par la conf
//     (le backend remplace sa copie chiffrée par la vérité VM renvoyée).
//
// SÉCURITÉ — le segment remote reste FAIL-CLOSED : aucune MASQUERADE vers
// Internet (jamais de sortie Web pour un peer Pro), le LAN étendu n'ouvre
// QUE le chemin peer Pro → LAN du COMPTE (l'isolation D-B2 tient au niveau
// de l'allowed-address des routeurs : les peers d'un autre compte sont
// droppés PAR LE ROUTEUR, même avec une conf trafiquée). Collision LAN : un
// sous-réseau ne peut être routé que vers UN routeur (wg-peer.sh refuse —
// deux gérants en 192.168.88.0/24 : le second reçoit un message honnête et
// renumérote, ex. 10.10.x, candidats ppp_provision N°310).
//
// Confiance : le JWT rôle tunnel prouve la possession de l'e-mail (code à 6
// chiffres reçu à CETTE adresse — même frontière que le reveal N°314 et la
// récupération vitrine N°301) ; l'e-mail EST l'identité du compte gérant
// (Account.Email, posé au signup). Les routes ne touchent QUE les routeurs
// du compte apparié — jamais une enumeration possible (404 uniforme).
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Résolution du compte gérant + helpers d'état (TOUS sous verrou)
// ---------------------------------------------------------------------------

// tunnelProAccountLocked — le compte gérant ACTIF apparié par e-mail (la
// résolution parcourt le registre dans l'ordre d'insertion : déterministe ;
// un e-mail partagé par deux comptes résout sur le premier — les emails de
// contact sont uniques par convention signup). Nil = pas de compte gérant :
// l'Accès Pro n'est pas vendable à cette adresse (refus honnête, pas un
// achat qui ne servirait à rien).
func tunnelProAccountLocked(db *model.DB, email string) *model.Account {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil
	}
	for i := range db.Accounts {
		acc := &db.Accounts[i]
		if acc.Status == "active" && strings.EqualFold(strings.TrimSpace(acc.Email), email) {
			return acc
		}
	}
	return nil
}

// tunnelProRoutersLocked — les routeurs du compte (tous modes : la liste
// honnête montre aussi les routeurs simulés/réels — seuls les agents
// supportent le LAN étendu, la console le dit).
func tunnelProRoutersLocked(db *model.DB, accID string) []*model.Router {
	out := []*model.Router{}
	for i := range db.Routers {
		if db.Routers[i].AccountID == accID {
			out = append(out, &db.Routers[i])
		}
	}
	return out
}

// tunnelProEligibleLocked — un compte apparié + AU MOINS un routeur mode
// agent (le canal des commandes wg_lan_detect / wg_lan — un routeur simulé
// ne pourra jamais converger : refuser honnêtement plutôt que vendre muet).
func tunnelProEligibleLocked(db *model.DB, email string) (*model.Account, []*model.Router, bool) {
	acc := tunnelProAccountLocked(db, email)
	if acc == nil {
		return nil, nil, false
	}
	routers := tunnelProRoutersLocked(db, acc.ID)
	agentRouter := false
	for _, rr := range routers {
		if rr.Mode == "agent" {
			agentRouter = true
			break
		}
	}
	return acc, routers, agentRouter
}

// tunnelProOrdersLocked — les commandes Pro VIVANTES de cet e-mail
// (provisioned + non échues + peer encore au registre) : la base du
// « portefeuille Pro » de la page /pro et du moteur d'application LAN.
func tunnelProOrdersLocked(db *model.DB, email string, now string) []*model.PublicVpnOrder {
	out := []*model.PublicVpnOrder{}
	for i := range db.PublicVpnOrders {
		o := &db.PublicVpnOrders[i]
		if o.Kind != model.PublicVpnKindPro || !strings.EqualFold(o.Email, email) {
			continue
		}
		if o.Status != model.PublicVpnOrderProvisioned || o.PeerID == "" {
			continue
		}
		if o.ExpiresAt != "" && o.ExpiresAt < now {
			continue
		}
		if model.FindVpnPeerByID(db, o.PeerID) == nil {
			continue
		}
		out = append(out, o)
	}
	return out
}

// tunnelProPeersLocked — les PEERS des commandes Pro vivantes du COMPTE
// (l'appariement par e-mail a posé le peer sous le compte au provisioning —
// la défense ici revérifie AccountID : un peer Pro d'un AUTRE compte ne
// figure JAMAIS dans les règles LAN de ce compte, même sur donnée avariée).
func tunnelProPeersLocked(db *model.DB, accID, email, now string) []*model.VpnPeer {
	orders := tunnelProOrdersLocked(db, email, now)
	ids := map[string]bool{}
	for _, o := range orders {
		ids[o.PeerID] = true
	}
	out := []*model.VpnPeer{}
	for i := range db.VpnPeers {
		p := &db.VpnPeers[i]
		if !ids[p.ID] || p.AccountID != accID || p.State != model.VpnStateActive {
			continue
		}
		if !agent.ValidWgSupervisionIP(p.IPv4) {
			continue
		}
		out = append(out, p)
	}
	return out
}

// tunnelLanDetectStateLocked — état de la DERNIÈRE détection LAN d'un
// routeur (walk inverse du registre des commandes, pattern
// handlePppProvisionStatus). Retour : état none|queued|sent|done|error + le
// LAN rapporté (done) + iface + validité côté cloud (ValidWgLanCIDR).
func tunnelLanDetectStateLocked(db *model.DB, routerID string) (state, lan, iface string, valid bool) {
	state = "none"
	var latest *model.Command
	for i := len(db.Commands) - 1; i >= 0; i-- {
		c := &db.Commands[i]
		if c.RouterID == routerID && c.Kind == model.CmdWgLanDetect {
			latest = c
			break
		}
	}
	if latest == nil {
		return state, "", "", false
	}
	state = latest.Status
	if latest.Status == "done" {
		lan = strings.TrimSpace(resultStr(latest.Result, "lan"))
		iface = boundedString(resultStr(latest.Result, "iface"), 40)
		valid = agent.ValidWgLanCIDR(lan)
	}
	return state, lan, iface, valid
}

// tunnelLanRuleStateLocked — état de la DERNIÈRE commande wg_lan (règles
// marquées routeur) — même walk inverse.
func tunnelLanRuleStateLocked(db *model.DB, routerID string) string {
	for i := len(db.Commands) - 1; i >= 0; i-- {
		c := &db.Commands[i]
		if c.RouterID == routerID && c.Kind == model.CmdWgLan {
			return c.Status
		}
	}
	return "none"
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/pro — statut Pro complet (lecture pure, JWT tunnel)
// ---------------------------------------------------------------------------

// handleTunnelProStatus — la page /pro s'affiche d'un seul appel : éligibilité
// (compte + routeur agent), routeurs avec état LAN (WgLan appliqué,
// détection, règles), portefeuille Pro vivant, formules famille pro. AUCUN
// secret (la conf se livre par le reveal N°314 — jamais dans un statut).
func (a *API) handleTunnelProStatus(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	now := model.NowISO()
	acc, routers, eligible := tunnelProEligibleLocked(db, client.Email)
	out := map[string]any{
		"email":     client.Email,
		"eligible":  eligible,
		"scope":     "phase3", // Accès Pro + LAN étendu (N°315)
		"plans":     tunnelProPlansPayload(),
		"proOrders": []map[string]any{},
	}
	if acc != nil {
		out["account"] = map[string]any{"id": acc.ID, "name": acc.Name}
	}
	routerRows := []map[string]any{}
	for _, rr := range routers {
		state, lan, iface, valid := tunnelLanDetectStateLocked(db, rr.ID)
		routerRows = append(routerRows, map[string]any{
			"id": rr.ID, "name": rr.Name, "mode": rr.Mode,
			"online":     rr.Status == "online",
			"wgState":    rr.WgState,
			"wgLan":      rr.WgLan,
			"lanApplied": rr.WgLan != "",
			"lanDetect": map[string]any{
				"state": state, "lan": lan, "iface": iface, "valid": valid,
			},
			"lanRuleState": tunnelLanRuleStateLocked(db, rr.ID),
		})
	}
	out["routers"] = routerRows
	proRows := []map[string]any{}
	for _, o := range tunnelProOrdersLocked(db, client.Email, now) {
		planLabel := o.PlanID
		if plan := model.ResolvePublicVpnPlan(o.PlanID); plan != nil {
			planLabel = plan.Label
		}
		peerIP := ""
		if p := model.FindVpnPeerByID(db, o.PeerID); p != nil {
			peerIP = p.IPv4
		}
		proRows = append(proRows, map[string]any{
			"ref": o.Ref, "plan": planLabel, "months": o.Months,
			"expiresAt": o.ExpiresAt, "peerIpv4": peerIP,
		})
	}
	out["proOrders"] = proRows
	out["anyActive"] = len(proRows) > 0
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// tunnelProPlansPayload — les formules famille « pro » (le catalogue partagé
// reste LA source ; la vitrine filtre b2c, ici on filtre pro).
func tunnelProPlansPayload() []map[string]any {
	out := []map[string]any{}
	for _, p := range model.PublicVpnPlans {
		if p.Family != model.PublicVpnPlanFamilyPro {
			continue
		}
		out = append(out, map[string]any{
			"id": p.ID, "label": p.Label, "periodLabel": p.PeriodLabel,
			"months": p.Months, "baseFcfa": p.BaseFcfa,
		})
	}
	return out
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/detect — enfile la détection LAN (pattern ppp_provision)
// ---------------------------------------------------------------------------

// handleTunnelProDetect — corps {routerId} : enfile wg_lan_detect SUR LE
// ROUTEUR (lecture pure côté routeur, aucune écriture). Autorisé SANS
// commande Pro active (découverte pré-achat honnête : le gérant voit ce
// qu'il achèterait) — l'APPLICATION, elle, exige un Pro vivant. Anti
// double-file : une wg_lan_detect déjà en attente est retournée telle
// quelle (idempotence de l'intention, pattern handlePppProvisionAuto).
func (a *API) handleTunnelProDetect(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<12)
	var req struct {
		RouterID string `json:"routerId"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	routerID := strings.TrimSpace(req.RouterID)

	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	// Appariement : le routeur doit appartenir au COMPTE de l'e-mail — un ID
	// d'un autre compte est traité comme inconnu (anti-énumération 404).
	acc := tunnelProAccountLocked(db, client.Email)
	if acc == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	rr := findRouterScoped(db, routerID, acc.ID)
	if rr == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	if rr.Mode != "agent" {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Le LAN étendu exige un routeur en mode agent (canal des commandes MikCloud)")
		return
	}
	// Déjà appliqué : la détection n'apporterait rien (le LAN vit déjà).
	if rr.WgLan != "" {
		lan := rr.WgLan
		a.store.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"already": true, "lan": lan})
		return
	}
	// Anti double-file (même intention = même commande).
	for i := range db.Commands {
		cmd := &db.Commands[i]
		if cmd.RouterID == rr.ID && cmd.Kind == model.CmdWgLanDetect && cmd.Status == "queued" {
			cmdID := cmd.ID
			a.store.Unlock()
			writeJSON(w, http.StatusAccepted, map[string]any{
				"queued": true, "commandId": cmdID, "already": true,
				"message": "Une détection LAN est déjà en attente du prochain check-in (≤ 45 s)",
			})
			return
		}
	}
	cmd := queueCommandLocked(db, acc.ID, rr.ID, model.CmdWgLanDetect, agent.WgLanDetectPayloadFrom())
	a.logActivity(db, acc.ID, "router", "Détection LAN demandée sur «"+rr.Name+"» (Accès Pro) — lecture pure, application au prochain check-in (≤ 45 s)")
	a.store.Save()
	cmdID, routerName := cmd.ID, rr.Name
	a.store.Unlock()

	writeJSON(w, http.StatusAccepted, map[string]any{
		"queued": true, "commandId": cmdID, "router": routerName,
		"message": "Le routeur détectera son réseau LAN automatiquement au prochain check-in (≤ 45 s)",
	})
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/pro/lan/{routerId} — POLL pur de la détection
// ---------------------------------------------------------------------------

// handleTunnelProLanPoll — lecture pure (pattern handlePppProvisionStatus :
// le poll ne produit ni bruit ni écriture — l'APPLICATION est un POST
// explicite, jamais un effet de bord de GET). La console boucle ici pendant
// l'attente de convergence agent (≤ 45 s).
func (a *API) handleTunnelProLanPoll(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	routerID := strings.TrimSpace(r.PathValue("routerId"))
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	acc := tunnelProAccountLocked(db, client.Email)
	if acc == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	rr := findRouterScoped(db, routerID, acc.ID)
	if rr == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	state, lan, iface, valid := tunnelLanDetectStateLocked(db, rr.ID)
	out := map[string]any{
		"state":       state,
		"wgLan":       rr.WgLan,
		"lanApplied":  rr.WgLan != "",
		"agentOnline": rr.Status == "online",
	}
	if state == "done" {
		out["lan"] = lan
		out["iface"] = iface
		out["valid"] = valid
		if !valid && lan != "" {
			out["message"] = "Réseau détecté hors périmètre : un /24 privé RFC1918 (hors 10.8.0.0/16) est requis — renumérotez le LAN du routeur (ex. 10.10.x)"
		}
	}
	if state == "error" {
		out["message"] = boundedString(resultStr(lastWgLanDetectResult(db, rr.ID), "message"), 200)
	}
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// lastWgLanDetectResult — le Result de la dernière commande wg_lan_detect
// (facteur du poll — message d'échec borné).
func lastWgLanDetectResult(db *model.DB, routerID string) map[string]any {
	for i := len(db.Commands) - 1; i >= 0; i-- {
		c := &db.Commands[i]
		if c.RouterID == routerID && c.Kind == model.CmdWgLanDetect {
			return c.Result
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/lan/{routerId} — APPLICATION du LAN étendu
// ---------------------------------------------------------------------------

// handleTunnelProLan — le geste complet D-B1 pour un routeur :
//   - LAN inconnu → relit la dernière détection (la sauvegarde n'a lieu
//     qu'APRÈS un set-lan VM réussi) ; aucune détection → enfile
//     wg_lan_detect et répond « queued » (la console repoll puis rePOST) ;
//   - LAN connu + Pro vivant → brique 2 (set-lan VM, hors verrou) puis
//     brique 3 (commande wg_lan au routeur + lan-extend de la conf de chaque
//     peer Pro — la copie chiffrée du cloud est remplacée par la vérité VM).
//
// Réponses : {queued:true} | {applied:true, lan, peers:[ip]} | erreur honnête
// (collision LAN : renumérotation conseillée, candidats 10.10.x N°310).
func (a *API) handleTunnelProLan(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	routerID := strings.TrimSpace(r.PathValue("routerId"))

	// ---- Collecte (verrou) : routeur + LAN + peers Pro du compte ----
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	acc := tunnelProAccountLocked(db, client.Email)
	if acc == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	rr := findRouterScoped(db, routerID, acc.ID)
	if rr == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	if rr.Mode != "agent" {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Le LAN étendu exige un routeur en mode agent")
		return
	}
	now := model.NowISO()
	peers := tunnelProPeersLocked(db, acc.ID, client.Email, now)
	routerName, wgPeerName, wgLan := rr.Name, rr.WgPeerName, rr.WgLan
	routerIDFinal, accID := rr.ID, acc.ID
	// LAN pas encore connu : relire la dernière détection convergée.
	if wgLan == "" {
		_, lan, _, valid := tunnelLanDetectStateLocked(db, routerIDFinal)
		if valid {
			wgLan = lan
		}
	}
	peerNames := make([]string, 0, len(peers))
	peerIPs := make([]string, 0, len(peers))
	for _, p := range peers {
		peerNames = append(peerNames, p.Name)
		peerIPs = append(peerIPs, p.IPv4)
	}
	// Aucune détection exploitable → enfile wg_lan_detect (intention).
	if wgLan == "" {
		queued := false
		cmdID := ""
		for i := range db.Commands {
			cmd := &db.Commands[i]
			if cmd.RouterID == routerIDFinal && cmd.Kind == model.CmdWgLanDetect && cmd.Status == "queued" {
				queued = true
				cmdID = cmd.ID
				break
			}
		}
		if !queued {
			cmd := queueCommandLocked(db, accID, routerIDFinal, model.CmdWgLanDetect, agent.WgLanDetectPayloadFrom())
			cmdID = cmd.ID
			a.logActivity(db, accID, "router", "Détection LAN demandée sur «"+routerName+"» (activation Accès Pro)")
			a.store.Save()
		}
		a.store.Unlock()
		writeJSON(w, http.StatusAccepted, map[string]any{
			"queued": true, "commandId": cmdID,
			"message": "Détection LAN enfilée — repoll puis reprenez l'activation (≤ 45 s)",
		})
		return
	}
	a.store.Unlock()

	// ---- Brique 3 sans Pro vivant : découverte seule (pré-achat honnête) ----
	if len(peerNames) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"applied": false, "needPro": true, "lan": wgLan,
			"message": "Sous-réseau détecté : " + wgLan + " — souscrivez l'Accès Pro pour l'étendre au tunnel",
		})
		return
	}
	if wgPeerName == "" {
		writeErr(w, http.StatusConflict, "Routeur sans peer WireGuard serveur (provisionnez d'abord le tunnel du routeur dans la console MikCloud)")
		return
	}

	// ---- Noyau D-B1 (briques 2+3) : même code que le provisioning ----
	if err := a.tunnelProApplyLanCore(routerIDFinal, accID, wgPeerName, wgLan, peerNames, peerIPs); err != nil {
		writeErrCode(w, http.StatusBadGateway, "lan_apply_failed",
			"Extension du routage LAN refusée par la VM : "+err.Error(), nil)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"applied": true, "lan": wgLan, "peers": peerIPs,
		"message": "LAN " + wgLan + " étendu — récupérez la conf mise à jour dans votre espace (bouton « Voir la configuration »)",
	})
}

// tunnelProApplyLanCore — NOYAU d'application D-B1 (briques 2 + 3) pour un
// routeur, à partir des valeurs collectées sous verrou (verrou OUVERT en
// entrée — discipline N°291 : gestes wg-mini HORS verrou, re-verrou par
// résultat). Appelé par l'activation manuelle (POST /api/tunnel/pro/lan) ET
// par le provisioning d'une commande Pro (convergence du paiement) — le même
// code, la même vérité, jamais deux implémentations à dériver.
//   - brique 2 : wg-peer.sh set-lan sur la VM (AllowedIPs du peer routeur) ;
//   - re-verrou : Router.WgLan posé APRÈS succès VM (la colonne est la
//     mémoire de l'INTENTION APPLIQUÉE, jamais un mensonge de statut) +
//     commande wg_lan enfilée (règles marquées routeur, périmètre = la
//     LISTE fraîche des peers Pro — remove-then-add idempotent) ;
//   - conf des peers Pro : lan-extend VM par peer (AllowedIPs 3e entrée),
//     la copie chiffrée du cloud REMPLACÉE par la vérité VM renvoyée
//     (preuve par la conf — jamais un flag cru sur parole).
//
// Retour : nil = appliqué ; erreur = refus honnête (collision LAN, VM v4…)
// — l'appelant décide de la réponse (activation manuelle) ou de la trace
// (provisionning best-effort).
func (a *API) tunnelProApplyLanCore(routerID, accID, wgPeerName, lan string, peerNames, peerIPs []string) error {
	// ---- Brique 2 : set-lan VM (HORS verrou) ----
	if err := wgMiniSetLanFn(wgPeerName, lan); err != nil {
		return err
	}

	// ---- Re-verrou : mémoire cloud (WgLan APRÈS succès VM) + commande wg_lan ----
	a.store.Lock()
	db := a.store.Data()
	if rr := findRouterScoped(db, routerID, accID); rr != nil && rr.WgLan == "" {
		rr.WgLan = lan
	}
	if rr := findRouterScoped(db, routerID, accID); rr != nil && rr.Mode == "agent" {
		if pend := pendingCommandOfKind(db, routerID, model.CmdWgLan); pend == nil {
			queueCommandLocked(db, accID, routerID, model.CmdWgLan, agent.WgLanPayloadFrom(lan, peerIPs))
			a.logActivity(db, accID, "router", "LAN étendu "+lan+" appliqué sur «"+rr.Name+"» — règles mikcloud-wg-lan au prochain check-in (≤ 45 s), périmètre "+strings.Join(peerIPs, ", "))
		}
	}
	a.store.Save()
	a.store.Unlock()

	// ---- Conf des peers Pro : lan-extend VM par peer, copie chiffrée MAJ ----
	type extResult struct {
		name string
		conf string
		ip   string
		err  error
	}
	results := make([]extResult, 0, len(peerNames))
	for _, name := range peerNames {
		conf, ip, err := wgMiniLanExtendFn(name, lan)
		results = append(results, extResult{name: name, conf: conf, ip: ip, err: err})
	}
	a.store.Lock()
	db = a.store.Data()
	for _, res := range results {
		if res.err != nil {
			a.logActivity(db, accID, "vpn", "Extension LAN de la conf "+res.name+" échouée : "+boundedString(res.err.Error(), 160)+" — le reveal de l'espace reste la copie antérieure")
			continue
		}
		for i := range db.VpnPeers {
			p := &db.VpnPeers[i]
			if p.Name != res.name {
				continue
			}
			p.Conf = res.conf
			if res.ip != "" && agent.ValidWgSupervisionIP(res.ip) {
				p.IPv4 = res.ip
			}
			p.UpdatedAt = model.NowISO()
			break
		}
	}
	a.logActivity(db, accID, "vpn", "LAN étendu "+lan+" : conf des peers Pro mise à jour ("+strconv.Itoa(len(peerIPs))+" appareil(s)) — l'Accès Pro route désormais vers les caméras/NAS du site")
	a.store.Save()
	a.store.Unlock()
	return nil
}

// tunnelProApplyLanAllRouters — applique le LAN étendu sur tous les routeurs
// agents du compte qui ont un LAN CONNU (déjà appliqué — re-application
// idempotence avec la liste fraîche de peers — ou seulement détecté :
// l'arrivée d'un premier peer Pro l'active enfin). Appelé au provisioning
// d'une commande Pro (la convergence du paiement). Best-effort par routeur :
// une collision sur un site n'abat pas les autres — chaque échec laisse une
// trace admin, jamais un provisioning mensonger.
func (a *API) tunnelProApplyLanAllRouters(accID, email string) {
	type job struct {
		routerID, wgPeerName, lan string
	}
	jobs := []job{}
	a.store.Lock()
	db := a.store.Data()
	now := model.NowISO()
	peers := tunnelProPeersLocked(db, accID, email, now)
	peerNames := make([]string, 0, len(peers))
	peerIPs := make([]string, 0, len(peers))
	for _, p := range peers {
		peerNames = append(peerNames, p.Name)
		peerIPs = append(peerIPs, p.IPv4)
	}
	for i := range db.Routers {
		rr := &db.Routers[i]
		if rr.AccountID != accID || rr.Mode != "agent" || rr.WgPeerName == "" {
			continue
		}
		lan := rr.WgLan
		if lan == "" {
			_, detected, _, valid := tunnelLanDetectStateLocked(db, rr.ID)
			if valid {
				lan = detected
			}
		}
		if lan == "" {
			continue // rien de connu pour ce site : l'activation manuelle viendra
		}
		jobs = append(jobs, job{routerID: rr.ID, wgPeerName: rr.WgPeerName, lan: lan})
	}
	a.store.Unlock()
	if len(peerNames) == 0 {
		return // aucun peer Pro vivant (défensif — le provisioning vient d'en créer un)
	}
	for _, j := range jobs {
		if err := a.tunnelProApplyLanCore(j.routerID, accID, j.wgPeerName, j.lan, peerNames, peerIPs); err != nil {
			a.store.Lock()
			db := a.store.Data()
			a.logActivity(db, accID, "vpn", "LAN étendu "+j.lan+" non applicable au provisioning Pro : "+boundedString(err.Error(), 160)+" — activation manuelle possible dans l'espace MikTunnel")
			a.store.Save()
			a.store.Unlock()
		}
	}
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/order — commande Accès Pro (miroir renew N°314)
// ---------------------------------------------------------------------------

// handleTunnelProOrder — corps {planId, payMethod, phone?, website?
// (honeypot)} : crée la commande kind=pro (famille pro VERROUILLÉE — la
// vitrine refuse ces formules, ce canal refuse les b2c) et initie le
// paiement GeniusPay ; sans clés : bascule honnête manual. Éligibilité
// vérifiée AVANT la création (compte gérant + routeur agent) : on ne vend
// pas un Accès Pro qui ne pourrait rien superviser. Le webhook MCV-
// convergera vers provisionPublicVpnOrder (branche pro : peer remote sous
// le compte gérant + wg_setup refresh + LAN si déjà détecté).
func (a *API) handleTunnelProOrder(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<12)
	var req struct {
		PlanID    string `json:"planId"`
		PayMethod string `json:"payMethod"`
		Phone     string `json:"phone"`
		Website   string `json:"website"` // honeypot — rempli = robot
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		// Honeypot : succès factice, rien n'est créé (pattern join N°27).
		writeJSON(w, http.StatusOK, map[string]any{"ref": "", "status": model.PublicVpnOrderPending})
		return
	}
	plan := model.ResolvePublicVpnPlan(strings.TrimSpace(req.PlanID))
	if plan == nil || plan.Family != model.PublicVpnPlanFamilyPro {
		writeErr(w, http.StatusBadRequest, "Formule Pro inconnue (l'Accès Pro se souscrit ici ; le VPN B2C reste sur la vitrine MikCloud)")
		return
	}
	payMethod := strings.ToLower(strings.TrimSpace(req.PayMethod))
	if payMethod != "wave" && payMethod != "card" && payMethod != "manual" {
		writeErr(w, http.StatusBadRequest, "Moyen de paiement inconnu (wave, card ou manual)")
		return
	}
	phone := normalizeGeniusPayPhone(req.Phone)
	if payMethod == "wave" && phone == "" {
		writeErr(w, http.StatusBadRequest, "Un numéro de téléphone est requis pour payer par Wave")
		return
	}

	// ---- Vérifications + création (verrou) ----
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	// Éligibilité AVANT tout encaissement (refus honnête, pas un achat muet).
	acc, _, eligible := tunnelProEligibleLocked(db, client.Email)
	if !eligible {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "pro_ineligible",
			"L'Accès Pro relie VOS routeurs supervisés par MikCloud : connectez-vous avec l'e-mail de votre compte gérant MikCloud (un routeur en mode agent au moins)", nil)
		return
	}
	accName := acc.Name
	settings := ensureSettings(db, model.AccountMainID)
	if !(settings.Platform != nil && settings.Platform.PublicVpnShopEnabled()) {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "shop_disabled",
			"La vente MikTunnel n'est pas ouverte pour le moment", nil)
		return
	}
	if pending := model.PublicVpnOrderPendingForEmail(db, client.Email); pending != nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "order_pending_exists",
			"Une commande est déjà en attente pour cet e-mail ("+pending.Ref+") — réglez-la ou attendez son expiration", nil)
		return
	}
	if model.PublicVpnActiveOrders(db) >= model.MaxPublicVpnActiveOrders {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "shop_full",
			"Capacité momentanément atteinte — réessayez plus tard", nil)
		return
	}
	// Sans clés GeniusPay, wave/card tombent honnêtement sur le canal manual.
	_, _, online := geniusPayKeys()
	if !online && payMethod != "manual" {
		payMethod = "manual"
	}
	pr := payPricingOf(plan.BaseFcfa)
	amount := pr.ListFcfa
	if payMethod == "wave" {
		amount = pr.WaveFcfa
	}
	if payMethod == "manual" {
		amount = pr.BaseFcfa
	}
	now := model.NowISO()
	order := model.PublicVpnOrder{
		ID: model.NewID("vo-"), Ref: model.NewPublicVpnRef(db),
		Email: client.Email, Phone: digitsOf(phone),
		PlanID: plan.ID, Months: plan.Months,
		BaseAmountFcfa: pr.BaseFcfa, AmountFcfa: amount, PayMethod: payMethod,
		Kind:      model.PublicVpnKindPro,
		Status:    model.PublicVpnOrderPending,
		CreatedAt: now, UpdatedAt: now,
	}
	db.PublicVpnOrders = append(db.PublicVpnOrders, order)
	a.logActivity(db, model.AccountMainID, "vpn",
		"Commande Accès Pro créée : "+order.Ref+" (compte «"+accName+"», "+model.PublicVpnOrderLabel(order)+", "+fmt.Sprintf("%d FCFA", amount)+")")
	a.store.Save()
	a.store.Unlock()

	// ---- Initiation GeniusPay HORS verrou (miroir handleTunnelRenew) ----
	paymentURL := ""
	gatewayRef := ""
	if payMethod == "wave" || payMethod == "card" {
		payload := geniusPayCreateReq{
			Amount:        amount,
			PaymentMethod: payMethod,
			Description:   fmt.Sprintf("Accès Pro MikTunnel %s (%s) — réf %s", plan.Label, plan.PeriodLabel, order.Ref),
			Customer:      &geniusPayCustomer{Name: buyerNameOf(client.Email), Email: client.Email, Phone: phone},
			Metadata:      map[string]string{"ref": order.Ref, "plan_id": plan.ID},
		}
		returnBase := tunnelConsoleReturnURL(r)
		if returnBase == "" {
			if appURL := strings.TrimRight(strings.TrimSpace(appPublicBaseURL()), "/"); appURL != "" {
				returnBase = appURL + "/vpn"
			}
		}
		if returnBase != "" {
			payload.SuccessURL = returnBase + "?order=" + url.QueryEscape(order.Ref)
			payload.ErrorURL = returnBase + "?order=" + url.QueryEscape(order.Ref)
		}
		env, gerr := geniusPayCall(http.MethodPost, "/payments", payload)
		if gerr == nil && env != nil {
			var pay geniusPayPayment
			if len(env.Data) > 0 && json.Unmarshal(env.Data, &pay) == nil {
				gatewayRef = strings.TrimSpace(pay.Reference)
				paymentURL = pay.PaymentURL
				if paymentURL == "" {
					paymentURL = pay.CheckoutURL
				}
			}
		}
		if gatewayRef == "" {
			// Repli honnête : bascule manual + trace (l'admin tranche en console).
			payMethod = "manual"
			a.store.Lock()
			if o := model.FindPublicVpnOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.PayMethod = "manual"
				o.AmountFcfa = pr.BaseFcfa
				o.ErrorMsg = "initiation paiement en ligne impossible"
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
			a.logActivityBestEffort(order.Ref, "bascule canal manual (initiation GeniusPay impossible)")
		} else {
			a.store.Lock()
			if o := model.FindPublicVpnOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.GatewayRef = gatewayRef
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ref":        order.Ref,
		"status":     model.PublicVpnOrderPending,
		"amountFcfa": amount,
		"payMethod":  payMethod,
		"paymentUrl": paymentURL,
		"online":     payMethod == "wave" || payMethod == "card",
		"planId":     plan.ID,
	})
}
