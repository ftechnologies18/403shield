// handlers_tunnel.go — N°313 — module « tunnel » (Programme Tunnel, phase 1 :
// fondations de la console séparée, décision D-T2/D-T3).
//
// Ce fichier porte les TROIS routes de la future console tunnel :
//
//   - POST /api/tunnel/auth/request-code  (public) : demande d'un code de
//     connexion à 6 chiffres par e-mail — passwordless, inscription =
//     connexion (le client léger est créé à la première vérification
//     réussie) ;
//   - POST /api/tunnel/auth/verify        (public) : vérification du code →
//     JWT rôle « tunnel » (24 h, même HMAC que la console SaaS — rôle SANS
//     aucun droit console : le middleware whiteliste /api/tunnel/* ONLY,
//     miroir du rôle reseller §Mode Vente) ;
//   - GET  /api/tunnel/me                 (JWT tunnel) : profil + PORTFOLIO des
//     commandes B2C (appariement par e-mail, migration douce des MCV-
//     historiques) — ventes ET renouvellements, drapeaux renewable/revealable ;
//   - POST /api/tunnel/orders/{ref}/reveal et /renew (N°314) : cf.
//     handlers_tunnel_orders.go (la gestion des commandes vit là).
//
// Disciplines :
//   - codes à usage unique EN MÉMOIRE API (TTL 10 min, 5 tentatives, usage
//     unique, cooldown 60 s par e-mail) — JAMAIS en base (miroir du « état
//     SANS colonne » ppp_provision N°310) ; le hash est sha256(secret|email|
//     code), comparaison à temps constant ;
//   - quotas IP publics (signupLimiter, miroir N°301 : demande de code =
//     un e-mail RÉEL part → serré ; vérification plus large) + honeypot ;
//   - expéditeur e-mail : réglages du compte principal (relais plateforme
//     N°150 — en production Resend y est configuré), envoi ASYNCHRONE via
//     emailTaskDispatch + trace NotifLog kind « tunnel_code » SANS le code
//     (le journal n'est pas un coffre, conventions §8) ;
//   - l'adresse e-mail est validée par net/mail.ParseAddress (parité
//     handlers_public_vpn.go) et canonisée en minuscules ;
//   - AUCUNE dépendance au tunnel WireGuard ici : l'identité vit dans ce
//     fichier, la gestion des commandes (reveal/renew) dans
//     handlers_tunnel_orders.go (N°314).
package api

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/notify"
)

// Bornes du code à usage unique (parité password_reset : TTL 60 min → ici
// 10 min, le code est jetable ; tentatives bornées AVANT l'échec définitif).
const (
	tunnelCodeTTL      = 10 * time.Minute
	tunnelCodeMaxTry   = 5
	tunnelCodeCooldown = 60 * time.Second
	tunnelCodeMapCap   = 10_000 // garde-fou mémoire (purge paresseuse des expirés)
	tunnelCodePurgeAt  = 512    // seuil de déclenchement de la purge
)

// tunnelCodeEntry — code de connexion en attente pour un e-mail (EN MÉMOIRE,
// jamais en base). Le code lui-même n'est jamais conservé en clair : seul
// son hash salé par le secret JWT vit ici.
type tunnelCodeEntry struct {
	hash     string
	expires  time.Time
	attempts int
	lastSent time.Time
}

// tunnelCodeHash — sha256(secret|email|code) en hex (le secret JWT sème le
// hash : deux instances ne partagent pas leurs codes, un dump mémoire ne
// revalide rien ailleurs).
func (a *API) tunnelCodeHash(email, code string) string {
	h := sha256.Sum256([]byte(a.secret + "|" + email + "|" + code))
	return hex.EncodeToString(h[:])
}

// tunnelNewCode — 6 chiffres tirés de crypto/rand (pas de math/rand : le
// code est un secret de session, même discipline que les tokens de reset).
func tunnelNewCode() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// repli horloge (nécessaire pour ne jamais refuser un login) :
		// entropie moindre mais code à TTL 10 min, tentatives bornées.
		return fmt.Sprintf("%06d", time.Now().UTC().UnixNano()%1_000_000)
	}
	v := uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
	return fmt.Sprintf("%06d", v%1_000_000)
}

// tunnelPurgeCodesLocked — purge paresseuse des entrées expirées (appelée
// sous tunnelMu ; le map reste borné sans timer ni goroutine dédiée).
func (a *API) tunnelPurgeCodesLocked() {
	if len(a.tunnelCodes) < tunnelCodePurgeAt {
		return
	}
	now := time.Now()
	for k, v := range a.tunnelCodes {
		if now.After(v.expires) {
			delete(a.tunnelCodes, k)
		}
	}
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/auth/request-code — demande d'un code par e-mail
// ---------------------------------------------------------------------------

// handleTunnelAuthCode — corps {email, website? (honeypot)} : génère un code
// à 6 chiffres, le stocke hashé (TTL 10 min) et l'e-mail PART via le relais
// plateforme. La réponse ne révèle RIEN sur l'existence d'un compte
// (passwordless : elle n'a pas d'importance — le client naît à la vérification).
func (a *API) handleTunnelAuthCode(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelCode.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<12)
	var req struct {
		Email   string `json:"email"`
		Website string `json:"website"` // honeypot — rempli = robot
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		// Honeypot : succès factice, rien n'est créé ni envoyé (pattern join N°27).
		writeJSON(w, http.StatusOK, map[string]any{"sent": true})
		return
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(req.Email))
	if err != nil || addr.Address == "" {
		writeErr(w, http.StatusBadRequest, "Adresse e-mail invalide")
		return
	}
	email := strings.ToLower(addr.Address)
	if len(email) > 254 {
		writeErr(w, http.StatusBadRequest, "Adresse e-mail invalide")
		return
	}

	// Résolution de l'expéditeur plateforme SOUS le verrou du store (miroir
	// N°301 : compte principal, relais Resend/SMTP N°150).
	a.store.Lock()
	var senderCfg model.NotificationSettings
	if cfg, ok := a.store.Data().NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
		senderCfg = cfg
	} else {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "email_relay_unavailable",
			"Canal e-mail non configuré — contactez le support MikCloud", nil)
		return
	}
	a.store.Unlock()

	code := tunnelNewCode()
	hash := a.tunnelCodeHash(email, code)

	// Cooldown par e-mail + pose de l'entrée (verrou dédié, JAMAIS imbriqué
	// avec le verrou du store — discipline tgPairings).
	a.tunnelMu.Lock()
	if e, ok := a.tunnelCodes[email]; ok && time.Since(e.lastSent) < tunnelCodeCooldown {
		a.tunnelMu.Unlock()
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(tunnelCodeCooldown.Seconds())))
		writeErr(w, http.StatusTooManyRequests, "Un code vient déjà d'être envoyé — patientez une minute")
		return
	}
	if len(a.tunnelCodes) >= tunnelCodeMapCap {
		a.tunnelPurgeCodesLocked()
		if len(a.tunnelCodes) >= tunnelCodeMapCap {
			a.tunnelMu.Unlock()
			writeErr(w, http.StatusServiceUnavailable, "Trop de demandes en attente — réessayez plus tard")
			return
		}
	}
	a.tunnelCodes[email] = &tunnelCodeEntry{hash: hash, expires: time.Now().Add(tunnelCodeTTL), lastSent: time.Now()}
	a.tunnelMu.Unlock()

	a.dispatchTunnelCodeEmail(senderCfg, email, code)
	writeJSON(w, http.StatusOK, map[string]any{
		"sent":    true,
		"message": "Code envoyé à " + email + " — valable 10 minutes",
	})
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/auth/verify — vérification → JWT tunnel
// ---------------------------------------------------------------------------

// handleTunnelAuthVerify — corps {email, code} : compare à temps constant
// contre l'entrée en mémoire (5 tentatives max, usage unique, TTL 10 min) ;
// succès → le client léger existe ou naît (table tunnel_clients, D-T2), un
// JWT rôle « tunnel » (24 h) est émis. Compte bloqué → refus net.
func (a *API) handleTunnelAuthVerify(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.tunnelVerify.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de tentatives — réessayez plus tard")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<12)
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	email := model.TunnelClientEmailKey(req.Email)
	code := strings.TrimSpace(req.Code)
	if email == "" || len(code) != 6 {
		writeErr(w, http.StatusBadRequest, "E-mail ou code invalide")
		return
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			writeErr(w, http.StatusBadRequest, "E-mail ou code invalide")
			return
		}
	}

	// Vérification du code (verrou dédié ; usage unique = l'entrée meurt au
	// succès comme à l'épuisement des tentatives).
	a.tunnelMu.Lock()
	entry := a.tunnelCodes[email]
	if entry == nil {
		a.tunnelMu.Unlock()
		writeErr(w, http.StatusBadRequest, "Aucun code en attente pour cet e-mail — demandez-en un nouveau")
		return
	}
	if time.Now().After(entry.expires) {
		delete(a.tunnelCodes, email)
		a.tunnelMu.Unlock()
		writeErr(w, http.StatusBadRequest, "Code expiré — demandez-en un nouveau")
		return
	}
	if entry.attempts >= tunnelCodeMaxTry {
		delete(a.tunnelCodes, email)
		a.tunnelMu.Unlock()
		writeErr(w, http.StatusTooManyRequests, "Trop de tentatives — demandez un nouveau code")
		return
	}
	want := a.tunnelCodeHash(email, code)
	if subtle.ConstantTimeCompare([]byte(want), []byte(entry.hash)) != 1 {
		entry.attempts++
		a.tunnelMu.Unlock()
		writeErr(w, http.StatusBadRequest, "Code incorrect")
		return
	}
	delete(a.tunnelCodes, email)
	a.tunnelMu.Unlock()

	// Client : existe ou NAÎT (inscription = connexion, D-T2).
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByEmail(db, email)
	if client == nil {
		if len(db.TunnelClients) >= model.MaxTunnelClients {
			a.store.Unlock()
			writeErrCode(w, http.StatusServiceUnavailable, "tunnel_clients_full",
				"Capacité momentanément atteinte — réessayez plus tard", nil)
			return
		}
		now := model.NowISO()
		db.TunnelClients = append(db.TunnelClients, model.TunnelClient{
			ID: model.NewID("tc-"), Email: email,
			Status: model.TunnelClientActive, CreatedAt: now, UpdatedAt: now,
		})
		client = &db.TunnelClients[len(db.TunnelClients)-1]
		a.logActivity(db, model.AccountMainID, "tunnel", "Nouveau client console tunnel : "+email)
	} else {
		if client.Status != model.TunnelClientActive {
			a.store.Unlock()
			writeErr(w, http.StatusForbidden, "Compte bloqué — contactez le support MikCloud")
			return
		}
		client.UpdatedAt = model.NowISO()
	}
	claims := auth.NewClaims(client.ID, client.Email, "tunnel", "", 0)
	token := auth.Sign(a.secret, claims)
	out := map[string]any{
		"token": token,
		"client": map[string]any{
			"id": client.ID, "email": client.Email, "createdAt": client.CreatedAt,
		},
	}
	a.store.Save()
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// ---------------------------------------------------------------------------
// GET /api/tunnel/me — profil + commandes B2C (JWT tunnel)
// ---------------------------------------------------------------------------

// handleTunnelMe — lecture pure : profil du client + PORTFOLIO des commandes
// B2C (appariement par e-mail, 15 plus récentes — ventes ET renouvellements,
// migration douce des MCV- historiques sans déplacement de données). Chaque
// ligne porte ses drapeaux d'action (renewable / revealable) ; le compte
// d'appareils vivants est renvoyé à part. Aucun secret ne sort : la conf
// d'un peer vit sur le VpnPeer lié et ne se livre QUE par le reveal (N°314),
// jamais dans cette liste.
func (a *API) handleTunnelMe(w http.ResponseWriter, r *http.Request) {
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
	// N°314 — portefeuille complet : les 15 commandes les plus récentes de cet
	// e-mail (ventes ET renouvellements, migration douce des MCV- historiques :
	// l'appariement par e-mail suffit — aucune donnée à déplacer). Chaque ligne
	// porte ses drapeaux d'action : « renewable » (appareil vivant → bouton
	// renouveler) et « revealable » (conf récupérable dans l'espace). AUCUN
	// secret ne sort ici (la conf se livre par POST /orders/{ref}/reveal).
	now := model.NowISO()
	orders := []map[string]any{}
	devices := 0
	for i := len(db.PublicVpnOrders) - 1; i >= 0 && len(orders) < 15; i-- {
		o := db.PublicVpnOrders[i]
		if !strings.EqualFold(o.Email, client.Email) {
			continue
		}
		planLabel := o.PlanID
		if plan := model.ResolvePublicVpnPlan(o.PlanID); plan != nil {
			planLabel = plan.Label
		}
		isDevice := o.Status == model.PublicVpnOrderProvisioned && o.PeerID != ""
		if isDevice {
			devices++
		}
		row := map[string]any{
			"ref": o.Ref, "plan": planLabel, "status": o.Status,
			"createdAt": o.CreatedAt, "expiresAt": o.ExpiresAt,
			"months": o.Months, "amountFcfa": o.AmountFcfa, "payMethod": o.PayMethod,
			"kind": o.Kind, "renewTargetRef": o.RenewTargetRef,
			// N°315 — famille de formule : la console propose les
			// BONNES formules de renouvellement (Pro pour un Pro,
			// b2c pour un B2C) et oriente vers /pro pour les Pro.
			"family":    model.PublicVpnPlanFamilyOf(o.PlanID),
			"renewable": isDevice,
			"revealable": o.Status == model.PublicVpnOrderProvisioned &&
				(o.ExpiresAt == "" || o.ExpiresAt >= now) &&
				(o.PeerID != "" || (o.Kind == model.PublicVpnKindRenewal && o.RenewTargetRef != "")),
		}
		orders = append(orders, row)
	}
	out := map[string]any{
		"client": map[string]any{
			"id": client.ID, "email": client.Email,
			"createdAt": client.CreatedAt, "updatedAt": client.UpdatedAt,
		},
		"orders":  orders,
		"devices": devices,
		"scope":   "phase3", // espace client + Accès Pro / LAN étendu (N°315)
	}
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// ---------------------------------------------------------------------------
// E-mail du code (relais plateforme, envoi asynchrone, trace sans secret)
// ---------------------------------------------------------------------------

// tunnelCodeEmailBodies — titre + texte de repli + HTML sobre (le code est
// un secret de session à 10 min : pas de logo lourd, pas de suivi).
func tunnelCodeEmailBodies(code string) (title, textBody, htmlBody string) {
	title = "Votre code MikTunnel"
	textBody = "Bonjour,\n\nVotre code de connexion MikTunnel : " + code + "\n\n" +
		"Il est valable 10 minutes et ne peut être utilisé qu'une fois.\n" +
		"Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.\n\n" +
		"— MikTunnel (powered by FTech CI)"
	htmlBody = "<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px\">" +
		"<h2 style=\"color:#0f766e;margin:0 0 16px\">MikTunnel</h2>" +
		"<p style=\"color:#334155;font-size:15px\">Votre code de connexion :</p>" +
		"<p style=\"font-size:30px;letter-spacing:8px;font-weight:700;color:#0f172a;background:#ccfbf1;border-radius:12px;padding:16px;text-align:center\">" + code + "</p>" +
		"<p style=\"color:#64748b;font-size:13px\">Valable 10 minutes, à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>" +
		"<p style=\"color:#94a3b8;font-size:12px\">— MikTunnel (powered by FTech CI)</p></div>"
	return title, textBody, htmlBody
}

// dispatchTunnelCodeEmail — envoi asynchrone + trace NotifLog SANS le code
// (pattern dispatchPublicVpnConfEmail : jamais d'envoi réseau sous le
// verrou, un échec d'e-mail n'abat rien).
func (a *API) dispatchTunnelCodeEmail(senderCfg model.NotificationSettings, to, code string) {
	title, textBody, htmlBody := tunnelCodeEmailBodies(code)
	cfgCopy := senderCfg
	logBody := "Code de connexion MikTunnel envoyé à " + to
	emailTaskDispatch()(func() {
		sendErr := accountEmailSender()(&cfgCopy, to, title, textBody, htmlBody)
		status, errText := "sent", ""
		if sendErr != nil {
			status, errText = "error", sendErr.Error()
		}
		a.store.Lock()
		db := a.store.Data()
		db.NotifLog = append(db.NotifLog, model.NotificationLog{
			ID: model.NewID("n-"), Status: status, Error: errText,
			Channel: "email", Kind: "tunnel_code",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}
