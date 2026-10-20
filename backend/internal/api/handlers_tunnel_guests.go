// handlers_tunnel_guests.go — N°342 — ACCÈS INVITÉ (Programme Tunnel) :
// peers WireGuard EXPIRABLES pour tiers — serveur de jeu avec des amis,
// démo web à un client, collaborateur ponctuel — le partage SANS exposer.
//
// QUATRE routes (JWT rôle « tunnel », whitelist /api/tunnel/* ONLY) :
//
//   - GET  /api/tunnel/pro/guests            — liste + jauge du plafond
//     (lecture pure, état DÉRIVÉ de l'échéance — jamais persisté) ;
//   - POST /api/tunnel/pro/guests            — création : corps
//     {label?, hostPeerId, ports, ttlHours, website? (honeypot)} — l'hôte
//     doit être un appareil Pro VIVANT du compte (tunnelProPeersLocked,
//     appariement e-mail du JWT), les ports 1-6 en csv, le TTL borné
//     1-72 h. Provisioning en 3 phases (miroir provisionPublicVpnOrder) :
//     réservation sous verrou → wg-mini add-guest HORS verrou (preuve par
//     la conf : AllowedIPs = hôte/32 SEUL, 3e frontière) → finalisation ;
//   - POST /api/tunnel/pro/guests/{id}/reveal — livraison de la conf (QR +
//     copie côté console) avec self-healing wg-mini (pattern D5-a du reveal
//     N°314) : révocation/expiration → 410 honnête ;
//   - POST /api/tunnel/pro/guests/{id}/revoke — révocation IMMÉDIATE : état
//     posé sous verrou, peer retiré de wg0 HORS verrou (échec = ErrorMsg +
//     reprise par le balayage vpnguest_sweep.go).
//
// Disciplines (miroir des routes tunnel existantes) :
//   - anti-énumération : ID divergent → 404 « Invité introuvable » ;
//   - la conf ne sort QUE dans la réponse du reveal (jamais dans un journal,
//     jamais dans la liste — trace d'activité SANS conf, conventions §8) ;
//   - appels wg-mini TOUJOURS hors verrou du store ;
//   - aucun paiement : l'invité est une FACULTÉ de l'Accès Pro de l'hôte
//     (pas un produit facturable séparé en v1 — l'éditeur de formules
//     viendra plus tard, même doctrine que les plafonds).
package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Helpers de vue (tous sous verrou)
// ---------------------------------------------------------------------------

// tunnelGuestView — la ligne d'invité SERVIE à la console : jamais la conf,
// jamais le nom VM (wg-peer.sh — détail opérateur), l'état DÉRIVÉ de
// l'échéance et le libellé de l'hôte résolu au registre des peers.
func tunnelGuestView(db *model.DB, g *model.VpnGuest, now string) map[string]any {
	hostLabel := ""
	if p := model.FindVpnPeerByID(db, g.HostPeerID); p != nil {
		hostLabel = model.VpnPeerLabel(*p)
	}
	return map[string]any{
		"id":         g.ID,
		"label":      model.VpnGuestLabel(*g),
		"hostPeerId": g.HostPeerID,
		"hostLabel":  hostLabel,
		"hostIp":     g.HostIP,
		"ports":      g.Ports,
		"ipv4":       g.IPv4,
		"state":      model.VpnGuestEffectiveState(g, now),
		"expiresAt":  g.ExpiresAt,
		"createdAt":  g.CreatedAt,
		"errorMsg":   boundedString(g.ErrorMsg, 160),
	}
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/pro/guests — liste + jauge
// ---------------------------------------------------------------------------

// handleTunnelGuestsList — lecture pure : invités du compte apparié par
// e-mail (ordre antichronologique — le plus récent d'abord), jauge du
// plafond MaxVpnGuestsPerAccount sur les VIVANTS seuls.
func (a *API) handleTunnelGuestsList(w http.ResponseWriter, r *http.Request) {
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
	acc := tunnelProAccountLocked(db, client.Email)
	guests := []map[string]any{}
	if acc != nil {
		// Antichronologique : append inversé du registre (ordre d'insertion).
		for i := len(db.VpnGuests) - 1; i >= 0; i-- {
			g := &db.VpnGuests[i]
			if g.AccountID != acc.ID {
				continue
			}
			guests = append(guests, tunnelGuestView(db, g, now))
		}
	}
	active := 0
	if acc != nil {
		active = model.VpnGuestsActiveForAccount(db, acc.ID, now)
	}
	// Les hôtes POSSIBLES : appareils Pro vivants du compte (pour le select du
	// formulaire — même source de vérité que le portefeuille /pro).
	hosts := []map[string]any{}
	if acc != nil {
		for _, p := range tunnelProPeersLocked(db, acc.ID, client.Email, now) {
			hosts = append(hosts, map[string]any{
				"peerId": p.ID,
				"label":  model.VpnPeerLabel(*p),
				"ipv4":   p.IPv4,
			})
		}
	}
	a.store.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"guests":        guests,
		"activeCount":   active,
		"maxPerAccount": model.MaxVpnGuestsPerAccount,
		"hosts":         hosts,
		"ttlMinHours":   model.MinGuestTTLHours,
		"ttlMaxHours":   model.MaxGuestTTLHours,
	})
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests — création (3 phases, miroir provisioning)
// ---------------------------------------------------------------------------

// handleTunnelGuestCreate — corps {label?, hostPeerId, ports, ttlHours,
// website? (honeypot)}. L'invité est créé sous le COMPTE du gérant
// propriétaire de l'hôte ; sa conf n'est JAMAIS dans la réponse (la
// livraison passe par le reveal, exactement comme un appareil Pro).
func (a *API) handleTunnelGuestCreate(w http.ResponseWriter, r *http.Request) {
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
		Label      string `json:"label"`
		HostPeerID string `json:"hostPeerId"`
		Ports      string `json:"ports"`
		TTLHours   int    `json:"ttlHours"`
		Website    string `json:"website"` // honeypot — rempli = robot
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		// Honeypot : succès factice, rien n'est créé (pattern join N°27).
		writeJSON(w, http.StatusOK, map[string]any{"guest": nil})
		return
	}
	label := model.SanitizeDeviceName(strings.TrimSpace(req.Label))
	ports := strings.TrimSpace(req.Ports)
	if !model.ValidGuestPorts(ports) {
		writeErr(w, http.StatusBadRequest, "Ports invalides : 1 à 6 ports séparés par des virgules (ex. 25565 ou 3000,80,443)")
		return
	}
	if req.TTLHours < model.MinGuestTTLHours || req.TTLHours > model.MaxGuestTTLHours {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("Durée invalide : entre %d et %d heures", model.MinGuestTTLHours, model.MaxGuestTTLHours))
		return
	}

	// ---- Phase 1 : vérifications + réservation (verrou) ----
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	now := model.NowISO()
	acc, _, eligible := tunnelProEligibleLocked(db, client.Email)
	if !eligible {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "guest_ineligible",
			"Les invités se créent depuis l'espace d'un Accès Pro actif (un appareil Pro au moins)", nil)
		return
	}
	// L'hôte : un appareil Pro VIVANT du compte (résolution stricte — un ID
	// d'un autre compte ou un peer mort est refusé, jamais contournable).
	var host *model.VpnPeer
	for _, p := range tunnelProPeersLocked(db, acc.ID, client.Email, now) {
		if p.ID == strings.TrimSpace(req.HostPeerID) {
			host = p
			break
		}
	}
	if host == nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusBadRequest, "guest_host_invalid",
			"Hôte introuvable : choisissez un de vos appareils Pro actifs", nil)
		return
	}
	if model.VpnGuestsActiveForAccount(db, acc.ID, now) >= model.MaxVpnGuestsPerAccount {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "guest_cap",
			fmt.Sprintf("Plafond atteint : %d invités actifs au maximum — révoquez ou laissez expirer un invité", model.MaxVpnGuestsPerAccount), nil)
		return
	}
	if model.VpnPeerSlotsUsed(db) >= model.VpnWg0PoolSize {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "pool_full",
			"Capacité momentanément atteinte — réessayez plus tard", nil)
		return
	}
	name := model.NewVpnPeerName()
	for j := 0; j < 50 && model.VpnPeerNameTaken(db, name); j++ {
		name = model.NewVpnPeerName()
	}
	if model.VpnPeerNameTaken(db, name) {
		a.store.Unlock()
		writeErr(w, http.StatusServiceUnavailable, "Réservation impossible — réessayez")
		return
	}
	expiresAt := time.Now().UTC().Add(time.Duration(req.TTLHours) * time.Hour).Format(time.RFC3339)
	guest := model.VpnGuest{
		ID: model.NewID("vg-"), AccountID: acc.ID,
		Name: name, Label: label,
		HostPeerID: host.ID, HostIP: host.IPv4, Ports: ports,
		State:     model.VpnGuestStateActive,
		ExpiresAt: expiresAt,
		CreatedAt: now, UpdatedAt: now,
	}
	db.VpnGuests = append(db.VpnGuests, guest)
	guestID := guest.ID
	hostSnapshot := model.VpnPeerLabel(*host)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Invité créé : "+model.VpnGuestLabel(guest)+" → hôte "+hostSnapshot+" ("+host.IPv4+", ports "+ports+", "+fmt.Sprintf("%d h)", req.TTLHours))
	a.store.Save()
	a.store.Unlock()

	// ---- Phase 2 : wg-mini HORS verrou (jamais d'appel réseau sous le
	// verrou global). La preuve par la conf vit dans wgMiniGuestAdd (3e
	// frontière) : AllowedIPs = hôte/32 SEUL ou refus.
	conf, ip, err := wgMiniGuestAddFn(name, host.IPv4, ports)
	if err != nil {
		// Nettoyage best-effort + trace : la ligne passe en erreur explicite
		// (revivable par une nouvelle création — jamais un invité fantôme actif).
		go func() { _ = wgMiniRemoveFn(name) }()
		a.store.Lock()
		if g := model.FindVpnGuestScoped(a.store.Data(), guestID, acc.ID); g != nil {
			g.State = model.VpnGuestStateError
			g.ErrorMsg = boundedString(err.Error(), 200)
			g.UpdatedAt = model.NowISO()
			a.store.Save()
		}
		a.store.Unlock()
		writeErrCode(w, http.StatusBadGateway, "guest_provision_failed",
			"Création impossible côté serveur : "+boundedString(err.Error(), 200), nil)
		return
	}

	// ---- Phase 3 : finalisation (re-verrou) ----
	a.store.Lock()
	db = a.store.Data()
	g := model.FindVpnGuestScoped(db, guestID, acc.ID)
	if g == nil || g.State != model.VpnGuestStateActive || g.Conf != "" {
		// Ligne disparue/avalée entre-temps : le peer VM est retiré (jamais de
		// peer orphelin), refus honnête.
		a.store.Unlock()
		go func() { _ = wgMiniRemoveFn(name) }()
		writeErr(w, http.StatusServiceUnavailable, "Finalisation impossible — réessayez")
		return
	}
	g.Conf = conf
	g.IPv4 = ip
	g.UpdatedAt = model.NowISO()
	view := tunnelGuestView(db, g, model.NowISO())
	a.store.Save()
	a.store.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"guest": view})
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests/{id}/reveal — livraison de la conf
// ---------------------------------------------------------------------------

// handleTunnelGuestReveal — appariement JWT tunnel ↔ invité du compte. La
// conf : copie cloud, self-healing wg-mini si vide (miroir D5-a du reveal
// N°314). Révoqué/échué → 410 (l'invité est un tiers : la conf d'un accès
// mort ne se re-livre JAMAIS, même à l'hôte).
func (a *API) handleTunnelGuestReveal(w http.ResponseWriter, r *http.Request) {
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
	id := strings.TrimSpace(r.PathValue("id"))

	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	acc := tunnelProAccountLocked(db, client.Email)
	var guest *model.VpnGuest
	if acc != nil {
		guest = model.FindVpnGuestScoped(db, id, acc.ID)
	}
	// Anti-énumération : inconnu et compte divergent → même 404.
	if acc == nil || guest == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Invité introuvable")
		return
	}
	now := model.NowISO()
	if guest.State == model.VpnGuestStateRevoked {
		a.store.Unlock()
		writeErr(w, http.StatusGone, "Cet invité est révoqué — recréez-en un si nécessaire")
		return
	}
	if model.VpnGuestExpired(guest, now) {
		a.store.Unlock()
		writeErr(w, http.StatusGone, "Cet invité est arrivé à terme le "+guest.ExpiresAt+" — recréez-en un si nécessaire")
		return
	}
	if guest.State != model.VpnGuestStateActive {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "conf_unavailable",
			"Configuration indisponible ("+boundedString(guest.ErrorMsg, 120)+") — recréez l'invité", nil)
		return
	}
	snapshot := *guest
	name := guest.Name
	a.store.Unlock()

	// Conf : copie cloud, self-healing wg-mini si vide (miroir D5-a).
	conf := snapshot.Conf
	if conf == "" {
		if fresh, ferr := wgMiniConfFn(name); ferr == nil {
			conf = fresh
			a.store.Lock()
			if g := model.FindVpnGuestScoped(a.store.Data(), id, snapshot.AccountID); g != nil {
				g.Conf = fresh
				a.store.Save()
			}
			a.store.Unlock()
		}
	}
	if conf == "" {
		writeErrCode(w, http.StatusServiceUnavailable, "conf_unavailable",
			"Configuration indisponible — recréez l'invité", nil)
		return
	}

	// Trace SANS la conf (le journal n'est pas un coffre, conventions §8).
	a.store.Lock()
	a.logActivity(a.store.Data(), model.AccountMainID, "tunnel",
		"Reveal conf invité : "+model.VpnGuestLabel(snapshot)+" ("+client.Email+")")
	a.store.Save()
	a.store.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"id":        snapshot.ID,
		"label":     model.VpnGuestLabel(snapshot),
		"conf":      conf,
		"ipv4":      snapshot.IPv4,
		"hostIp":    snapshot.HostIP,
		"ports":     snapshot.Ports,
		"expiresAt": snapshot.ExpiresAt,
	})
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/pro/guests/{id}/revoke — révocation immédiate
// ---------------------------------------------------------------------------

// handleTunnelGuestRevoke — l'état passe à « revoked » SOUS verrou (la
// vérité pour l'API est immédiate : reveal/liste voient la révocation
// tout de suite), puis le peer est retiré de wg0 HORS verrou. Échec wg-mini
// → ErrorMsg + reprise par le balayage (vpnguest_sweep.go) : jamais un peer
// fantôme à vie sur la VM. Idempotent sur un invité déjà révoqué (200).
func (a *API) handleTunnelGuestRevoke(w http.ResponseWriter, r *http.Request) {
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
	id := strings.TrimSpace(r.PathValue("id"))

	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	acc := tunnelProAccountLocked(db, client.Email)
	var guest *model.VpnGuest
	if acc != nil {
		guest = model.FindVpnGuestScoped(db, id, acc.ID)
	}
	if acc == nil || guest == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Invité introuvable")
		return
	}
	// Révocation pure cloud (l'historique d'un invité échu reste lisible).
	snapshot := *guest
	needRemove := guest.State == model.VpnGuestStateActive && !model.VpnGuestExpired(guest, model.NowISO())
	guest.State = model.VpnGuestStateRevoked
	guest.Conf = "" // la conf d'un accès mort ne sert plus à rien — pas de coffre fantôme
	guest.UpdatedAt = model.NowISO()
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Invité révoqué : "+model.VpnGuestLabel(snapshot)+" ("+client.Email+")")
	a.store.Save()
	a.store.Unlock()

	// Retrait wg0 HORS verrou (seulement s'il pouvait encore être vivant —
	// un invité échoué/error peut aussi traîner côté VM : on tente quand
	// même pour les états error, d'où la condition élargie ci-dessous).
	if needRemove || snapshot.State == model.VpnGuestStateError {
		if err := wgMiniRemoveFn(snapshot.Name); err != nil {
			a.store.Lock()
			if g := model.FindVpnGuestScoped(a.store.Data(), id, snapshot.AccountID); g != nil && g.State == model.VpnGuestStateRevoked {
				g.ErrorMsg = boundedString("retrait VM en attente : "+err.Error(), 200)
				g.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
			writeErrCode(w, http.StatusBadGateway, "guest_revoke_delayed",
				"Invité révoqué côté serveur — le retrait du tunnel sera retenté automatiquement ("+boundedString(err.Error(), 120)+")", nil)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": model.VpnGuestStateRevoked})
}
