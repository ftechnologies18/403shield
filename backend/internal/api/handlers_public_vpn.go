// handlers_public_vpn.go — N°301 — vitrine B2C « MikCloud VPN » (vente
// directe plateforme, /api/public/vpn/*) : le canal direct du grossiste.
//
// QUATRE routes PUBLIQUES (whitelist middleware.go, aucun JWT — l'acheteur
// n'a PAS de compte SaaS) :
//   - GET  /api/public/vpn/offers      : catalogue + frais par moyen (cacheable) ;
//   - POST /api/public/vpn/order       : création de commande (honeypot + quota
//     IP + une seule pending par e-mail + plafond d'ordres actifs) ;
//   - GET  /api/public/vpn/order/{ref} : statut minimal par référence (le poll
//     de retour de paiement re-vérifie GeniusPay et finalise — filet du
//     webhook retardé, même discipline que /api/subscription/pay/status) ;
//   - POST /api/public/vpn/recover     : re-livraison SELF-SERVICE de la conf
//     (e-mail + référence) — JAMAIS servie dans une réponse HTTP.
//
// Paiement : GeniusPay (Wave / carte — mêmes clés que l'encaissement SaaS),
// appariement metadata.ref = "MCV-…" (préfixe distinct des demandes
// d'abonnement "MC-"). Sans clés configurées : canal "manual" honnête — la
// commande existe, la plateforme confirme l'encaissement dans la console
// « VPN & Vente directe » (POST /api/admin/vpn/orders/{id}/resolve).
//
// Provisioning AUTOMATIQUE : paiement confirmé (webhook signé, poll de
// retour ou geste admin) → markPublicVpnOrderPaid → provisionPublicVpnOrder
// (peer wg0 posé au nom du compte principal via wg-mini, hors verrou —
// pattern N°291) → e-mail de livraison (relais plateforme N°150) → statut
// « provisioned » + ExpiresAt. Les échecs transitoires (wg-mini injoignable,
// pool épuisé) restent « paid » et sont REJOUÉS par le balayage horaire
// (publicvpn_sweep.go).
//
// Discipline de secrets : la conf ne sort JAMAIS en JSON (elle vit sur le
// VpnPeer, json:"-" + secretbox D5-a) ; les réponses publiques portent le
// STRICT minimum (statut, IP tunnel, terme) ; les journaux et NotifLog ne
// portent que des résumés (conventions §8) ; le quota IP coupe le flood
// AVANT tout envoi e-mail réel.
package api

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"net/mail"
	"net/url"
	"strings"

	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/notify"
)

// ---------------------------------------------------------------------------
// GET /api/public/vpn/offers — catalogue de la vitrine
// ---------------------------------------------------------------------------

// handlePublicVpnOffers — catalogue public : formules + montants PAR MOYEN
// (frais répercutés handlers_pricing.go) + disponibilité du paiement en
// ligne. Vitrine fermée → {"enabled": false} (200 : la page affiche l'état
// « bientôt disponible », aucune donnée ne fuit).
func (a *API) handlePublicVpnOffers(w http.ResponseWriter, r *http.Request) {
	a.store.Lock()
	db := a.store.Data()
	settings := ensureSettings(db, model.AccountMainID)
	enabled := settings.Platform != nil && settings.Platform.PublicVpnShopEnabled()
	a.store.Unlock()

	if !enabled {
		writeJSONCacheable(w, r, http.StatusOK, map[string]any{"enabled": false})
		return
	}
	_, _, online := geniusPayKeys()
	plans := make([]map[string]any, 0, len(model.PublicVpnPlans))
	for i := range model.PublicVpnPlans {
		p := model.PublicVpnPlans[i]
		pr := payPricingOf(p.BaseFcfa)
		plans = append(plans, map[string]any{
			"id": p.ID, "label": p.Label, "periodLabel": p.PeriodLabel, "months": p.Months,
			"baseFcfa": pr.BaseFcfa, "cardFcfa": pr.ListFcfa, "waveFcfa": pr.WaveFcfa,
		})
	}
	writeJSONCacheable(w, r, http.StatusOK, map[string]any{
		"enabled":       true,
		"onlinePayment": online,
		"plans":         plans,
	})
}

// ---------------------------------------------------------------------------
// POST /api/public/vpn/order — création de commande
// ---------------------------------------------------------------------------

// handlePublicVpnOrderCreate — corps {email, phone?, planId, payMethod,
// website? (honeypot)} : crée la commande pending et, si le paiement en
// ligne est configuré, initie la transaction GeniusPay (retour :
// paymentUrl). Sans clés : canal « manual » (confirmation console).
func (a *API) handlePublicVpnOrderCreate(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.vpnOrder.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de tentatives — réessayez plus tard")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		PlanID    string `json:"planId"`
		PayMethod string `json:"payMethod"`
		Website   string `json:"website"` // honeypot — rempli = robot
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		// Honeypot : succès factice, rien n'est créé (pattern join N°27).
		writeJSON(w, http.StatusOK, map[string]any{"ref": "", "status": "pending"})
		return
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(req.Email))
	if err != nil || addr.Address == "" {
		writeErr(w, http.StatusBadRequest, "Adresse e-mail invalide")
		return
	}
	email := strings.ToLower(addr.Address)
	plan := model.ResolvePublicVpnPlan(strings.TrimSpace(req.PlanID))
	if plan == nil {
		writeErr(w, http.StatusBadRequest, "Formule inconnue")
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

	a.store.Lock()
	db := a.store.Data()
	settings := ensureSettings(db, model.AccountMainID)
	if !(settings.Platform != nil && settings.Platform.PublicVpnShopEnabled()) {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "shop_disabled",
			"La vente directe MikCloud VPN n'est pas ouverte pour le moment", nil)
		return
	}
	if pending := model.PublicVpnOrderPendingForEmail(db, email); pending != nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "order_pending_exists",
			"Une commande est déjà en attente pour cet e-mail ("+pending.Ref+") — réglez-la ou attendez son expiration", nil)
		return
	}
	if model.PublicVpnActiveOrders(db) >= model.MaxPublicVpnActiveOrders {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "shop_full",
			"Capacité VPN momentanément atteinte — réessayez plus tard", nil)
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
		Email: email, Phone: digitsOf(phone),
		PlanID: plan.ID, Months: plan.Months,
		BaseAmountFcfa: pr.BaseFcfa, AmountFcfa: amount, PayMethod: payMethod,
		Status:    model.PublicVpnOrderPending,
		CreatedAt: now, UpdatedAt: now,
	}
	db.PublicVpnOrders = append(db.PublicVpnOrders, order)
	a.logActivity(db, model.AccountMainID, "vpn",
		"Commande VPN B2C créée : "+order.Ref+" ("+model.PublicVpnOrderLabel(order)+", "+fmt.Sprintf("%d FCFA", amount)+")")
	a.store.Save()
	a.store.Unlock()

	// Initiation GeniusPay HORS verrou (appel réseau). Échec → la commande
	// reste pending en canal manual : le buyer peut retenter, l'admin voit la
	// ligne (honnête plutôt qu'une commande invisible).
	paymentURL := ""
	gatewayRef := ""
	if payMethod == "wave" || payMethod == "card" {
		payload := geniusPayCreateReq{
			Amount:        amount,
			PaymentMethod: payMethod,
			Description:   fmt.Sprintf("MikCloud VPN %s (%s) — réf %s", plan.Label, plan.PeriodLabel, order.Ref),
			Customer:      &geniusPayCustomer{Name: buyerNameOf(email), Email: email, Phone: phone},
			Metadata:      map[string]string{"ref": order.Ref, "plan_id": plan.ID},
		}
		if appURL := strings.TrimRight(strings.TrimSpace(appPublicBaseURL()), "/"); appURL != "" {
			payload.SuccessURL = appURL + "/vpn?order=" + url.QueryEscape(order.Ref)
			payload.ErrorURL = appURL + "/vpn?order=" + url.QueryEscape(order.Ref)
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
			// Repli honnête : bascule manual + trace (la transaction peut avoir
			// été créée mais illisible — l'admin tranche en console).
			payMethod = "manual"
			a.store.Lock()
			db = a.store.Data()
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

	resp := map[string]any{
		"ref":        order.Ref,
		"status":     model.PublicVpnOrderPending,
		"amountFcfa": amount,
		"payMethod":  payMethod,
		"paymentUrl": paymentURL,
		"online":     payMethod == "wave" || payMethod == "card",
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// GET /api/public/vpn/order/{ref} — statut public + filet de finalisation
// ---------------------------------------------------------------------------

// handlePublicVpnOrderStatus — statut MINIMAL par référence (jamais de conf,
// jamais d'e-mail). pending + GatewayRef → re-vérification GeniusPay (le
// webhook peut être en retard : c'est LUI qui finalise le provisioning, le
// poll ne fait que déclencher la même source unique).
func (a *API) handlePublicVpnOrderStatus(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.vpnStatus.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de requêtes — réessayez plus tard")
		return
	}
	ref := strings.TrimSpace(r.PathValue("ref"))
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByRef(db, ref)
	if order == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	snapshot := *order
	a.store.Unlock()

	// Filet de sécurité : paiement en ligne pending → statut réel GeniusPay.
	if snapshot.Status == model.PublicVpnOrderPending && snapshot.GatewayRef != "" {
		pay, err := geniusPayGetPayment(snapshot.GatewayRef)
		if err == nil {
			switch strings.ToLower(strings.TrimSpace(pay.Status)) {
			case "completed", "complete", "succeeded", "success", "paid", "captured":
				if a.markPublicVpnOrderPaid(snapshot.ID, snapshot.GatewayRef, "geniuspay", "poll de retour") {
					// Finalisation synchrone : l'acheteur voit « provisioned »
					// dès son retour de la page de paiement.
					_, _ = a.provisionPublicVpnOrder(snapshot.ID)
				}
			case "failed", "cancelled", "canceled", "expired", "declined", "rejected":
				a.cancelPublicVpnOrder(snapshot.ID, "Paiement non abouti ("+pay.Status+")", "paiement en ligne")
			}
		}
		// Relecture de l'état effectif (provisioning peut avoir eu lieu).
		a.store.Lock()
		if o := model.FindPublicVpnOrderByID(a.store.Data(), snapshot.ID); o != nil {
			snapshot = *o
		}
		a.store.Unlock()
	}

	out := map[string]any{
		"ref":    snapshot.Ref,
		"status": snapshot.Status,
		"months": snapshot.Months,
	}
	if plan := model.ResolvePublicVpnPlan(snapshot.PlanID); plan != nil {
		out["planLabel"] = plan.Label
		out["periodLabel"] = plan.PeriodLabel
	}
	if snapshot.Status == model.PublicVpnOrderProvisioned {
		out["expiresAt"] = snapshot.ExpiresAt
		out["email"] = snapshot.Email // déjà connue de l'acheteur (c'est la sienne)
		a.store.Lock()
		if peer := model.FindVpnPeerScoped(a.store.Data(), snapshot.PeerID, model.AccountMainID); peer != nil {
			out["ipv4"] = peer.IPv4
		}
		a.store.Unlock()
	}
	writeJSON(w, http.StatusOK, out)
}

// ---------------------------------------------------------------------------
// POST /api/public/vpn/recover — re-livraison self-service de la conf
// ---------------------------------------------------------------------------

// handlePublicVpnRecover — corps {email, ref, website?} : appariement STRICT
// e-mail + référence sur une commande provisionée NON expirée → la conf
// complète part par e-mail (relais plateforme). Réponse GÉNÉRIQUE (aucune
// divulgation d'existence — anti-énumération), quota IP serré.
func (a *API) handlePublicVpnRecover(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.vpnRecover.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de tentatives — réessayez plus tard")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	var req struct {
		Email   string `json:"email"`
		Ref     string `json:"ref"`
		Website string `json:"website"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "Corps de requête invalide")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(req.Email))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "Adresse e-mail invalide")
		return
	}
	email := strings.ToLower(addr.Address)
	ref := strings.TrimSpace(req.Ref)

	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByRef(db, ref)
	if order == nil || order.Status != model.PublicVpnOrderProvisioned ||
		!strings.EqualFold(order.Email, email) ||
		(order.ExpiresAt != "" && order.ExpiresAt < model.NowISO()) {
		a.store.Unlock()
		// Générique : ni existence, ni raison (anti-énumération).
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Si cette commande existe, la configuration a été envoyée à votre adresse e-mail.",
		})
		return
	}
	// Conf : copie du peer lié, self-healing wg-mini si la copie cloud est vide
	// (pattern D5-a de la vue VPN gérant).
	var peer model.VpnPeer
	found := false
	if p := model.FindVpnPeerScoped(db, order.PeerID, model.AccountMainID); p != nil {
		peer = *p
		found = true
	}
	snapshot := *order
	// Expéditeur (relais plateforme N°150) résolu SOUS verrou : un envoi
	// impossible est une erreur HONNÊTE au buyer — jamais un faux « envoyé ».
	var senderCfg model.NotificationSettings
	senderOK := false
	if cfg, ok := db.NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
		senderCfg, senderOK = cfg, true
	}
	a.store.Unlock()

	conf := peer.Conf
	if found && conf == "" {
		if fresh, ferr := wgMiniConfFn(peer.Name); ferr == nil {
			conf = fresh
			a.store.Lock()
			if p := model.FindVpnPeerScoped(a.store.Data(), order.PeerID, model.AccountMainID); p != nil {
				p.Conf = fresh
				a.store.Save()
			}
			a.store.Unlock()
		}
	}
	if !found || conf == "" {
		writeErrCode(w, http.StatusServiceUnavailable, "conf_unavailable",
			"Configuration indisponible — contactez le support avec votre référence "+ref, nil)
		return
	}

	if !senderOK {
		writeErrCode(w, http.StatusServiceUnavailable, "email_unavailable",
			"Envoi d'e-mail indisponible — contactez le support avec votre référence "+ref, nil)
		return
	}
	a.sendPublicVpnConfEmailWith(senderCfg, snapshot, peer, conf)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Si cette commande existe, la configuration a été envoyée à votre adresse e-mail.",
	})
}

// ---------------------------------------------------------------------------
// Machine à états : markPaid / provision / cancel (sources uniques)
// ---------------------------------------------------------------------------

// markPublicVpnOrderPaid — paiement confirmé : pending → paid (idempotent,
// renvoie false si la commande n'est plus pending). N'appelle PAS le
// provisioning (l'appelant enchaîne — webhook, poll, admin, balayage).
func (a *API) markPublicVpnOrderPaid(orderID, gatewayRef, paidVia, resolvedBy string) bool {
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByID(db, orderID)
	if order == nil || order.Status != model.PublicVpnOrderPending {
		a.store.Unlock()
		return false
	}
	now := model.NowISO()
	order.Status = model.PublicVpnOrderPaid
	if gatewayRef != "" {
		order.GatewayRef = gatewayRef
	}
	if paidVia != "" {
		order.PaidVia = paidVia
	}
	order.PaidAt = now
	order.UpdatedAt = now
	if resolvedBy != "" {
		order.ResolvedBy = resolvedBy
	}
	order.ErrorMsg = ""
	a.logActivity(db, model.AccountMainID, "vpn",
		"Paiement VPN B2C confirmé : "+order.Ref+" ("+fmt.Sprintf("%d FCFA", order.AmountFcfa)+" via "+paidVia+")")
	a.store.Save()
	a.store.Unlock()
	return true
}

// provisionPublicVpnOrder — pose le peer wg0 de la commande (paid →
// provisioned). Réservation sous verrou, appel wg-mini HORS verrou (pattern
// N°291), finalisation re-vérrouillée, e-mail de livraison asynchrone.
// Idempotent : une commande non « paid » est un no-op (erreur explicite).
func (a *API) provisionPublicVpnOrder(orderID string) (model.PublicVpnOrder, error) {
	// Phase 1 : réservation (verrou).
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByID(db, orderID)
	if order == nil {
		a.store.Unlock()
		return model.PublicVpnOrder{}, fmt.Errorf("commande introuvable")
	}
	if order.Status != model.PublicVpnOrderPaid {
		snapshot := *order
		a.store.Unlock()
		return snapshot, nil // no-op : déjà provisionée/annulée
	}
	if model.VpnPeerSlotsUsed(db) >= model.VpnWg0PoolSize {
		order.ErrorMsg = "pool wg0 épuisé — provisioning différé"
		order.UpdatedAt = model.NowISO()
		a.store.Save()
		snapshot := *order
		a.store.Unlock()
		return snapshot, fmt.Errorf("%s", order.ErrorMsg)
	}
	name := model.NewVpnPeerName()
	for j := 0; j < 50 && model.VpnPeerNameTaken(db, name); j++ {
		name = model.NewVpnPeerName()
	}
	if model.VpnPeerNameTaken(db, name) {
		order.ErrorMsg = "réservation de nom impossible — réessayez"
		order.UpdatedAt = model.NowISO()
		a.store.Save()
		snapshot := *order
		a.store.Unlock()
		return snapshot, fmt.Errorf("%s", order.ErrorMsg)
	}
	label := model.SanitizeDeviceName("B2C " + order.Email)
	peer := model.VpnPeer{
		ID: model.NewID("vp-"), AccountID: model.AccountMainID,
		Name: name, Label: label, Kind: model.VpnKindFullTunnel,
		State:     model.VpnStatePending,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	}
	db.VpnPeers = append(db.VpnPeers, peer)
	order.PeerID = peer.ID
	order.PeerName = name
	order.ErrorMsg = ""
	order.UpdatedAt = model.NowISO()
	a.logActivity(db, model.AccountMainID, "vpn",
		"Provisioning VPN B2C en vol : "+name+" (commande "+order.Ref+")")
	a.store.Save()
	a.store.Unlock()

	// Phase 2 : wg-mini HORS verrou (jamais d'appel réseau sous le verrou global).
	conf, ip, err := wgMiniAddFn(name)
	if err != nil {
		// Nettoyage best-effort + trace : la commande reste « paid » (rejouée
		// par le balayage horaire) — jamais définitivement perdue.
		go func() { _ = wgMiniRemoveFn(name) }()
		a.store.Lock()
		db = a.store.Data()
		if o := model.FindPublicVpnOrderByID(db, orderID); o != nil {
			o.ErrorMsg = boundedString("wg-mini : "+err.Error(), 200)
			o.UpdatedAt = model.NowISO()
			if p := model.FindVpnPeerScoped(db, o.PeerID, model.AccountMainID); p != nil {
				p.State = model.VpnStateError
				p.ErrorMsg = boundedString(err.Error(), 200)
				p.UpdatedAt = model.NowISO()
			}
			a.store.Save()
		}
		a.store.Unlock()
		return model.PublicVpnOrder{}, fmt.Errorf("provisioning impossible : %w", err)
	}

	// Phase 3 : finalisation (re-verrou — la ligne peut avoir disparu entre-temps).
	a.store.Lock()
	db = a.store.Data()
	order = model.FindPublicVpnOrderByID(db, orderID)
	if order == nil || order.Status != model.PublicVpnOrderPaid {
		a.store.Unlock()
		go func() { _ = wgMiniRemoveFn(name) }()
		if order == nil {
			return model.PublicVpnOrder{}, fmt.Errorf("commande disparue pendant le provisioning")
		}
		return *order, nil
	}
	peerIdx := -1
	for i := range db.VpnPeers {
		if db.VpnPeers[i].ID == order.PeerID {
			peerIdx = i
			break
		}
	}
	if peerIdx < 0 {
		a.store.Unlock()
		go func() { _ = wgMiniRemoveFn(name) }()
		return model.PublicVpnOrder{}, fmt.Errorf("peer réservé disparu — provisioning annulé")
	}
	row := &db.VpnPeers[peerIdx]
	row.State = model.VpnStateActive
	row.IPv4 = ip
	row.Conf = conf
	row.ErrorMsg = ""
	row.UpdatedAt = model.NowISO()
	paidAt := order.PaidAt
	if paidAt == "" {
		paidAt = model.NowISO()
	}
	order.Status = model.PublicVpnOrderProvisioned
	order.ExpiresAt = model.AddMonthsISO(paidAt, order.Months)
	order.ErrorMsg = ""
	order.UpdatedAt = model.NowISO()
	a.logActivity(db, model.AccountMainID, "vpn",
		"VPN B2C provisionné : "+name+" ("+ip+") — commande "+order.Ref+", terme "+order.ExpiresAt)
	finalOrder := *order
	finalPeer := *row
	// Expéditeur (relais plateforme N°150) résolu SOUS verrou, copie VALEUR.
	var senderCfg model.NotificationSettings
	senderOK := false
	if cfg, ok := db.NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
		senderCfg, senderOK = cfg, true
	}
	a.store.Save()
	a.store.Unlock()

	// Phase 4 : e-mail de livraison (asynchrone — jamais sous verrou).
	if senderOK {
		a.dispatchPublicVpnConfEmail(senderCfg, finalOrder, finalPeer, conf)
	} else {
		a.logActivityBestEffort(order.Ref, "E-MAIL INDISPONIBLE : conf non livrée automatiquement (relais plateforme absent) — re-livraison possible via /vpn (récupération)")
	}
	return finalOrder, nil
}

// cancelPublicVpnOrder — annulation : pending/paid → cancelled (aucun peer à
// retirer, ou peer d'échec à nettoyer best-effort) ; provisioned → révocation
// du peer wg0 D'ABORD (le client payant garde l'accès tant que la VM n'a pas
// confirmé — discipline « jamais de peer fantôme »), puis cancelled.
func (a *API) cancelPublicVpnOrder(orderID, note, resolvedBy string) error {
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicVpnOrderByID(db, orderID)
	if order == nil {
		a.store.Unlock()
		return fmt.Errorf("commande introuvable")
	}
	switch order.Status {
	case model.PublicVpnOrderCancelled, model.PublicVpnOrderExpired:
		a.store.Unlock()
		return nil // idempotent
	case model.PublicVpnOrderPending, model.PublicVpnOrderPaid:
		// Peer d'échec éventuel : retrait best-effort + ligne purgée.
		peerName, peerID := order.PeerName, order.PeerID
		order.Status = model.PublicVpnOrderCancelled
		order.UpdatedAt = model.NowISO()
		order.ResolvedBy = resolvedBy
		order.ErrorMsg = boundedString(note, 200)
		if peerID != "" {
			db.VpnPeers = removeVpnPeerByID(db.VpnPeers, peerID)
		}
		a.logActivity(db, model.AccountMainID, "vpn", "Commande VPN B2C annulée : "+order.Ref+" ("+note+")")
		a.store.Save()
		a.store.Unlock()
		if peerName != "" {
			go func() { _ = wgMiniRemoveFn(peerName) }()
		}
		return nil
	case model.PublicVpnOrderProvisioned:
		peerName, peerID := order.PeerName, order.PeerID
		a.store.Unlock()
		// Retrait wg0 D'ABORD (hors verrou) : à chaud, les autres peers restent intacts.
		if err := wgMiniRemoveFn(peerName); err != nil {
			return fmt.Errorf("révocation VM impossible : %w", err)
		}
		a.store.Lock()
		db = a.store.Data()
		if o := model.FindPublicVpnOrderByID(db, orderID); o != nil {
			o.Status = model.PublicVpnOrderCancelled
			o.UpdatedAt = model.NowISO()
			o.ResolvedBy = resolvedBy
			o.ErrorMsg = boundedString(note, 200)
			db.VpnPeers = removeVpnPeerByID(db.VpnPeers, peerID)
			a.logActivity(db, model.AccountMainID, "vpn",
				"Commande VPN B2C annulée et peer révoqué : "+o.Ref+" ("+note+")")
			a.store.Save()
		}
		a.store.Unlock()
		return nil
	}
	a.store.Unlock()
	return fmt.Errorf("état inattendu : %s", order.Status)
}

// removeVpnPeerByID — retire la ligne du registre (utilitaire local).
func removeVpnPeerByID(peers []model.VpnPeer, id string) []model.VpnPeer {
	if id == "" {
		return peers
	}
	for i := range peers {
		if peers[i].ID == id {
			return append(peers[:i], peers[i+1:]...)
		}
	}
	return peers
}

// ---------------------------------------------------------------------------
// E-mails de livraison (relais plateforme, asynchrones, NotifLog sans secret)
// ---------------------------------------------------------------------------

// publicVpnEmailBodies — texte + HTML de la conf livrée (produit = la conf ;
// instructions minimales, discipline vpnDeliveryBody N°291).
func publicVpnEmailBodies(order model.PublicVpnOrder, peer model.VpnPeer, conf string) (title, textBody, htmlBody string) {
	title = "MikCloud — Votre VPN WireGuard est prêt (" + order.Ref + ")"
	var sb strings.Builder
	sb.WriteString("MikCloud — Votre accès VPN WireGuard\n\n")
	sb.WriteString("Commande : " + order.Ref + "\n")
	if plan := model.ResolvePublicVpnPlan(order.PlanID); plan != nil {
		sb.WriteString("Formule : " + plan.Label + " (" + plan.PeriodLabel + ")\n")
	}
	sb.WriteString("Valide jusqu'au : " + order.ExpiresAt + "\n\n")
	sb.WriteString("1. Installez l'application WireGuard (App Store / Google Play / wireguard.com/install).\n")
	sb.WriteString("2. Dans WireGuard : « + » → « Créer depuis un QR code » est impossible ici : choisissez « Créer à partir d'un tunnel vide »… ou plus simple — collez la configuration ci-dessous via « + » → « Importer depuis un fichier » après l'avoir enregistrée en mikcloud.conf.\n")
	sb.WriteString("3. Activez le tunnel : votre trafic sort alors par MikCloud (IP fixe France).\n\n")
	sb.WriteString("Gardez cette référence (" + order.Ref + ") : elle permet de récupérer votre configuration sur la page MikCloud VPN (section « Récupérer ma configuration »).\n\n")
	sb.WriteString(conf)
	textBody = sb.String()

	htmlBody = "<p>Votre accès VPN WireGuard MikCloud est prêt.</p>" +
		"<p><b>Commande</b> : " + html.EscapeString(order.Ref) + " — <b>valide jusqu'au</b> " + html.EscapeString(order.ExpiresAt) + "</p>" +
		"<p>1. Installez l'application <b>WireGuard</b> (App Store / Google Play / <a href=\"https://www.wireguard.com/install/\">wireguard.com/install</a>).<br>" +
		"2. Enregistrez la configuration ci-dessous dans un fichier <b>mikcloud.conf</b>, puis dans WireGuard : « + » → « Importer depuis un fichier ».<br>" +
		"3. Activez le tunnel : votre trafic sort par MikCloud (IP fixe France).</p>" +
		"<pre style=\"white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px\">" + html.EscapeString(conf) + "</pre>" +
		"<p style=\"color:#888;font-size:12px\">Gardez votre référence " + html.EscapeString(order.Ref) + " : elle permet de récupérer cette configuration sur la page MikCloud VPN (rubrique « Récupérer ma configuration »). Gardez cette configuration secrète : elle donne un accès complet.</p>"
	return title, textBody, htmlBody
}

// dispatchPublicVpnConfEmail — envoi asynchrone + trace NotifLog SANS secret
// (pattern handleVpnPeerEmail — jamais d'envoi réseau sous le verrou).
func (a *API) dispatchPublicVpnConfEmail(senderCfg model.NotificationSettings, order model.PublicVpnOrder, peer model.VpnPeer, conf string) {
	title, textBody, htmlBody := publicVpnEmailBodies(order, peer, conf)
	cfgCopy := senderCfg
	to := order.Email
	logBody := "Conf VPN B2C " + order.Ref + " livrée à " + to
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
			Channel: "email", Kind: "vpn_order",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}

// sendPublicVpnConfEmailWith — envoi avec expéditeur déjà résolu (recover) :
// même trace NotifLog, même file asynchrone.
func (a *API) sendPublicVpnConfEmailWith(senderCfg model.NotificationSettings, order model.PublicVpnOrder, peer model.VpnPeer, conf string) {
	title, textBody, htmlBody := publicVpnEmailBodies(order, peer, conf)
	cfgCopy := senderCfg
	to := order.Email
	logBody := "Conf VPN B2C " + order.Ref + " re-livrée à " + to
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
			Channel: "email", Kind: "vpn_order",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}

// ---------------------------------------------------------------------------
// Webhook GeniusPay — branche MCV- (commandes VPN B2C)
// ---------------------------------------------------------------------------

// handleGeniusPayWebhookVpnOrder — payment.success/failed d'une commande B2C
// (appariée par metadata.ref "MCV-…", repli GatewayRef). Appelé par
// handleGeniusPayWebhook APRÈS vérification de signature (les paiements
// exigent une signature valide — garantie par l'appelant) ; l'anti-replay et
// le parse sont déjà faits. Idempotent : une commande non pending est un
// accusé OK.
func (a *API) handleGeniusPayWebhookVpnOrder(w http.ResponseWriter, event, refMeta, gatewayRef string, amount float64) {
	a.store.Lock()
	order := model.FindPublicVpnOrderByRef(a.store.Data(), strings.TrimSpace(refMeta))
	if order == nil && gatewayRef != "" {
		for i := range a.store.Data().PublicVpnOrders {
			if a.store.Data().PublicVpnOrders[i].GatewayRef != "" &&
				strings.EqualFold(a.store.Data().PublicVpnOrders[i].GatewayRef, gatewayRef) {
				order = &a.store.Data().PublicVpnOrders[i]
				break
			}
		}
	}
	if order == nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusNotFound, "unknown_ref",
			"Aucune commande VPN pour la référence "+refMeta+gatewayRef, nil)
		return
	}
	if order.Status != model.PublicVpnOrderPending {
		a.store.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": order.Ref, "status": order.Status, "idempotent": true})
		return
	}
	orderID, ref := order.ID, order.Ref
	expectedAmt := order.AmountFcfa
	a.store.Unlock()

	if event == "payment.failed" {
		if err := a.cancelPublicVpnOrder(orderID, "Paiement échoué (payment.failed)", "webhook GeniusPay"); err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicVpnOrderCancelled})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicVpnOrderPending})
		return
	}

	if amount > 0 && int(amount) != expectedAmt {
		writeErrCode(w, http.StatusConflict, "amount_mismatch",
			fmt.Sprintf("Montant incohérent : reçu %.0f FCFA, attendu %d FCFA (référence %s)", amount, expectedAmt, ref), nil)
		return
	}
	if a.markPublicVpnOrderPaid(orderID, gatewayRef, "geniuspay", "webhook GeniusPay") {
		if _, err := a.provisionPublicVpnOrder(orderID); err != nil {
			// Provisioning différé (wg-mini down, pool…) : la commande reste
			// « paid » — accusé OK au webhook (GeniusPay relivrerait sinon) ;
			// le balayage horaire rejoue et l'erreur est visible en console.
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicVpnOrderPaid, "deferred": true})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicVpnOrderProvisioned})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "idempotent": true})
}

// ---------------------------------------------------------------------------
// Petits utilitaires locaux
// ---------------------------------------------------------------------------

// buyerNameOf — nom client dérivé de l'e-mail (partie locale, capitalisée) —
// cosmétique GeniusPay (reçus marchand).
func buyerNameOf(email string) string {
	local := email
	if i := strings.Index(email, "@"); i > 0 {
		local = email[:i]
	}
	local = strings.NewReplacer(".", " ", "_", " ", "-", " ").Replace(local)
	if local == "" {
		return "Client MikCloud"
	}
	return strings.ToUpper(local[:1]) + local[1:]
}

// digitsOf — ne garde que les chiffres (E.164 sans « + », discipline compte).
func digitsOf(phone string) string {
	var sb strings.Builder
	for _, r := range strings.TrimSpace(phone) {
		if r >= '0' && r <= '9' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// logActivityBestEffort — trace d'activité sans contexte de requête HTTP
// (goroutines, replis) : jamais bloquant, jamais en échec.
func (a *API) logActivityBestEffort(ref, message string) {
	defer func() { _ = recover() }()
	a.store.Lock()
	db := a.store.Data()
	a.logActivity(db, model.AccountMainID, "vpn", "VPN B2C "+ref+" : "+message)
	a.store.Save()
	a.store.Unlock()
}
