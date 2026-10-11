// handlers_platform_vpn.go — N°301 — console plateforme « VPN & Vente
// directe » (le grossiste) : /api/admin/vpn/*, réservé aux administrateurs
// de la plateforme (requireRole(3) à l'enregistrement + garde
// isPlatformAdmin DOUBLÉE dans chaque handler — discipline des routes
// /api/admin/* : un owner de compte CLIENT passe requireRole(3) mais est
// bloqué ici).
//
// LE REGISTRE GROSSISTE (ce que SSH faisait à la main, cf. commentaire
// handlers_vpn.go « l'hygiène GLOBALE du pool est l'affaire des ops ») :
//   - GET  /api/admin/vpn/overview  : jauge du pool wg0 TOUS comptes confondus
//   - santé wg-mini + répartition par compte (module, verrou, peers) +
//     statistiques B2C (commandes, encaissements, vitrine) ;
//   - GET  /api/admin/vpn/peers     : CHAQUE peer de la VM avec son compte,
//     enrichi de la télémétrie wg-mini (handshake, transfert) — fusion des
//     deux registres + B2C (commande liée, e-mail, terme) ;
//   - POST /api/admin/vpn/peers/{id}/revoke : révocation PLATEFORME d'un peer
//     de N'IMPORTE QUEL compte (le levier ops du grossiste) ;
//   - PUT  /api/admin/vpn/accounts/{id}/module : octroi/retrait du module de
//     revente pour un compte (le retrait VERROUILLE : le gérant ne peut plus
//     réactiver seul — PUT /api/vpn/settings refuse avec 403 wg_vpn_locked) ;
//   - GET  /api/admin/vpn/orders    : commandes B2C (vente directe) ;
//   - POST /api/admin/vpn/orders/{id}/resolve : confirmation manuelle
//     (markPaid → provisioning auto) ou annulation (révoque le peer) ;
//   - GET  /api/admin/vpn/reconcile : réconciliation GLOBALE cloud ↔ wg-mini
//     (manquants + fantômes — remplace le « wg-peer.sh list en SSH »).
//
// Aucune conf ne sort de ces routes : les peers listés portent l'état et la
// télémétrie, JAMAIS le champ Conf (json:"-" du modèle) — le reveal reste le
// geste explicite du gérant propriétaire (rang 2, scoping compte) pour les
// peers revendus ; pour le B2C c'est l'e-mail de livraison/self-service.
package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// requirePlatformVpn — garde commune (dans le handler, double barrière) :
// admin plateforme uniquement. Écrit la réponse et renvoie false sinon.
func (a *API) requirePlatformVpn(w http.ResponseWriter, r *http.Request) bool {
	if !isPlatformAdmin(r) {
		writeErr(w, http.StatusForbidden, "Réservé aux administrateurs de la plateforme")
		return false
	}
	return true
}

// ---------------------------------------------------------------------------
// GET /api/admin/vpn/overview — le tableau de bord du grossiste
// ---------------------------------------------------------------------------

// handlePlatformVpnOverview — jauge du pool global, santé wg-mini,
// répartition par compte, statistiques B2C.
func (a *API) handlePlatformVpnOverview(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	a.store.Lock()
	db := a.store.Data()
	slotsUsed := model.VpnPeerSlotsUsed(db)
	// Répartition par compte : TOUS les comptes clients (l'octroi du module
	// doit pouvoir cibler un compte qui ne l'a jamais activé — sinon la
	// table grossiste ne montrerait que des comptes déjà convertis) + la
	// ligne B2C du compte principal.
	type accRow struct {
		AccountID   string `json:"accountId"`
		AccountName string `json:"accountName"`
		Usage       string `json:"usage"`
		ModuleOn    bool   `json:"moduleOn"`
		Locked      bool   `json:"locked"`
		PeersActive int    `json:"peersActive"`
		PeersTotal  int    `json:"peersTotal"`
	}
	peersByAcc := map[string]*accRow{}
	for i := range db.VpnPeers {
		row := peersByAcc[db.VpnPeers[i].AccountID]
		if row == nil {
			row = &accRow{AccountID: db.VpnPeers[i].AccountID}
			peersByAcc[db.VpnPeers[i].AccountID] = row
		}
		row.PeersTotal++
		if db.VpnPeers[i].State == model.VpnStateActive {
			row.PeersActive++
		}
	}
	for i := range db.Accounts {
		if db.Accounts[i].ID == model.AccountMainID {
			continue // ligne dédiée ci-dessous (vente directe)
		}
		if peersByAcc[db.Accounts[i].ID] == nil {
			peersByAcc[db.Accounts[i].ID] = &accRow{AccountID: db.Accounts[i].ID}
		}
	}
	for i := range db.Accounts {
		if row, ok := peersByAcc[db.Accounts[i].ID]; ok {
			row.AccountName = db.Accounts[i].Name
			row.Usage = db.Accounts[i].Usage
		}
	}
	if row, ok := peersByAcc[model.AccountMainID]; ok {
		row.AccountName = "MikCloud (vente directe B2C)"
	}
	accounts := make([]accRow, 0, len(peersByAcc))
	for _, row := range peersByAcc {
		if s, ok := db.SettingsByAccount[row.AccountID]; ok {
			row.ModuleOn = s.Tenant.WgVpnModuleEnabled()
			row.Locked = s.Tenant.WgVpnModuleLocked()
		}
		accounts = append(accounts, *row)
	}
	sort.Slice(accounts, func(i, j int) bool {
		if accounts[i].PeersTotal != accounts[j].PeersTotal {
			return accounts[i].PeersTotal > accounts[j].PeersTotal
		}
		return accounts[i].AccountID < accounts[j].AccountID
	})
	// Statistiques B2C (struct typée — pas d'assertions à rallonge).
	type b2cStats struct {
		Pending     int  `json:"pending"`
		Paid        int  `json:"paid"`
		Provisioned int  `json:"provisioned"`
		Cancelled   int  `json:"cancelled"`
		Expired     int  `json:"expired"`
		RevenueFcfa int  `json:"revenueFcfa"`
		Orders30d   int  `json:"orders30d"`
		ShopEnabled bool `json:"shopEnabled"`
	}
	b2c := b2cStats{}
	if settings, ok := db.SettingsByAccount[model.AccountMainID]; ok && settings.Platform != nil {
		b2c.ShopEnabled = settings.Platform.PublicVpnShopEnabled()
	}
	cutoff30d := time.Now().UTC().AddDate(0, 0, -30).Format(time.RFC3339)
	for i := range db.PublicVpnOrders {
		o := &db.PublicVpnOrders[i]
		switch o.Status {
		case model.PublicVpnOrderPending:
			b2c.Pending++
		case model.PublicVpnOrderPaid:
			b2c.Paid++
		case model.PublicVpnOrderProvisioned:
			b2c.Provisioned++
		case model.PublicVpnOrderCancelled:
			b2c.Cancelled++
		case model.PublicVpnOrderExpired:
			b2c.Expired++
		}
		if (o.Status == model.PublicVpnOrderProvisioned || o.Status == model.PublicVpnOrderExpired) && o.PaidAt >= cutoff30d {
			b2c.RevenueFcfa += o.AmountFcfa
			b2c.Orders30d++
		}
	}
	a.store.Unlock()

	// Santé wg-mini HORS verrou (appel réseau, pattern handleVpnStatus).
	miniErr := wgMiniPingFn()
	mini := map[string]any{"reachable": miniErr == nil}
	if miniErr != nil {
		mini["error"] = boundedString(miniErr.Error(), 200)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"pool": map[string]any{
			"slotsUsed": slotsUsed,
			"slotsPool": model.VpnWg0PoolSize,
			"byAccount": accounts,
		},
		"mini": mini,
		"b2c":  b2c,
	})
}

// ---------------------------------------------------------------------------
// GET /api/admin/vpn/peers — le registre global enrichi (télémétrie VM)
// ---------------------------------------------------------------------------

// handlePlatformVpnPeers — CHAQUE peer du wg0 : registre cloud (compte,
// état) + télémétrie wg-mini (handshake, transfert) + contexte B2C
// (commande, e-mail, terme). La conf ne sort JAMAIS (json:"-").
func (a *API) handlePlatformVpnPeers(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	a.store.Lock()
	db := a.store.Data()
	type peerRow struct {
		model.VpnPeer
		AccountName string `json:"accountName"`
		B2C         bool   `json:"b2c"`
		OrderEmail  string `json:"orderEmail,omitempty"`
		OrderRef    string `json:"orderRef,omitempty"`
		ExpiresAt   string `json:"expiresAt,omitempty"`
		Handshake   string `json:"handshake,omitempty"`
		Transfer    string `json:"transfer,omitempty"`
	}
	accountNames := map[string]string{}
	for i := range db.Accounts {
		accountNames[db.Accounts[i].ID] = db.Accounts[i].Name
	}
	accountNames[model.AccountMainID] = "MikCloud (vente directe B2C)"
	ordersByPeer := map[string]model.PublicVpnOrder{}
	for i := range db.PublicVpnOrders {
		if db.PublicVpnOrders[i].PeerID != "" {
			ordersByPeer[db.PublicVpnOrders[i].PeerID] = db.PublicVpnOrders[i]
		}
	}
	rows := make([]peerRow, 0, len(db.VpnPeers))
	for i := range db.VpnPeers {
		row := peerRow{VpnPeer: db.VpnPeers[i]}
		row.AccountName = accountNames[row.AccountID]
		if row.AccountID == model.AccountMainID {
			row.B2C = true
		}
		if o, ok := ordersByPeer[row.ID]; ok {
			row.OrderEmail = o.Email
			row.OrderRef = o.Ref
			row.ExpiresAt = o.ExpiresAt
		}
		rows = append(rows, row)
	}
	a.store.Unlock()

	// Télémétrie wg-mini HORS verrou : fusion par nom de peer (best-effort —
	// wg-mini injoignable = colonnes vides, jamais d'échec de la liste).
	vmReachable := false
	if peers, err := wgMiniListFn(); err == nil {
		vmReachable = true
		for i := range rows {
			for _, p := range peers {
				if p.Name == rows[i].Name {
					rows[i].Handshake = p.Handshake
					rows[i].Transfer = p.Transfer
				}
			}
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].CreatedAt > rows[j].CreatedAt })
	writeJSON(w, http.StatusOK, map[string]any{
		"peers":       rows,
		"vmReachable": vmReachable,
	})
}

// ---------------------------------------------------------------------------
// POST /api/admin/vpn/peers/{id}/revoke — le levier ops du grossiste
// ---------------------------------------------------------------------------

// handlePlatformVpnPeerRevoke — révocation PLATEFORME d'un peer de N'IMPORTE
// QUEL compte (le client concerné perd l'accès, les autres restent intacts —
// wg-peer.sh remove + syncconf à chaud). Un peer B2C lié entraîne sa
// commande en « cancelled » (cohérence registre). Échec wg-mini : la ligne
// passe en error, le registre n'est JAMAIS purgé tant que la VM n'a pas
// confirmé (discipline « pas de peer fantôme » N°291).
func (a *API) handlePlatformVpnPeerRevoke(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	id := r.PathValue("id")
	a.store.Lock()
	db := a.store.Data()
	idx := -1
	for i := range db.VpnPeers {
		if db.VpnPeers[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Peer introuvable")
		return
	}
	peer := db.VpnPeers[idx]
	if peer.State == model.VpnStatePending {
		a.store.Unlock()
		writeErr(w, http.StatusConflict, "Création en cours — réessayez dans un instant")
		return
	}
	a.store.Unlock()

	// Retrait wg0 HORS verrou (à chaud, les autres peers restent intacts).
	err := wgMiniRemoveFn(peer.Name)

	a.store.Lock()
	db = a.store.Data()
	idx = -1
	for i := range db.VpnPeers {
		if db.VpnPeers[i].ID == peer.ID {
			idx = i
			break
		}
	}
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
	// Commande B2C liée : annulée APRÈS confirmation VM (cohérence registre —
	// jamais d'état mensonger si wg-mini échoue).
	for i := range db.PublicVpnOrders {
		if db.PublicVpnOrders[i].PeerID == peer.ID && db.PublicVpnOrders[i].Status == model.PublicVpnOrderProvisioned {
			db.PublicVpnOrders[i].Status = model.PublicVpnOrderCancelled
			db.PublicVpnOrders[i].UpdatedAt = model.NowISO()
			db.PublicVpnOrders[i].ResolvedBy = "révocation plateforme (peer)"
			db.PublicVpnOrders[i].ErrorMsg = "peer révoqué par la plateforme"
		}
	}
	a.logActivityBy(r, db, model.AccountMainID, "vpn",
		"Peer VPN révoqué par la plateforme : "+peer.Name+" ("+model.VpnPeerLabel(peer)+")")
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Peer révoqué — le client n'a plus d'accès (wg0 mis à jour à chaud)",
	})
}

// ---------------------------------------------------------------------------
// PUT /api/admin/vpn/accounts/{id}/module — octroi / retrait du droit de revente
// ---------------------------------------------------------------------------

// handlePlatformVpnModule — corps {enabled} : octroi (active + déverrouille)
// ou retrait (désactive + VERROUILLE — le gérant ne peut plus réactiver
// seul). La désactivation ne révoque RIEN (les peers actifs restent en
// service — même doctrine que le toggle gérant N°291). Le compte principal
// n'est pas éligible (il porte le B2C, pas la revente).
func (a *API) handlePlatformVpnModule(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	accID := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	a.store.Lock()
	db := a.store.Data()
	if accID == model.AccountMainID {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Le compte principal n'utilise pas le module de revente (il porte la vente directe B2C)")
		return
	}
	found := false
	for i := range db.Accounts {
		if db.Accounts[i].ID == accID {
			found = true
			break
		}
	}
	if !found {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Compte introuvable")
		return
	}
	settings := ensureSettings(db, accID)
	settings.Tenant.WgVpnEnabled = &req.Enabled
	locked := !req.Enabled
	settings.Tenant.WgVpnLocked = &locked
	db.SettingsByAccount[accID] = settings
	accName := ""
	for i := range db.Accounts {
		if db.Accounts[i].ID == accID {
			accName = db.Accounts[i].Name
			break
		}
	}
	if req.Enabled {
		a.logActivityBy(r, db, model.AccountMainID, "vpn",
			"Module VPN OCTROYÉ au compte "+accName+" ("+accID+") — le gérant peut vendre")
	} else {
		a.logActivityBy(r, db, model.AccountMainID, "vpn",
			"Module VPN RETIRÉ au compte "+accName+" ("+accID+") — verrouillé, les peers actifs restent en service")
	}
	a.store.Save()
	a.store.Unlock()
	msg := "Module VPN activé pour ce compte — le gérant peut vendre"
	if !req.Enabled {
		msg = "Module VPN retiré et verrouillé — le gérant ne peut plus le réactiver (les peers actifs restent en service)"
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": msg})
}

// ---------------------------------------------------------------------------
// GET /api/admin/vpn/orders — commandes B2C (vente directe)
// ---------------------------------------------------------------------------

// handlePlatformVpnOrders — la file du canal direct : pending en tête (le
// travail du grossiste : confirmer ou annuler), puis paid/provisioned, puis
// l'historique (plafonné — discipline des listes du repo).
func (a *API) handlePlatformVpnOrders(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	a.store.Lock()
	db := a.store.Data()
	rank := map[string]int{
		model.PublicVpnOrderPending: 0, model.PublicVpnOrderPaid: 1,
		model.PublicVpnOrderProvisioned: 2, model.PublicVpnOrderCancelled: 3,
		model.PublicVpnOrderExpired: 4,
	}
	out := make([]model.PublicVpnOrder, 0, len(db.PublicVpnOrders))
	out = append(out, db.PublicVpnOrders...)
	a.store.Unlock()
	sort.SliceStable(out, func(i, j int) bool {
		ri, rj := rank[out[i].Status], rank[out[j].Status]
		if ri != rj {
			return ri < rj
		}
		return out[i].CreatedAt > out[j].CreatedAt
	})
	if len(out) > 200 {
		out = out[:200]
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out})
}

// ---------------------------------------------------------------------------
// POST /api/admin/vpn/orders/{id}/resolve — confirmation / annulation B2C
// ---------------------------------------------------------------------------

// handlePlatformVpnOrderResolve — corps {action: "markPaid" | "cancel"} :
//   - markPaid : encaissement hors ligne confirmé (canal manual) → paid puis
//     provisioning AUTO (même source unique que le webhook) ;
//   - cancel   : annulation — une commande provisionée perd son peer (le
//     client n'a plus d'accès), une pending/paid est simplement fermée.
func (a *API) handlePlatformVpnOrderResolve(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	orderID := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		Action string `json:"action"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "markpaid" && action != "cancel" {
		writeErr(w, http.StatusBadRequest, "Action inconnue (markPaid ou cancel)")
		return
	}
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByID(db, orderID)
	if order == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	snapshot := *order
	a.store.Unlock()

	switch action {
	case "cancel":
		if err := a.cancelPublicVpnOrder(orderID, "annulée par la plateforme", "console plateforme"); err != nil {
			writeErrCode(w, http.StatusBadGateway, "wg_mini_error",
				"Annulation impossible : "+err.Error(), nil)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Commande annulée" + ternaryStr(snapshot.Status == model.PublicVpnOrderProvisioned, " — peer révoqué, le client n'a plus d'accès", ""),
		})
	default: // markPaid
		if snapshot.Status != model.PublicVpnOrderPending {
			writeErr(w, http.StatusConflict, "Commande non en attente (état : "+snapshot.Status+")")
			return
		}
		if !a.markPublicVpnOrderPaid(orderID, "", "manual", "console plateforme") {
			writeErr(w, http.StatusConflict, "Commande déjà traitée entre-temps")
			return
		}
		order, err := a.provisionPublicVpnOrder(orderID)
		if err != nil {
			writeJSON(w, http.StatusAccepted, map[string]any{
				"ok":      true,
				"status":  model.PublicVpnOrderPaid,
				"message": "Encaissement enregistré — provisioning différé : " + boundedString(err.Error(), 160) + " (rejoué automatiquement)",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"status":  order.Status,
			"message": "Commande confirmée et VPN provisionné — conf envoyée à " + order.Email,
		})
	}
}

// ternaryStr — mini-ternaire local (lisibilité des messages).
func ternaryStr(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}

// ---------------------------------------------------------------------------
// GET /api/admin/vpn/reconcile — réconciliation GLOBALE cloud ↔ wg-mini
// ---------------------------------------------------------------------------

// handlePlatformVpnReconcile — le check D4 du grossiste, TOUS comptes :
//   - missing : peers ACTIFS côté cloud absents de la VM (restore, main
//     d'œuvre SSH, purge accidentelle) ;
//   - ghosts  : peers présents sur la VM mais inconnus du registre cloud
//     (l'inverse : créés à la main, résidus d'un add cassé).
//
// Ce que « wg-peer.sh list en SSH » faisait à la main — désormais un bouton
// de console (le commentaire handlers_vpn.go l'annonçait : « l'hygiène
// GLOBALE du pool est l'affaire des ops » — voilà l'outil des ops).
func (a *API) handlePlatformVpnReconcile(w http.ResponseWriter, r *http.Request) {
	if !a.requirePlatformVpn(w, r) {
		return
	}
	a.store.Lock()
	db := a.store.Data()
	cloud := map[string]bool{}
	known := map[string]bool{}
	for i := range db.VpnPeers {
		known[db.VpnPeers[i].Name] = true
		if db.VpnPeers[i].State == model.VpnStateActive {
			cloud[db.VpnPeers[i].Name] = true
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
	ghosts := make([]map[string]string, 0, 8)
	for _, p := range peers {
		vm[p.Name] = true
		if !known[p.Name] {
			ghosts = append(ghosts, map[string]string{"name": p.Name, "ip": p.IP})
		}
	}
	missing := []string{}
	for name := range cloud {
		if !vm[name] {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)
	sort.Slice(ghosts, func(i, j int) bool { return ghosts[i]["name"] < ghosts[j]["name"] })
	writeJSON(w, http.StatusOK, map[string]any{
		"reachable":   true,
		"vmPeerCount": len(peers),
		"cloudActive": len(cloud),
		"missing":     missing,
		"ghosts":      ghosts,
		"verdictNote": fmt.Sprintf("%d manquants, %d fantômes", len(missing), len(ghosts)),
	})
}
