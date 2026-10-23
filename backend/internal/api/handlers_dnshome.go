// handlers_dnshome.go — N°346 — LA FACE CONSOLE DU RÉSOLVEUR MAISON :
// liaisons IP publique du logement → profil (UDP/53, udp53_server.go) et
// SONDE de ligne (détection du détournement du port 53 par certains FAI).
//
// LE PARCOURS CLIENT (cadrage produit, figé ici) :
//  1. « Protéger toute la maison » : le client, DEPUIS chez lui, lie
//     l'IP de sa requête HTTP (X-Forwarded-For par Caddy — c'est
//     l'IP de sa box) au profil de son choix ;
//  2. il configure les serveurs DNS de sa box : DNS 1 = le résolveur,
//     DNS 2 = le DNS du FAI (FILET DE SECOURS — doctrine fail-open : un
//     bouclier injoignable ne coupe pas Internet, il se laisse dépasser) ;
//  3. la maison entière est filtrée : TV, consoles, objets connectés,
//     invités — sans rien installer.
//
// LA SONDE (probe-<token>) répond aux deux questions que le parcours
// soulève : « quelle est VRAIMENT l'IP de ma box ? » (le client peut
// ouvrir la console en 4G — la liaison lierait alors son téléphone, pas
// sa maison) et « mon FAI détourne-t-il le port 53 ? » (proxy transparent
// : la requête n'arrive jamais). Une commande à lancer sur un appareil
// DU LOGEMENT, un jeton éphémère 15 min, un statut en direct :
//
//	pending   → rien reçu (encore) : soit la commande ne tourne pas
//	            chez lui, soit le FAI intercepte le port 53 ;
//	received  → la ligne est propre ET l'IP source est celle de la
//	            box (un clic la lie) ;
//	expired   → 15 min passées, il suffit d'en générer une autre.
//
// FRONTIÈRE : JWT rôle tunnel + compte actif (miroir exact des profils
// N°339 — l'e-mail EST l'identité propriétaire). Anti-énumération : la
// liaison d'autrui n'existe pas (404 uniforme) ; l'IP déjà liée à un
// AUTRE compte est refusée honnêtement (409 — aucune divulgation
// d'identité, l'existence seule).
//
// CGNAT (honnêteté documentée) : certains FAI partagent une IP publique
// entre foyers — la liaison reste fonctionnelle mais le filtrage est
// alors celui du profil lié, partagé par tous derrière cette IP. La
// console le dit tel quel.
package api

import (
	"net/http"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// dnsHomeBindingRow — la ligne console (jointure profil pour l'affichage).
func dnsHomeBindingRow(db *model.DB, b *model.DnsHomeBinding) map[string]any {
	profileName := ""
	if p := model.FindDnsProfileByID(db, b.ProfileID); p != nil {
		profileName = p.Name
	}
	return map[string]any{
		"id": b.ID, "ip": b.IP, "label": b.Label,
		"profileId": b.ProfileID, "profileName": profileName,
		"lastQueryAt": b.LastQueryAt, "queryCount": b.QueryCount,
		"createdAt": b.CreatedAt, "updatedAt": b.UpdatedAt,
	}
}

// handleDnsHomeList — GET /api/dnsshield/home : les liaisons du compte,
// l'IP de la requête en cours (celle de la box si le client est chez
// lui), l'adresse du résolveur et l'état RÉEL du serveur UDP/53.
func (a *API) handleDnsHomeList(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	// Compteurs différés reportés À LA LECTURE : l'indicateur « votre
	// maison est protégée » est frais au moment où le parent regarde.
	a.udp53FlushStats()
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	rows := []map[string]any{}
	for _, b := range model.DnsHomeBindingsOfEmail(db, client.Email) {
		rows = append(rows, dnsHomeBindingRow(db, b))
	}
	// N°347 — borne EFFECTIVE des logements (abonnement « TOURACO » actif
	// → 15 ; sinon tier gratuit INTACT — 5). Résolution sous verrou.
	quotas := model.DnsQuotasForEmail(db, client.Email)
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"myIp":         clientIP(r),
		"resolverIp":   dnsUdp53ResolverIP(),
		"resolverHost": dnsDotZone(),
		"udp53Enabled": udp53Enabled.Load(),
		"bindings":     rows,
		"limits":       map[string]any{"maxBindings": quotas.MaxHomeBindings},
	})
}

// handleDnsHomeClaim — POST /api/dnsshield/home {profileId, label?, ip?} :
// lie une IP de logement à un profil. ip facultative : défaut = l'IP de
// la requête (le client est chez lui). Re-liér une IP DÉJÀ LIÉE à SON
// compte change le profil de la maison (pas d'erreur inutile) ; l'IP
// d'un AUTRE compte est refusée honnêtement.
func (a *API) handleDnsHomeClaim(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", itoa(retryAfter(retry)))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	c := claimsFrom(r)
	if c == nil || c.Role != "tunnel" {
		writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		ProfileID string `json:"profileId"`
		Label     string `json:"label"`
		IP        string `json:"ip"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	profileID := strings.TrimSpace(req.ProfileID)
	label := strings.TrimSpace(req.Label)
	if label != "" && len(label) > model.MaxDnsHomeLabelLength {
		writeErr(w, http.StatusBadRequest, "Nom du logement trop long (60 caractères max)")
		return
	}
	if label == "" {
		label = "Maison"
	}
	rawIP := strings.TrimSpace(req.IP)
	if rawIP == "" {
		rawIP = clientIP(r) // le client est chez lui : l'IP de sa requête EST celle de sa box
	}
	ip, ok := model.NormalizeDnsHomeIP(rawIP)
	if !ok {
		writeErr(w, http.StatusBadRequest, "Adresse IP invalide — elle doit être l'IP publique de votre logement (pas 192.168.x.x : cela voudrait dire que la console voit un réseau interne)")
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
	p := model.FindDnsProfileByID(db, profileID)
	if p == nil || !strings.EqualFold(p.OwnerEmail, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil introuvable")
		return
	}
	if p.Status != model.DnsProfileActive {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil introuvable")
		return
	}
	// IP déjà liée : la signe → re-liaison (changement de profil de la
	// maison) ; celle d'un autre → refus honnête (409, aucune identité).
	if existing := model.FindDnsHomeBindingByIP(db, ip); existing != nil {
		if !strings.EqualFold(existing.OwnerEmail, client.Email) {
			a.store.Unlock()
			writeErrCode(w, http.StatusConflict, "ip_bound",
				"Cette adresse IP est déjà liée à un autre compte", nil)
			return
		}
		existing.ProfileID = p.ID
		existing.Label = label
		existing.UpdatedAt = model.NowISO()
		a.logActivity(db, model.AccountMainID, "tunnel",
			"Logement re-lié au bouclier DNS : "+ip+" → profil «"+p.Name+"» — "+client.Email)
		a.store.Save()
		row := dnsHomeBindingRow(db, existing) // jointure SOUS verrou (FindDnsProfileByID lit le registre)
		a.store.Unlock()
		writeJSON(w, http.StatusOK, row)
		return
	}
	// N°347 — borne EFFECTIVE des logements : abonnement « TOURACO » actif
	// → 15 maisons (domicile + bureau + maison de famille…) ; sinon tier
	// gratuit INTACT (5). Résolution sous le verrou du store.
	maxHome := model.DnsQuotasForEmail(db, client.Email).MaxHomeBindings
	if len(model.DnsHomeBindingsOfEmail(db, client.Email)) >= maxHome {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "dns_home_full",
			"Limite de "+itoa(maxHome)+" logements atteinte pour ce compte", nil)
		return
	}
	now := model.NowISO()
	b := model.DnsHomeBinding{
		ID: model.NewID("dh-"), ProfileID: p.ID, OwnerEmail: client.Email,
		IP: ip, Label: label, CreatedAt: now, UpdatedAt: now,
	}
	db.DnsHomeBindings = append(db.DnsHomeBindings, b)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Logement lié au bouclier DNS : "+ip+" → profil «"+p.Name+"» — "+client.Email)
	a.store.Save()
	row := dnsHomeBindingRow(db, &db.DnsHomeBindings[len(db.DnsHomeBindings)-1]) // jointure SOUS verrou
	a.store.Unlock()
	writeJSON(w, http.StatusCreated, row)
}

// handleDnsHomeDelete — DELETE /api/dnsshield/home/{id} : la maison
// retourne au DNS du FAI (la box retombe sur ses serveurs d'origine —
// rien à désinstaller côté appareils, c'est l'avantage du jalon).
func (a *API) handleDnsHomeDelete(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", itoa(retryAfter(retry)))
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
	idx := -1
	for i := range db.DnsHomeBindings {
		if db.DnsHomeBindings[i].ID == id && strings.EqualFold(db.DnsHomeBindings[i].OwnerEmail, client.Email) {
			idx = i
			break
		}
	}
	if idx < 0 {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Liaison introuvable")
		return
	}
	db.DnsHomeBindings = append(db.DnsHomeBindings[:idx], db.DnsHomeBindings[idx+1:]...)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Logement détaché du bouclier DNS ("+id+") — "+client.Email)
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// handleDnsHomeProbeCreate — POST /api/dnsshield/home/probe : un jeton
// éphémère (15 min, mémoire seule) + le nom à interroger depuis un
// appareil DU logement. La commande exacte est assemblée par la console
// (elle connaît l'IP du résolveur) — le backend fournit la matière.
func (a *API) handleDnsHomeProbeCreate(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelAction.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", itoa(retryAfter(retry)))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
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
	a.store.Unlock()
	token := udp53ProbeNewToken()
	if token == "" {
		writeErr(w, http.StatusInternalServerError, "Sonde indisponible — réessayez")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"token":      token,
		"name":       udp53ProbePrefix + token + "." + dnsDotZone(),
		"expiresAt":  time.Now().Add(udp53ProbeTTL).UTC().Format(time.RFC3339),
		"resolverIp": dnsUdp53ResolverIP(),
	})
}

// handleDnsHomeProbeStatus — GET /api/dnsshield/home/probe/{token} : le
// statut en direct (pending | received | expired). « received » porte
// l'IP source — la RÉVÉLATION : c'est elle, l'IP de la box (un clic la
// lie, même si la console a été ouverte en 4G).
func (a *API) handleDnsHomeProbeStatus(w http.ResponseWriter, r *http.Request) {
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
	a.store.Unlock()

	token := strings.TrimSpace(r.PathValue("token"))
	if len(token) != udp53ProbeTokenLn {
		writeErr(w, http.StatusNotFound, "Sonde inconnue ou expirée")
		return
	}
	udp53ProbeMu.Lock()
	e := udp53ProbeLive[token]
	now := time.Now()
	if e == nil || now.After(e.expiresAt) {
		if e != nil {
			delete(udp53ProbeLive, token)
		}
		udp53ProbeMu.Unlock()
		writeErr(w, http.StatusNotFound, "Sonde inconnue ou expirée")
		return
	}
	expiresAt := e.expiresAt.UTC().Format(time.RFC3339)
	var ip, at string
	if e.ip != "" {
		ip, at = e.ip, e.at.UTC().Format(time.RFC3339)
	}
	udp53ProbeMu.Unlock()

	if ip == "" {
		writeJSON(w, http.StatusOK, map[string]any{"status": "pending", "expiresAt": expiresAt})
		return
	}
	// La liaison éventuelle de l'IP révélée (la console propose le clic).
	a.store.Lock()
	db = a.store.Data()
	bound, mine := false, false
	if b := model.FindDnsHomeBindingByIP(db, ip); b != nil {
		bound = true
		mine = strings.EqualFold(b.OwnerEmail, client.Email)
	}
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "received", "ip": ip, "at": at,
		"expiresAt": expiresAt, "bound": bound, "mine": mine,
	})
}
