// handlers_vpn.go — N°291 — WireGuard VENDABLE (chantier ⑦ de N°289,
// arbitrage D1-D7 de l'exploitant) : le produit « VPN client final » sur le
// wg0 de la VM, à côté du tunnel de gestion des routeurs (N°285).
//
// Décisions appliquées :
//   - D3-a : la création/révocation passe par le mini-service hôte wg-mini
//     (127.0.0.1:4020, HMAC — cf. wgmini.go) qui pilote wg-peer.sh. Aucun
//     appel réseau sous verrou : le nom est RÉSERVÉ au cloud (source de
//     vérité, D4-a), l'appel wg-mini a lieu HORS verrou, puis la ligne est
//     finalisée sous verrou.
//   - D4-a : wg0 partitionné par nommage (vpn-* vs routeurs), registre
//     cloud source de vérité, réconciliation cloud ↔ wg-mini list.
//   - D5-a : conf client chiffrée au repos (secretbox, pattern WgPSK
//     N°285) et re-livrable (reveal + Mail/Telegram) — l'argument produit.
//
// Discipline de secrets : la conf ne sort JAMAIS dans une liste (json:"-"),
// uniquement via GET /peers/{id}/conf (rang 2) ou les livraisons explicites ;
// les journaux d'activité et NotifLog ne portent que des RÉSUMÉS — jamais la
// conf ni les clés (le journal n'est pas un coffre, conventions §8).
//
// Caisse : si le gérant saisit un prix de vente à la création, UNE
// Transaction « sale » (canal direct) est écrite — visible immédiatement
// dans la caisse/compta/dashboard (collectSaleEvents compte les
// transactions « sale » hors revendeur). PAS de ligne Sale/Batch : ces
// tables journalisent le STOCK de vouchers (handlers_stats.go) et le VPN
// ne crée aucun voucher — un Sale fantôme fausserait les rapports de stock.
//
// Le module est ACTIVABLE par compte (settings.Tenant.WgVpnEnabled, défaut
// OFF — même doctrine D6 que le Cybercafé : un flag, PAS un nouvel usage).
// Toutes les routes exigent un compte hotspot (requireUsage) ; les handlers
// vérifient le flag (403 wg_vpn_disabled). La DÉSACTIVATION ne révoque RIEN :
// les peers actifs restent en service (couper des clients payants sans
// geste explicite serait une trahison de confiance) — la révocation reste
// possible peer par peer, le guard ne bloque que les NOUVEAUX gestes.
package api

import (
	"fmt"
	"html"
	"net/http"
	"net/mail"
	"sort"
	"strings"

	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/notify"
	"mikcloud/hotspot-api/internal/store"
)

// ---------------------------------------------------------------------------
// Garde du module (miroir requireCyber N°290)
// ---------------------------------------------------------------------------

// vpnEnabledLocked — le module VPN est-il actif pour CE compte ?
// (settings.Tenant.WgVpnEnabled — nil = OFF, module opt-in.) Sous verrou.
func vpnEnabledLocked(db *model.DB, acc string) bool {
	s, ok := db.SettingsByAccount[acc]
	if !ok {
		return false
	}
	return s.Tenant.WgVpnModuleEnabled()
}

// requireVpn — garde commune des handlers VPN : le module doit être activé.
// Appelée SOUS VERROU ; écrit la réponse d'erreur et renvoie false sinon.
func (a *API) requireVpn(w http.ResponseWriter, db *model.DB, acc string) bool {
	if vpnEnabledLocked(db, acc) {
		return true
	}
	writeErrCode(w, http.StatusForbidden, "wg_vpn_disabled",
		"Module VPN désactivé — activez-le pour continuer", nil)
	return false
}

// findVpnPeerIdx — index du peer scoping compte (miroir findCyberPosteIdx).
func findVpnPeerIdx(db *model.DB, id, acc string) int {
	for i := range db.VpnPeers {
		if db.VpnPeers[i].ID == id && db.VpnPeers[i].AccountID == acc {
			return i
		}
	}
	return -1
}

// vpnPeerCountLocked — peers du compte (plafond MaxVpnPeersPerAccount).
func vpnPeerCountLocked(db *model.DB, acc string) int {
	n := 0
	for i := range db.VpnPeers {
		if db.VpnPeers[i].AccountID == acc {
			n++
		}
	}
	return n
}

// ---------------------------------------------------------------------------
// Registre : liste, création (wg-mini add), révocation (wg-mini remove)
// ---------------------------------------------------------------------------

// handleVpnPeersList — GET /api/vpn/peers : les peers du compte, triés par
// création décroissante. La conf n'est JAMAIS dans la liste (json:"-") —
// le reveal est un geste explicite (GET /conf, rang 2).
func (a *API) handleVpnPeersList(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return
	}
	out := []model.VpnPeer{}
	for i := range db.VpnPeers {
		if db.VpnPeers[i].AccountID == acc {
			out = append(out, db.VpnPeers[i])
		}
	}
	a.store.Unlock()
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	writeJSON(w, http.StatusOK, out)
}

// handleVpnPeerCreate — POST /api/vpn/peers {label?, kind?, salePrice?} :
// réserve un nom vpn-* au cloud (source de vérité D4-a), appelle wg-mini add
// HORS verrou, finalise la ligne (state active + conf chiffrée au save).
// Un prix de vente > 0 enregistre la caisse (Transaction « sale » directe).
func (a *API) handleVpnPeerCreate(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		Label     string `json:"label"`
		Kind      string `json:"kind"`
		SalePrice int    `json:"salePrice"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	kind := req.Kind
	if kind == "" {
		kind = model.VpnKindFullTunnel
	}
	// N°312 — la forme « remote » (P-A, accès distant du gérant) est LIVRÉE :
	// supervision B2B de ses routeurs via le tunnel (conf 10.8.0.0/24 côté
	// VM, allowed-address du peer serveur élargi par compte — cf. le bloc
	// d'élargissement ci-dessous). Toute autre valeur reste refusée net.
	if kind != model.VpnKindFullTunnel && kind != model.VpnKindRemote {
		writeErrCode(w, http.StatusBadRequest, "vpn_kind_unavailable",
			"Forme d'accès inconnue (« "+kind+" ») — formes livrées : fulltunnel (client final), remote (supervision du gérant)", nil)
		return
	}
	if req.SalePrice < 0 || req.SalePrice > 10_000_000 {
		writeErr(w, http.StatusBadRequest, "Prix de vente invalide (0 à 10 000 000)")
		return
	}
	label := model.SanitizeDeviceName(req.Label)

	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return
	}
	if vpnPeerCountLocked(db, acc) >= model.MaxVpnPeersPerAccount {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Nombre maximum de peers VPN atteint (25)")
		return
	}
	if model.VpnPeerSlotsUsed(db) >= model.VpnWg0PoolSize {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "wg_pool_exhausted",
			"Pool wg0 de la VM épuisé (253 adresses) — révoquez des peers ou contactez 403Shield", nil)
		return
	}
	name := model.NewVpnPeerName()
	for j := 0; j < 50 && model.VpnPeerNameTaken(db, name); j++ {
		name = model.NewVpnPeerName()
	}
	if model.VpnPeerNameTaken(db, name) {
		a.store.Unlock()
		writeErr(w, http.StatusInternalServerError, "Impossible de réserver un nom de peer — réessayez")
		return
	}
	now := model.NowISO()
	created := model.VpnPeer{
		ID: model.NewID("vp-"), AccountID: acc,
		Name: name, Label: label, Kind: kind,
		State:     model.VpnStatePending,
		CreatedAt: now, UpdatedAt: now,
	}
	db.VpnPeers = append(db.VpnPeers, created)
	a.logActivityBy(r, db, acc, "vpn", "Peer VPN en création : "+name)
	a.store.Save()
	a.store.Unlock()

	// Appel réseau HORS verrou (jamais d'appel long sous le verrou global).
	conf, ip, err := wgMiniAddFn(name, kind)

	if err != nil {
		// Nettoyage VM best-effort : un add partiellement réussi ne doit pas
		// laisser un peer fantôme sur le wg0 (la conf, elle, est perdue).
		go func() { _ = wgMiniRemoveFn(name) }()
		a.store.Lock()
		db = a.store.Data()
		if idx := findVpnPeerIdx(db, created.ID, acc); idx >= 0 {
			db.VpnPeers[idx].State = model.VpnStateError
			db.VpnPeers[idx].ErrorMsg = boundedString(err.Error(), 200)
			db.VpnPeers[idx].UpdatedAt = model.NowISO()
			a.store.Save()
		}
		a.store.Unlock()
		writeErrCode(w, http.StatusBadGateway, "wg_mini_error",
			"Création impossible : "+err.Error(), nil)
		return
	}

	a.store.Lock()
	db = a.store.Data()
	idx := findVpnPeerIdx(db, created.ID, acc)
	if idx < 0 {
		// La ligne a disparu entre-temps (manœuvre concurrente) : on retire
		// ce qu'on vient de créer sur la VM pour ne pas laisser d'orphelin.
		a.store.Unlock()
		go func() { _ = wgMiniRemoveFn(name) }()
		writeErr(w, http.StatusConflict, "État du peer modifié entre-temps — réessayez")
		return
	}
	row := &db.VpnPeers[idx]
	row.State = model.VpnStateActive
	row.IPv4 = ip
	row.Conf = conf
	row.ErrorMsg = ""
	row.UpdatedAt = model.NowISO()
	// Caisse (optionnelle) : UNE Transaction « sale », canal direct —
	// comptée immédiatement par la caisse/compta (cf. en-tête de fichier :
	// pas de Sale/Batch, le VPN ne crée pas de stock de vouchers).
	if req.SalePrice > 0 {
		db.Transactions = append([]model.Transaction{{
			ID: model.NewID("tx-"), AccountID: acc, Type: "sale",
			Amount: req.SalePrice,
			Note:   "VPN " + name + " — " + model.VpnPeerLabel(*row),
			At:     model.NowISO(),
		}}, db.Transactions...)
		a.logActivityBy(r, db, acc, "vpn", "Vente VPN enregistrée : "+name+" ("+fmt.Sprintf("%d FCFA", req.SalePrice)+")")
	}
	kindNote := ""
	if kind == model.VpnKindRemote {
		kindNote = " — supervision"
	}
	a.logActivityBy(r, db, acc, "vpn", "Peer VPN créé : "+name+" ("+ip+kindNote+")")
	// N°312 — forme remote : la liste allowedSources des routeurs du compte
	// s'ÉLARGIT avec la nouvelle IP — re-livraison automatique de wg_setup aux
	// routeurs agents ACTIFS du compte (application ≤ 45 s par routeur au
	// check-in ; les non-actifs convergent à leur prochain provisionnement).
	if kind == model.VpnKindRemote {
		a.queueWgSetupRefreshLocked(r, db, acc, "supervision élargie : "+ip)
	}
	out := *row
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// handleVpnPeerRevoke — POST /api/vpn/peers/{id}/revoke : wg-peer.sh remove
// (bloc [Peer] retiré + syncconf à chaud, les autres peers restent intacts)
// puis la ligne quitte le registre. En cas d'échec wg-mini, la ligne passe
// en error (réessai possible) — on ne supprime JAMAIS le registre tant que
// la VM n'a pas confirmé (sinon peer fantôme facturé pour rien).
func (a *API) handleVpnPeerRevoke(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("id")
	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return
	}
	idx := findVpnPeerIdx(db, id, acc)
	if idx < 0 {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Peer introuvable")
		return
	}
	if db.VpnPeers[idx].State == model.VpnStatePending {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Création en cours — réessayez dans un instant")
		return
	}
	peer := db.VpnPeers[idx]
	a.store.Unlock()

	err := wgMiniRemoveFn(peer.Name)

	a.store.Lock()
	db = a.store.Data()
	idx = findVpnPeerIdx(db, id, acc)
	if idx < 0 {
		a.store.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Peer révoqué"})
		return
	}
	if err != nil {
		db.VpnPeers[idx].State = model.VpnStateError
		db.VpnPeers[idx].ErrorMsg = boundedString(err.Error(), 200)
		db.VpnPeers[idx].UpdatedAt = model.NowISO()
		a.store.Save()
		a.store.Unlock()
		writeErrCode(w, http.StatusBadGateway, "wg_mini_error",
			"Révocation impossible : "+err.Error(), nil)
		return
	}
	db.VpnPeers = append(db.VpnPeers[:idx], db.VpnPeers[idx+1:]...)
	a.logActivityBy(r, db, acc, "vpn", "Peer VPN révoqué : "+peer.Name+" ("+model.VpnPeerLabel(peer)+")")
	// N°312 — remote : la liste du compte se RÉDUIT — re-livraison d'hygiène
	// (le peer VM est déjà retiré, une entrée allowed-address résiduelle serait
	// de toute façon inerte : sans peer côté VM, rien ne peut signer de ces
	// paquets — ceinture ET bretelles, jamais d'état mensonger).
	if peer.Kind == model.VpnKindRemote {
		a.queueWgSetupRefreshLocked(r, db, acc, "supervision révoquée : "+peer.IPv4)
	}
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Peer révoqué — le client n'a plus d'accès (wg0 mis à jour à chaud)",
	})
}

// ---------------------------------------------------------------------------
// Re-livraison de la conf (D5-a) : reveal, e-mail, Telegram
// ---------------------------------------------------------------------------

// vpnPeerConfResolved — retrouve le peer et sa conf, avec self-healing : si
// la copie cloud a été perdue (peer créé avant un restore, ligne importée),
// la conf est relue côté VM (wg-mini conf) et re-mise au coffre. Les erreurs
// sont écrites directement ; ok=false = réponse déjà envoyée.
func (a *API) vpnPeerConfResolved(w http.ResponseWriter, r *http.Request, acc, id string) (model.VpnPeer, string, bool) {
	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return model.VpnPeer{}, "", false
	}
	idx := findVpnPeerIdx(db, id, acc)
	if idx < 0 {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Peer introuvable")
		return model.VpnPeer{}, "", false
	}
	peer := db.VpnPeers[idx]
	if peer.State == model.VpnStatePending {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Création en cours — réessayez dans un instant")
		return model.VpnPeer{}, "", false
	}
	conf := peer.Conf
	a.store.Unlock()
	if conf != "" {
		return peer, conf, true
	}
	// Self-healing : la conf cloud est vide — relecture côté VM.
	fresh, err := wgMiniConfFn(peer.Name)
	if err != nil {
		writeErrCode(w, http.StatusBadGateway, "wg_mini_error",
			"Conf indisponible : "+err.Error(), nil)
		return model.VpnPeer{}, "", false
	}
	a.store.Lock()
	db = a.store.Data()
	if idx := findVpnPeerIdx(db, id, acc); idx >= 0 && db.VpnPeers[idx].Conf == "" {
		db.VpnPeers[idx].Conf = fresh
		a.store.Save()
	}
	a.store.Unlock()
	peer.Conf = fresh
	return peer, fresh, true
}

// handleVpnPeerConf — GET /api/vpn/peers/{id}/conf (rang 2) : reveal de la
// conf (re-livraison manuelle : copier ou QR). Geste explicite, jamais dans
// les listes.
func (a *API) handleVpnPeerConf(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	peer, conf, ok := a.vpnPeerConfResolved(w, r, acc, r.PathValue("id"))
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": peer.ID, "name": peer.Name, "label": model.VpnPeerLabel(peer),
		"ipv4": peer.IPv4, "conf": conf,
	})
}

// vpnDeliveryBody — le texte livré au client (e-mail/Telegram) : la conf
// COMPLÈTE (c'est le produit) + les instructions minimales. N°312 — la forme
// « remote » (supervision B2B) reçoit les instructions adaptées : le tunnel
// ne route QUE le sous-réseau 10.8.0.0/24 (ses routeurs + la VM). Les
// journaux, eux, ne portent que le résumé (vpnDeliveryLogBody).
func vpnDeliveryBody(peer model.VpnPeer, conf string) string {
	var sb strings.Builder
	sb.WriteString("403Shield — Votre accès VPN WireGuard\n")
	sb.WriteString("Accès : " + peer.Name)
	if model.VpnPeerLabel(peer) != peer.Name {
		sb.WriteString(" (« " + model.VpnPeerLabel(peer) + " »)")
	}
	sb.WriteString("\n\n")
	sb.WriteString("1. Installez l'application WireGuard (App Store / Google Play / wireguard.com/install).\n")
	sb.WriteString("2. Dans WireGuard : « + » → « Importer depuis un fichier ou un QR code ».\n")
	sb.WriteString("3. Collez la configuration ci-dessous (ou scannez le QR affiché dans la console 403Shield).\n\n")
	if peer.Kind == model.VpnKindRemote {
		sb.WriteString("Cet accès donne la SUPERVISION de vos routeurs 403Shield à travers le tunnel\n")
		sb.WriteString("chiffré : Winbox, l'API RouterOS, SSH ou l'interface web de chaque routeur\n")
		sb.WriteString("restent joignables à leur adresse tunnel 10.8.0.x, où que vous soyez\n")
		sb.WriteString("(CGNAT traversé, keepalive 25 s). Le tunnel ne route RIEN d'autre — ni\n")
		sb.WriteString("votre navigation Internet, ni votre DNS local.\n\n")
	}
	sb.WriteString(conf)
	return sb.String()
}

// vpnDeliveryLogBody — le RÉSUMÉ pour NotifLog/journaux : JAMAIS la conf
// (le journal n'est pas un coffre — conventions §8, clés hors logs).
func vpnDeliveryLogBody(peer model.VpnPeer, dest string) string {
	return "Conf VPN " + peer.Name + " (« " + model.VpnPeerLabel(peer) + " ») envoyée à " + dest
}

// handleVpnPeerEmail — POST /api/vpn/peers/{id}/email {to} : livraison de la
// conf par e-mail (fournisseur du compte, relais plateforme en secours —
// N°150). Envoi asynchrone (dispatchEmailTask — un envoi ne tient jamais la
// requête ni le verrou), trace sans secret dans NotifLog.
func (a *API) handleVpnPeerEmail(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		To string `json:"to"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(req.To))
	if err != nil || addr.Address == "" {
		writeErr(w, http.StatusBadRequest, "Adresse e-mail invalide")
		return
	}
	peer, conf, ok := a.vpnPeerConfResolved(w, r, acc, r.PathValue("id"))
	if !ok {
		return
	}
	a.store.Lock()
	cfg := store.GetOrCreateNotifSettings(a.store.Data(), acc)
	var platformEmail model.NotificationSettings // N°150 : relais du compte principal
	hasRelay := false
	if ptr := a.platformEmailRelayPtrLocked(a.store.Data()); ptr != nil {
		platformEmail = *ptr // copie VALEUR : la goroutine ne touche jamais au store
		hasRelay = true
	}
	a.store.Unlock()
	var relayPtr *model.NotificationSettings
	if hasRelay {
		relayPtr = &platformEmail
	}
	if !notify.ConfiguredWithPlatform(&cfg, relayPtr, "email") {
		writeErr(w, http.StatusBadRequest, "Canal e-mail non configuré — renseignez-le dans Notifications (ou activez le relais plateforme)")
		return
	}
	title := "403Shield — Votre accès VPN WireGuard (" + peer.Name + ")"
	body := vpnDeliveryBody(peer, conf)
	htmlBody := "<p>Votre accès VPN WireGuard est prêt. Importez la configuration ci-dessous dans l'application WireGuard (menu « + » → importer).</p><pre style=\"white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px\">" + html.EscapeString(conf) + "</pre><p style=\"color:#888;font-size:12px\">Gardez cette configuration secrète : elle donne un accès complet.</p>"
	cfgCopy := cfg
	to := addr.Address
	logBody := vpnDeliveryLogBody(peer, to)
	emailTaskDispatch()(func() {
		sendErr := accountEmailSender()(&cfgCopy, to, title, body, htmlBody)
		status, errText := "sent", ""
		if sendErr != nil {
			status, errText = "error", sendErr.Error()
		}
		a.store.Lock()
		db := a.store.Data()
		db.NotifLog = append(db.NotifLog, model.NotificationLog{
			ID: model.NewID("n-"), Status: status, Error: errText,
			Channel: "email", Kind: "vpn_peer",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "queued": true,
		"message": "Envoi e-mail en cours vers " + to + " — vérifiez l'historique de notification",
	})
}

// handleVpnPeerTelegram — POST /api/vpn/peers/{id}/telegram : livraison de
// la conf sur le chat Telegram du compte (bot du gérant — N°154). Envoi
// SYNCHRONE (même discipline que le test de notification) : le résultat est
// connu immédiatement, la trace ne porte pas la conf.
func (a *API) handleVpnPeerTelegram(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	peer, conf, ok := a.vpnPeerConfResolved(w, r, acc, r.PathValue("id"))
	if !ok {
		return
	}
	a.store.Lock()
	cfg := store.GetOrCreateNotifSettings(a.store.Data(), acc)
	a.store.Unlock()
	if !notify.ConfiguredWithPlatform(&cfg, nil, "telegram") {
		writeErr(w, http.StatusBadRequest, "Canal Telegram non configuré — appareillez le bot dans Notifications")
		return
	}
	title := "403Shield — Votre accès VPN WireGuard (" + peer.Name + ")"
	if err := telegramSendFn(cfg.TelegramBotToken, cfg.TelegramChatID, title+"\n\n"+vpnDeliveryBody(peer, conf)); err != nil {
		a.store.Lock()
		db := a.store.Data()
		db.NotifLog = append(db.NotifLog, model.NotificationLog{
			ID: model.NewID("n-"), Status: "error", Error: err.Error(),
			Channel: "telegram", Kind: "vpn_peer",
			Title: title, Body: vpnDeliveryLogBody(peer, "Telegram"), At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Envoi Telegram impossible : "+err.Error())
		return
	}
	a.store.Lock()
	db := a.store.Data()
	db.NotifLog = append(db.NotifLog, model.NotificationLog{
		ID: model.NewID("n-"), Status: "sent",
		Channel: "telegram", Kind: "vpn_peer",
		Title: title, Body: vpnDeliveryLogBody(peer, "Telegram"), At: model.NowISO(),
	})
	a.logActivityBy(r, db, acc, "vpn", "Conf VPN livrée sur Telegram : "+peer.Name)
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Conf envoyée sur Telegram"})
}

// ---------------------------------------------------------------------------
// N°312 — forme « remote » : élargissement allowed-address PAR COMPTE
// ---------------------------------------------------------------------------

// wgAllowedSourcesLocked — la valeur de la clé « allowedSources » du payload
// wg_setup pour CE compte : le socle de gestion (10.8.0.1/32, chemin VM ↔
// routeur — jamais retiré) + l'IP /32 de chaque peer « remote » du compte
// (tous états tant qu'une IP tunnel est allouée : un peer « error » peut
// encore émettre tant que son bloc vit sur le wg0). Source de vérité : le
// registre cloud (D4-a). ISOLEMENT multi-tenant : les peers FULLTUNNEL ne
// figurent JAMAIS dans la liste (le produit « client final » ne supervise
// rien) et les peers remote d'AUTRES comptes non plus — le routeur de CE
// compte n'accepte QUE son propre gérant. N°313 — les peers remote frais
// vivent sur le segment 10.8.2.0/24 (ValidWgSupervisionIP accepte les DEUX
// segments, historique 10.8.0.x et frais 10.8.2.x — jamais le B2C 10.8.1.x).
func wgAllowedSourcesLocked(db *model.DB, acc string) string {
	items := []string{agent.WgDefaultAllowedSources}
	seen := map[string]bool{agent.WgDefaultAllowedSources: true}
	for i := range db.VpnPeers {
		p := &db.VpnPeers[i]
		if p.AccountID != acc || p.Kind != model.VpnKindRemote || p.IPv4 == "" {
			continue
		}
		ip := strings.TrimSpace(p.IPv4)
		if !agent.ValidWgSupervisionIP(ip) || seen[ip+"/32"] {
			continue
		}
		seen[ip+"/32"] = true
		items = append(items, ip+"/32")
	}
	return strings.Join(items, ",")
}

// queueWgSetupRefreshLocked — N°312 — re-file wg_setup aux routeurs agents
// ACTIFS du compte avec la liste allowedSources FRAÎCHE (élargie à la création
// d'un peer remote, réduite à sa révocation). Idempotent par construction
// (remove-then-add côté routeur) ; les routeurs non actifs convergent à leur
// prochain provisionnement (wg-auto/wg-params calculent la liste du jour) ;
// un wg_setup déjà en file/vol n'est PAS doublé (pattern N°115) — la
// convergence de traîne est garantie par la comparaison au RÉSULTAT
// (agent_handlers.go : liste appliquée ≠ liste courante → re-file). Retour :
// le nombre de routeurs reconfigurés (journal par routeur, pas de résumé).
func (a *API) queueWgSetupRefreshLocked(r *http.Request, db *model.DB, acc, reason string) int {
	n := 0
	for i := range db.Routers {
		rot := &db.Routers[i]
		if rot.AccountID != acc || rot.Mode != "agent" || rot.WgState != "active" {
			continue
		}
		if rot.WgIPv4 == "" || rot.WgServerPub == "" || rot.WgPSK == "" {
			continue // paramètres incomplets : aucun re-file possible (reprendre le provisionnement complet)
		}
		if pendingCommandOfKind(db, rot.ID, model.CmdWgSetup) != nil {
			continue // déjà en file/vol : la vérification au résultat reconvergera
		}
		host, port, err := parseEndpointWG(rot.WgEndpoint)
		if err != nil || !agent.ValidWgIPv4(rot.WgIPv4) || !agent.ValidWgKey(rot.WgServerPub) || !agent.ValidWgKey(rot.WgPSK) {
			continue // valeurs stockées avariées (restore, main d'œuvre) : ne JAMAIS bloquer le geste VPN sur un routeur avarié
		}
		payload := agent.WgSetupPayloadFrom(rot.WgServerPub, rot.WgPSK, agent.WgIPv4WithPrefix(rot.WgIPv4), host, port, wgAllowedSourcesLocked(db, acc))
		queueCommandLocked(db, acc, rot.ID, model.CmdWgSetup, payload)
		rot.WgState = "pending_setup"
		rot.WgError = ""
		if r != nil {
			a.logActivityBy(r, db, acc, "router", "Tunnel WireGuard re-livré sur «"+rot.Name+"» (« "+reason+" ») — application au prochain check-in (≤ 45 s)")
		} else {
			a.logActivity(db, acc, "router", "Tunnel WireGuard re-livré sur «"+rot.Name+"» (« "+reason+" ») — application au prochain check-in (≤ 45 s)")
		}
		n++
	}
	return n
}

// ---------------------------------------------------------------------------
// Statut, réconciliation (check D4), activation du module
// ---------------------------------------------------------------------------

// handleVpnStatus — GET /api/vpn/status : jauge du pool wg0 (slots utilisés,
// tous registres confondus) + santé du mini-service (dot console).
func (a *API) handleVpnStatus(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return
	}
	slots := model.VpnPeerSlotsUsed(db)
	// N°311 — quota mensuel EFFECTIF (setting plateforme, défaut 50 Go,
	// 0 = illimité) : le dénominateur des jauges par peer de la console.
	quotaGB := model.DefaultWgVpnMonthlyQuotaGB
	if s, ok := db.SettingsByAccount[model.AccountMainID]; ok && s.Platform != nil {
		quotaGB = s.Platform.WgVpnMonthlyQuotaEffective()
	}
	a.store.Unlock()
	// Health check HORS verrou (appel réseau).
	miniErr := wgMiniPingFn()
	resp := map[string]any{
		"slotsUsed":      slots,
		"slotsPool":      model.VpnWg0PoolSize,
		"quotaMonthlyGb": quotaGB,
		"miniReachable":  miniErr == nil,
	}
	if miniErr != nil {
		resp["miniError"] = boundedString(miniErr.Error(), 200)
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleVpnReconcile — GET /api/vpn/reconcile (rang 2) : le check D4 —
// les peers ACTIFS de CE compte sont-ils bien présents sur le wg0 de la VM ?
// Détecte la divergence cloud/VM (restore, main d'œuvre SSH, peer fantôme).
// Le regard reste per-compte : l'hygiène GLOBALE du pool est l'affaire des
// ops (wg-peer.sh list en SSH), pas celle de chaque gérant.
func (a *API) handleVpnReconcile(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	a.store.Lock()
	db := a.store.Data()
	if !a.requireVpn(w, db, acc) {
		a.store.Unlock()
		return
	}
	mine := map[string]bool{}
	for i := range db.VpnPeers {
		if db.VpnPeers[i].AccountID == acc && db.VpnPeers[i].State == model.VpnStateActive {
			mine[db.VpnPeers[i].Name] = true
		}
	}
	a.store.Unlock()
	peers, err := wgMiniListFn()
	if err != nil {
		writeErrCode(w, http.StatusBadGateway, "wg_mini_error",
			"Réconciliation impossible : "+err.Error(), nil)
		return
	}
	vm := map[string]bool{}
	for _, p := range peers {
		vm[p.Name] = true
	}
	missing := []string{}
	for name := range mine {
		if !vm[name] {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)
	writeJSON(w, http.StatusOK, map[string]any{
		"reachable":   true,
		"vmPeerCount": len(peers),
		"mine":        len(mine),
		"missing":     missing,
	})
}

// handleVpnSettings — PUT /api/vpn/settings {enabled} (rang 3) : active ou
// désactive le module. La DÉSACTIVATION ne révoque RIEN (les peers actifs
// restent en service — cf. en-tête) : elle ferme seulement les nouveaux
// gestes via le guard wg_vpn_disabled.
//
// N°301 — verrou grossiste : si la plateforme a RETIRÉ le module (console
// « VPN & Vente directe »), le gérant ne peut plus le réactiver seul —
// l'octroi est un geste de la plateforme (403 wg_vpn_locked, message clair
// renvoyant vers le support). Nil = non verrouillé : comportement N°291
// inchangé pour tous les comptes existants.
func (a *API) handleVpnSettings(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	a.store.Lock()
	db := a.store.Data()
	if req.Enabled {
		if s, ok := db.SettingsByAccount[acc]; ok && s.Tenant.WgVpnModuleLocked() {
			a.store.Unlock()
			writeErrCode(w, http.StatusForbidden, "wg_vpn_locked",
				"Module VPN retiré par la plateforme 403Shield — contactez le support pour l'octroi", nil)
			return
		}
	}
	settings := ensureSettings(db, acc)
	settings.Tenant.WgVpnEnabled = &req.Enabled
	db.SettingsByAccount[acc] = settings
	if req.Enabled {
		a.logActivityBy(r, db, acc, "vpn", "Module VPN WireGuard activé")
	} else {
		a.logActivityBy(r, db, acc, "vpn", "Module VPN WireGuard désactivé (les peers actifs restent en service — révocation peer par peer)")
	}
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, settings)
}
