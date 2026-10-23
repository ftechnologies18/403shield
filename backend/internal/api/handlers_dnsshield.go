// handlers_dnsshield.go — N°339 — BOUCLIER DNS « 403Shield DNS » (phase 1 :
// l'appareil protégé SANS routeur — miroir direct du consommable SafeWiFi
// N°80, deuxième canal de distribution).
//
// DEUX FACES, un seul fichier :
//
//  1. CONSOLE (JWT rôle tunnel — même frontière que l'Accès Pro N°315 :
//     le code à 6 chiffres a prouvé la possession de la boîte, l'e-mail
//     EST l'identité propriétaire) :
//     GET    /api/dnsshield/me                   profils + URL d'installation
//     POST   /api/dnsshield/profiles             création (nom, niveau, règles, couvre-feu)
//     PUT    /api/dnsshield/profiles/{id}        mise à jour (remplacement des champs optionnels)
//     DELETE /api/dnsshield/profiles/{id}        suppression
//     GET    /api/dnsshield/profiles/{id}/events rapport d'activité (blocages)
//
//  2. RÉSOLVEUR PUBLIQUE (hors /api/ — pattern registerAgentRoutes) :
//     POST/GET /dns-query/{publicId}   DoH RFC 8484 (wire-format).
//
//     N°345 — l'onboarding appareils :
//     GET /dns-cfg/{publicId}[/{proto}]  profil .mobileconfig Apple
//     (doh par défaut, dot en variante)
//     DoT :853 (dot_server.go) — Android « DNS privé » via SNI
//     <publicId>.dns.403shield.ftci.fr.
//
//     L'identifiant de profil dans l'URL est le pattern NextDNS :
//     l'appareil est configuré UNE fois avec
//     https://<base>/dns-query/<publicId> — aucune auth par requête (le
//     DNS n'a pas de concept de session ; l'ID 64 bits aléatoire est
//     l'acheminement ET le secret faible).
//
// DISCIPLINE DE DISPONIBILITÉ (fail-open, miroir « un filtre en panne ne
// coupe pas Internet ») : message incompréhensible → forward upstream tel
// quel ; upstream injoignable → 502 honnête (le client retombe sur son DNS
// système) ; profil inconnu/bloqué → 404 (l'appareil retombe aussi sur son
// DNS système — jamais de réponse mensongère).
//
// JOURNAL MINIMAL : seuls les BLOCAGES et couvre-feux sont consignés
// (DnsEvent), avec dédup in-memory 10 min par (profil, domaine) — un
// appareil infesté qui bégaie un domaine bloqué n'écrit pas 20 000 lignes
// par jour. Les requêtes autorisées ne sont JAMAIS écrites : promesse
// produit.
package api

import (
	"encoding/base64"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"mikcloud/hotspot-api/internal/dnsshield"
	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Console — profils du client authentifié
// ---------------------------------------------------------------------------

// dnsProfilePayload — la ligne profil telle que la console la lit/écrit.
type dnsProfilePayload struct {
	Name       string `json:"name"`
	Level      string `json:"level"`
	BlockRules string `json:"blockRules,omitempty"`
	AllowRules string `json:"allowRules,omitempty"`
	Curfew     *struct {
		Enabled bool   `json:"enabled"`
		Start   string `json:"start"`
		End     string `json:"end"`
		Days    string `json:"days"`
	} `json:"curfew,omitempty"`
}

// handleDnsShieldMe — les profils du client + l'URL d'installation de
// chaque profil (dérivée de la requête — la console n'a rien à deviner).
func (a *API) handleDnsShieldMe(w http.ResponseWriter, r *http.Request) {
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
	rows := []map[string]any{}
	base := agentBaseURL(r) // N°345 — posé AVANT la boucle : chaque ligne porte SES clés d'installation (DoH, hôte DoT, profils Apple)
	for _, p := range model.DnsProfilesOfEmail(db, client.Email) {
		rows = append(rows, dnsProfileRow(p, base))
	}
	// N°347 — l'abonnement « TOURACO » de CE compte : l'entitlement effectif
	// (la plus lointaine échéance provisionnée non échue), les commandes
	// actives (cibles du renouvellement 1-clic) et les bornes EFFECTIVES
	// (un abonné voit 25/600, un compte gratuit 10/200 — résolution sous
	// verrou, une requête, aucune recopie : un terme franchi retombe
	// immédiatement au tier gratuit).
	quotas := model.DnsQuotasForEmail(db, client.Email)
	expiresAt, subActive := model.DnsSubscriptionOfEmail(db, client.Email)
	nowISO := model.NowISO()
	subOrders := []map[string]any{}
	for i := range db.PublicDnsOrders {
		o := &db.PublicDnsOrders[i]
		if !strings.EqualFold(o.Email, client.Email) || o.Status != model.PublicDnsOrderProvisioned {
			continue
		}
		if o.ExpiresAt != "" && o.ExpiresAt < nowISO {
			continue // échue : le balayage horaire la marquera « expired »
		}
		row := map[string]any{
			"ref": o.Ref, "months": o.Months, "expiresAt": o.ExpiresAt,
			"kind": o.Kind, "createdAt": o.CreatedAt,
		}
		if plan := model.ResolvePublicDnsPlan(o.PlanID); plan != nil {
			row["planId"] = plan.ID
			row["planLabel"] = plan.Label
			row["periodLabel"] = plan.PeriodLabel
		}
		subOrders = append(subOrders, row)
	}
	a.store.Unlock()
	// N°343 — l'état RÉEL de l'agrégat de menaces (URLhaus/OpenPhish,
	// balayage 6 h) : la console affiche le compte servi par le
	// résolveur — 0 tant que le premier passage n'a pas réussi, JAMAIS
	// un chiffre fabriqué (doctrine). Lu HORS verrou : l'état vit dans
	// le package dnsshield (atomic), pas dans le store.
	threatCount, threatAt := dnsshield.ThreatStats()
	writeJSON(w, http.StatusOK, map[string]any{
		"email":    client.Email,
		"profiles": rows,
		"threats": map[string]any{
			"domains":   threatCount,
			"updatedAt": threatAt.Format(time.RFC3339),
		},
		"limits": map[string]any{
			"maxProfiles": quotas.MaxProfiles,
			"maxRules":    quotas.MaxRules,
		},
		// N°347 — l'abonnement « TOURACO » : état, échéance et cibles du
		// renouvellement 1-clic (la console /dns affiche le statut et propose
		// le geste sur CHAQUE commande active — POST /api/tunnel/dns/orders/
		// {ref}/renew).
		"subscription": map[string]any{
			"active":    subActive,
			"expiresAt": expiresAt,
			"orders":    subOrders,
		},
		"setupUrlFormat": base + "/dns-query/{publicId}",
		// N°345 — le bloc setup de l'onboarding appareils : les QUATRE clés
		// d'installation (DoH navigateurs, hôte DoT Android, profils Apple
		// doh/dot) + l'état RÉEL du serveur DoT (dotEnabled n'est posé que
		// quand l'écoute est effective — doctrine « aucun faux chiffre »).
		"setup": map[string]any{
			"doh":        base + "/dns-query/{publicId}",
			"dotHost":    "{publicId}." + dnsDotZone(),
			"appleDoh":   base + "/dns-cfg/{publicId}",
			"appleDot":   base + "/dns-cfg/{publicId}/dot",
			"dotZone":    dnsDotZone(),
			"dotEnabled": dotEnabled.Load(),
			// N°346 — le jalon maison : l'état RÉEL du serveur UDP/53,
			// l'IP du résolveur à poser sur la box (env/geste ops —
			// doctrine « aucun faux chiffre » : vide tant qu'inconnue)
			// et la zone (sonde probe-<token> + documentation).
			"udp53Enabled": udp53Enabled.Load(),
			"resolverIp":   dnsUdp53ResolverIP(),
			"resolverHost": dnsDotZone(),
		},
	})
}

// dnsProfileRow — la ligne console (URL d'installation posée par l'appelant).
func dnsProfileRow(p *model.DnsProfile, base string) map[string]any {
	curfew := map[string]any{"enabled": false}
	if p.CurfewSpec != "" {
		if cfg, ok := model.ParseFamilyGuardSpec(p.CurfewSpec); ok {
			curfew = map[string]any{"enabled": cfg.Enabled, "start": cfg.Start, "end": cfg.End, "days": cfg.Days}
		}
	}
	row := map[string]any{
		"id": p.ID, "publicId": p.PublicID, "name": p.Name, "level": p.Level,
		"blockRules": p.BlockRules, "allowRules": p.AllowRules,
		"curfew": curfew, "status": p.Status,
		"createdAt": p.CreatedAt, "updatedAt": p.UpdatedAt,
	}
	if base != "" {
		row["setupUrl"] = base + "/dns-query/" + p.PublicID
		// N°345 — les clés d'installation par appareil : hôte DoT Android,
		// profil Apple doh (défaut) et dot (variante).
		row["dotHostname"] = p.PublicID + "." + dnsDotZone()
		row["appleDohUrl"] = base + "/dns-cfg/" + p.PublicID
		row["appleDotUrl"] = base + "/dns-cfg/" + p.PublicID + "/dot"
	}
	return row
}

// handleDnsShieldProfileCreate — création d'un profil (quota par e-mail,
// validation stricte des règles et du couvre-feu — refus honnête plutôt
// que tri silencieux).
func (a *API) handleDnsShieldProfileCreate(w http.ResponseWriter, r *http.Request) {
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
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	var req dnsProfilePayload
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > model.MaxDnsNameLength {
		writeErr(w, http.StatusBadRequest, "Nom de profil requis (80 caractères max)")
		return
	}
	if !model.ValidDnsLevel(req.Level) {
		writeErr(w, http.StatusBadRequest, "Niveau inconnu (off, threats ou family)")
		return
	}
	// N°347 — les listes de règles ne sont plus normalisées ICI : la borne
	// dépend de l'abonnement « TOURACO » du compte (600 vs 200) — la
	// résolution se fait sous le verrou, AVANT NormalizeDnsRulesWithMax.
	curfewSpec, err := dnsCurfewSpec(req.Curfew)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
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
	// N°347 — bornes EFFECTIVES du compte (abonnement TOURACO actif →
	// capacités étendues ; sinon tier gratuit INTACT — résolution sous
	// verrou, une requête, aucun cache à invalider).
	quotas := model.DnsQuotasForEmail(db, client.Email)
	if len(model.DnsProfilesOfEmail(db, client.Email)) >= quotas.MaxProfiles {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "dns_profiles_full",
			"Limite de "+itoa(quotas.MaxProfiles)+" profils atteinte pour ce compte", nil)
		return
	}
	block, ok := model.NormalizeDnsRulesWithMax(req.BlockRules, quotas.MaxRules)
	if !ok {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Liste bloquer invalide (domaines minuscules simples, "+itoa(quotas.MaxRules)+" max)")
		return
	}
	allow, ok := model.NormalizeDnsRulesWithMax(req.AllowRules, quotas.MaxRules)
	if !ok {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Liste autoriser invalide (domaines minuscules simples, "+itoa(quotas.MaxRules)+" max)")
		return
	}
	now := model.NowISO()
	p := model.DnsProfile{
		ID: model.NewID("dp-"), PublicID: model.NewDnsProfilePublicID(),
		OwnerEmail: client.Email, Name: name, Level: req.Level,
		BlockRules: block, AllowRules: allow, CurfewSpec: curfewSpec,
		Status: model.DnsProfileActive, CreatedAt: now, UpdatedAt: now,
	}
	db.DnsProfiles = append(db.DnsProfiles, p)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Profil bouclier DNS créé : «"+name+"» (niveau "+req.Level+") — "+client.Email)
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusCreated, dnsProfileRow(&p, agentBaseURL(r)))
}

// handleDnsShieldProfileUpdate — remplacement des champs du profil
// (propriétaire vérifié par e-mail — 404 uniforme pour les autres,
// anti-énumération).
func (a *API) handleDnsShieldProfileUpdate(w http.ResponseWriter, r *http.Request) {
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
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	var req dnsProfilePayload
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > model.MaxDnsNameLength {
		writeErr(w, http.StatusBadRequest, "Nom de profil requis (80 caractères max)")
		return
	}
	if !model.ValidDnsLevel(req.Level) {
		writeErr(w, http.StatusBadRequest, "Niveau inconnu (off, threats ou family)")
		return
	}
	// N°347 — miroir du create : la borne de listes dépend de l'abonnement
	// « TOURACO » (600 vs 200) — normalisation sous le verrou, après la
	// résolution du quota du compte.
	curfewSpec, err := dnsCurfewSpec(req.Curfew)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
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
	p := model.FindDnsProfileByID(db, id)
	if p == nil || !strings.EqualFold(p.OwnerEmail, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil introuvable")
		return
	}
	quotas := model.DnsQuotasForEmail(db, client.Email)
	block, ok := model.NormalizeDnsRulesWithMax(req.BlockRules, quotas.MaxRules)
	if !ok {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Liste bloquer invalide (domaines minuscules simples, "+itoa(quotas.MaxRules)+" max)")
		return
	}
	allow, ok := model.NormalizeDnsRulesWithMax(req.AllowRules, quotas.MaxRules)
	if !ok {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, "Liste autoriser invalide (domaines minuscules simples, "+itoa(quotas.MaxRules)+" max)")
		return
	}
	p.Name, p.Level = name, req.Level
	p.BlockRules, p.AllowRules, p.CurfewSpec = block, allow, curfewSpec
	p.UpdatedAt = model.NowISO()
	snapshot := *p
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Profil bouclier DNS modifié : «"+name+"» — "+client.Email)
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, dnsProfileRow(&snapshot, agentBaseURL(r)))
}

// handleDnsShieldProfileDelete — suppression (le journal d'événements du
// profil part avec lui : la vie privée survit au produit).
func (a *API) handleDnsShieldProfileDelete(w http.ResponseWriter, r *http.Request) {
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
	for i := range db.DnsProfiles {
		if db.DnsProfiles[i].ID == id && strings.EqualFold(db.DnsProfiles[i].OwnerEmail, client.Email) {
			idx = i
			break
		}
	}
	if idx < 0 {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil introuvable")
		return
	}
	name := db.DnsProfiles[idx].Name
	db.DnsProfiles = append(db.DnsProfiles[:idx], db.DnsProfiles[idx+1:]...)
	kept := db.DnsEvents[:0]
	for _, e := range db.DnsEvents {
		if e.ProfileID != id {
			kept = append(kept, e)
		}
	}
	db.DnsEvents = kept
	// N°346 — les liaisons MAISON du profil partent avec lui (miroir du
	// journal) : jamais une maison pointant un profil disparu — elle
	// retomberait sur REFUSED (silence DNS) au lieu du FAI.
	keptB := db.DnsHomeBindings[:0]
	for _, b := range db.DnsHomeBindings {
		if b.ProfileID != id {
			keptB = append(keptB, b)
		}
	}
	db.DnsHomeBindings = keptB
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Profil bouclier DNS supprimé : «"+name+"» — "+client.Email)
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// handleDnsShieldProfileEvents — les 100 derniers blocages du profil
// (ordre récent d'abord) — le rapport d'activité du parent.
func (a *API) handleDnsShieldProfileEvents(w http.ResponseWriter, r *http.Request) {
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
	p := model.FindDnsProfileByID(db, id)
	if p == nil || !strings.EqualFold(p.OwnerEmail, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil introuvable")
		return
	}
	rows := []map[string]any{}
	for i := len(db.DnsEvents) - 1; i >= 0 && len(rows) < 100; i-- {
		e := &db.DnsEvents[i]
		if e.ProfileID != id {
			continue
		}
		rows = append(rows, map[string]any{
			"domain": e.Domain, "action": e.Action, "at": e.CreatedAt,
		})
	}
	a.store.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"events": rows})
}

// dnsCurfewSpec — valide le couvre-feu reçu (réutilise ValidFamilyGuardConfig
// N°82 TEL QUEL) et retourne le spec canonique. nil = jamais configuré.
func dnsCurfewSpec(c *struct {
	Enabled bool   `json:"enabled"`
	Start   string `json:"start"`
	End     string `json:"end"`
	Days    string `json:"days"`
}) (string, error) {
	if c == nil {
		return "", nil
	}
	cfg := model.FamilyGuardConfig{Enabled: c.Enabled, Start: c.Start, End: c.End, Days: c.Days}
	if !c.Enabled && c.Start == "" && c.End == "" && c.Days == "" {
		return "", nil // effacement propre (couvre-feu retiré)
	}
	if !model.ValidFamilyGuardConfig(cfg) {
		return "", errString("Couvre-feu invalide (heures HH:MM distinctes, 7 jours 0/1, au moins un jour)")
	}
	return cfg.SpecString(), nil
}

// errString — mini-helper d'erreur littérale (sans fmt pour rester léger).
type errString string

func (e errString) Error() string { return string(e) }

// itoa — strconv sans import supplémentaire dans les messages.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	b := [20]byte{}
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// retryAfter — secondes arrondies vers le haut (miroir des handlers tunnel).
func retryAfter(d time.Duration) int {
	s := int(d.Seconds())
	if s < 1 {
		return 1
	}
	return s
}

// ---------------------------------------------------------------------------
// Résolveur public DoH — POST/GET /dns-query/{publicId}
// ---------------------------------------------------------------------------

// dnsEventDedup — dédup in-memory (profil|domaine → dernier instant
// consigné) : un domaine bloqué bégaie des milliers de fois par jour, le
// journal n'en garde qu'un toutes les 10 min. Cap : la map se vide à 8192
// entrées (pas de fuite mémoire, la perte temporaire de dédup est bénigne).
var (
	dnsEventMu    sync.Mutex
	dnsEventSeen  = map[string]time.Time{}
	dnsEventCap   = 8192
	dnsEventEvery = 10 * time.Minute
)

// registerDnsShieldRoutes — les routes PUBLIQUES du résolveur (hors /api/ :
// pas de JWT — l'identifiant de profil fait l'acheminement, pattern
// registerAgentRoutes).
func (a *API) registerDnsShieldRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /dns-query/{publicId}", a.handleDnsQuery)
	mux.HandleFunc("GET /dns-query/{publicId}", a.handleDnsQuery)
	// N°345 — profils .mobileconfig Apple (public : le publicId est
	// l'acheminement, miroir du résolveur ; 404 uniforme anti-énumération).
	mux.HandleFunc("GET /dns-cfg/{publicId}", a.handleDnsAppleConfig)
	mux.HandleFunc("GET /dns-cfg/{publicId}/{proto}", a.handleDnsAppleConfig)
}

// handleDnsQuery — LE résolveur : RFC 8484 (GET ?dns=base64url sans
// padding, POST corps = message wire). Content-Type application/dns-message.
func (a *API) handleDnsQuery(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.dnsQuery.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", itoa(retryAfter(retry)))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	publicID := strings.TrimSpace(r.PathValue("publicId"))
	var msg []byte
	var err error
	switch r.Method {
	case http.MethodPost:
		if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/dns-message") {
			writeErr(w, http.StatusUnsupportedMediaType, "Content-Type application/dns-message attendu")
			return
		}
		msg, err = io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<16))
	case http.MethodGet:
		b64 := r.URL.Query().Get("dns")
		if b64 == "" {
			writeErr(w, http.StatusBadRequest, "Paramètre dns manquant (RFC 8484)")
			return
		}
		msg, err = base64.RawURLEncoding.DecodeString(b64)
	default:
		writeErr(w, http.StatusMethodNotAllowed, "Méthode non supportée")
		return
	}
	if err != nil || len(msg) < 12 {
		writeErr(w, http.StatusBadRequest, "Message DNS invalide")
		return
	}

	// Profil : inconnu/bloqué → 404 (l'appareil retombe sur son DNS
	// système — honnêteté produit, jamais de réponse fabriquée).
	a.store.Lock()
	db := a.store.Data()
	p := model.FindDnsProfileByPublicID(db, publicID)
	if p == nil || p.Status != model.DnsProfileActive {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil DNS inconnu")
		return
	}
	profile := *p
	a.store.Unlock()

	q, perr := dnsshield.ParseQuery(msg)
	if perr != nil {
		// Fail-open : message incompréhensible → forward tel quel.
		a.dnsForward(w, msg)
		return
	}

	verdict := dnsshield.Decide(&profile, q.Name, time.Now().UTC())
	switch verdict {
	case dnsshield.VerdictBlock:
		a.dnsLogEvent(profile.ID, q.Name, model.DnsEventBlocked)
		w.Header().Set("Content-Type", "application/dns-message")
		w.Header().Set("Cache-Control", "max-age=60")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(dnsshield.BuildBlocked(q))
	case dnsshield.VerdictCurfew:
		a.dnsLogEvent(profile.ID, q.Name, model.DnsEventCurfew)
		w.Header().Set("Content-Type", "application/dns-message")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(dnsshield.BuildRefused(q))
	default:
		a.dnsForward(w, msg)
	}
}

// dnsForward — passage upstream + réponse 502 honnête sur échec (le client
// retombe sur son DNS système : un filtre en panne ne coupe pas Internet,
// il s'efface).
func (a *API) dnsForward(w http.ResponseWriter, msg []byte) {
	resp, err := dnsshield.Forward(msg)
	if err != nil {
		writeErrCode(w, http.StatusBadGateway, "dns_upstream_failed",
			"Résolution impossible — réessayez", nil)
		return
	}
	w.Header().Set("Content-Type", "application/dns-message")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(resp)
}

// dnsLogEvent — consigne un blocage/couve-feu avec dédup 10 min, HORS
// verrou pour la partie mémoire puis re-verrou pour l'écriture (discipline
// « gestes lents hors verrou » — ici l'écriture est rapide mais la map
// n'est jamais touchée sous le verrou du store).
func (a *API) dnsLogEvent(profileID, domain, action string) {
	key := profileID + "|" + domain
	dnsEventMu.Lock()
	if t, seen := dnsEventSeen[key]; seen && time.Since(t) < dnsEventEvery {
		dnsEventMu.Unlock()
		return // déjà consigné il y a moins de 10 min
	}
	if len(dnsEventSeen) >= dnsEventCap {
		dnsEventSeen = map[string]time.Time{}
	}
	dnsEventSeen[key] = time.Now()
	dnsEventMu.Unlock()

	a.store.Lock()
	a.store.Data().DnsEvents = append(a.store.Data().DnsEvents, model.DnsEvent{
		ID: model.NewID("de-"), ProfileID: profileID,
		Domain: boundedString(domain, 253), Action: action, CreatedAt: model.NowISO(),
	})
	a.store.Save()
	a.store.Unlock()
}
