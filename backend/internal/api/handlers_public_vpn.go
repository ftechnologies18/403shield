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
		// N°315 — la vitrine /vpn ne montre QUE la famille b2c : les
		// formules Pro vivent dans la console MikTunnel (canal et
		// famille verrouillés aux deux bords — doctrine N°301).
		if p.Family != model.PublicVpnPlanFamilyB2C {
			continue
		}
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
	// N°315 — garde de FAMILLE : les formules Pro (Accès MikTunnel) ne se
	// vendent QUE depuis la console MikTunnel (elle exige l'appariement au
	// compte gérant) — la vitrine reste fulltunnel b2c exclusivement.
	if plan.Family != model.PublicVpnPlanFamilyB2C {
		writeErrCode(w, http.StatusBadRequest, "plan_not_for_vitrine",
			"Cette formule est réservée à la console MikTunnel (Accès Pro — tunnel.ftci.fr)", nil)
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
	// N°314 — RENOUVELLEMENT : la commande étend une commande EXISTANTE au
	// lieu de poser un nouveau peer (le point de convergence est ICI :
	// webhook GeniusPay, poll de retour, confirmation admin et balayage
	// horaire y passent tous). Cible vivante → extension immédiate (l'échéance
	// étendue vit sur la CIBLE, seule vérité — la ligne renewal reste une
	// transaction de facturation, PeerID volontairement vide) + e-mail de
	// confirmation ; cible morte (révoquée par le balayage entre la commande
	// et le paiement) → dégénérescence HONNÊTE en vente : nouveau peer, conf
	// neuve livrée.
	if order.Kind == model.PublicVpnKindRenewal {
		if target := model.FindPublicVpnOrderByRef(db, order.RenewTargetRef); target != nil &&
			target.Status == model.PublicVpnOrderProvisioned &&
			strings.EqualFold(target.Email, order.Email) {
			now := model.NowISO()
			newExpiry := model.ExtendPublicVpnExpiry(target.ExpiresAt, now, order.Months)
			target.ExpiresAt = newExpiry
			target.UpdatedAt = now
			order.Status = model.PublicVpnOrderProvisioned
			order.ExpiresAt = newExpiry // échéance miroir (traçabilité facturation)
			order.ErrorMsg = ""
			order.UpdatedAt = now
			order.PeerID = "" // une renewal ne porte JAMAIS de peer propre
			order.PeerName = ""
			a.logActivity(db, model.AccountMainID, "vpn",
				"Renouvellement VPN B2C appliqué : "+order.Ref+" — commande "+target.Ref+" étendue au "+newExpiry)
			// Expéditeur (relais plateforme N°150) résolu SOUS verrou, copie VALEUR.
			var senderCfg model.NotificationSettings
			senderOK := false
			if cfg, ok := db.NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
				senderCfg, senderOK = cfg, true
			}
			finalOrder := *order
			finalTarget := *target
			a.store.Save()
			a.store.Unlock()
			// Confirmation asynchrone (preuve du renouvellement, sans secret).
			if senderOK {
				a.dispatchPublicVpnRenewEmail(senderCfg, finalOrder, finalTarget)
			} else {
				a.logActivityBestEffort(order.Ref, "E-MAIL INDISPONIBLE : confirmation de renouvellement non envoyée (relais plateforme absent)")
			}
			return finalOrder, nil
		}
		// Cible morte/invalide : dégénérescence en VENTE (trace visible admin).
		// N°315 — la dégénérescence RESPECTE LA FAMILLE de la commande : une
		// renewal PRO repliée en vente reste PRO (même formule, même produit)
		// — jamais un fulltunnel B2C vendu à un acheteur qui voulait superviser.
		deadTarget := order.RenewTargetRef
		order.Kind = model.PublicVpnKindSale
		if model.PublicVpnPlanFamilyOf(order.PlanID) == model.PublicVpnPlanFamilyPro {
			order.Kind = model.PublicVpnKindPro
		}
		order.RenewTargetRef = ""
		order.UpdatedAt = model.NowISO()
		a.logActivity(db, model.AccountMainID, "vpn",
			"Renouvellement "+order.Ref+" replié en vente neuve : cible "+deadTarget+" indisponible")
	}
	// N°315 — ACCÈS PRO : le peer vit sous le COMPTE GÉRANT apparié par
	// e-mail (l'appariement a été vérifié à la COMMANDE — compte actif +
	// routeur agent ; ici on re-résout sous verrou : un compte disparu
	// entre-temps laisse la commande « paid » en erreur explicite, rejouée
	// par le balayage — l'admin annule/rembourse manuellement, jamais un
	// provisioning mensonger). Forme « remote » : supervision du compte
	// + LAN étendu — JAMAIS fulltunnel depuis ce canal.
	proAccountID := model.AccountMainID
	peerKind := model.VpnKindFullTunnel
	if order.Kind == model.PublicVpnKindPro {
		acc := tunnelProAccountLocked(db, order.Email)
		if acc == nil {
			order.ErrorMsg = "compte gérant introuvable pour cet e-mail — Accès Pro impossible (annulation/remboursement manuels)"
			order.UpdatedAt = model.NowISO()
			a.store.Save()
			snapshot := *order
			a.store.Unlock()
			return snapshot, fmt.Errorf("%s", order.ErrorMsg)
		}
		proAccountID = acc.ID
		peerKind = model.VpnKindRemote
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
	if order.Kind == model.PublicVpnKindPro {
		label = model.SanitizeDeviceName("Pro " + order.Email)
	}
	peer := model.VpnPeer{
		ID: model.NewID("vp-"), AccountID: proAccountID,
		Name: name, Label: label, Kind: peerKind,
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
	// N°312 — le canal B2C reste FULLTUNNEL exclusivement (le « remote » est
	// la forme supervision du gérant, hors sujet vitrine) ; N°315 — EXCEPTION
	// Pro : la commande kind=pro prend la forme « remote » SOUS LE COMPTE
	// gérant apparié (isolation D-B2 : les routeurs du compte, et rien
	// d'autre, acceptent ce peer — wgAllowedSourcesLocked s'élargit au
	// refresh wg_setup ci-dessous).
	conf, ip, err := wgMiniAddFn(name, peerKind)
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
	if order.Kind == model.PublicVpnKindPro {
		a.logActivity(db, model.AccountMainID, "vpn",
			"Accès Pro provisionné : "+name+" ("+ip+") sous le compte "+proAccountID+" — commande "+order.Ref+", terme "+order.ExpiresAt)
		// Élargissement allowed-address des routeurs du compte (D-B2) :
		// le peer Pro rejoint la liste de supervision IMMÉDIATEMENT
		// (re-file wg_setup aux routeurs agents actifs, ≤ 45 s).
		a.queueWgSetupRefreshLocked(nil, db, proAccountID, "accès Pro : supervision élargie : "+ip)
	} else {
		a.logActivity(db, model.AccountMainID, "vpn",
			"VPN B2C provisionné : "+name+" ("+ip+") — commande "+order.Ref+", terme "+order.ExpiresAt)
	}
	finalOrder := *order
	finalPeer := *row
	finalAccountID := proAccountID
	// Expéditeur (relais plateforme N°150) résolu SOUS verrou, copie VALEUR.
	var senderCfg model.NotificationSettings
	senderOK := false
	if cfg, ok := db.NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
		senderCfg, senderOK = cfg, true
	}
	a.store.Save()
	a.store.Unlock()

	// Phase 3.5 (N°315, Pro) : LAN étendu — application best-effort sur les
	// routeurs du compte dont le LAN est CONNU (re-application idempotente
	// avec la liste fraîche de peers + activation des détections en attente
	// d'un premier peer Pro). HORS verrou (wg-mini) — un échec laisse une
	// trace admin, jamais un provisioning mensonger.
	if finalOrder.Kind == model.PublicVpnKindPro {
		a.tunnelProApplyLanAllRouters(finalAccountID, finalOrder.Email)
		// La conf à livrer peut avoir été ÉTENDUE par le LAN (AllowedIPs
		// 3e entrée) : on relit la vérité FRAÎCHE du coffre (verrou bref)
		// — l'e-mail ne repart JAMAIS avec une copie antérieure.
		a.store.Lock()
		if p := model.FindVpnPeerByID(a.store.Data(), finalOrder.PeerID); p != nil && p.Conf != "" {
			conf = p.Conf
		}
		a.store.Unlock()
	}

	// Phase 4 : e-mail de livraison (asynchrone — jamais sous verrou).
	if senderOK {
		if finalOrder.Kind == model.PublicVpnKindPro {
			a.dispatchPublicVpnProEmail(senderCfg, finalOrder, finalPeer, conf)
		} else {
			a.dispatchPublicVpnConfEmail(senderCfg, finalOrder, finalPeer, conf)
		}
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

// ---------------------------------------------------------------------------
// N°315 — e-mail de livraison ACCÈS PRO (supervision + LAN étendu)
// ---------------------------------------------------------------------------

// publicVpnProEmailBodies — texte + HTML de la conf Pro livrée : le produit
// est la conf (supervision des routeurs + LAN étendu si déjà appliqué —
// sinon la consigne honnête d'activation dans l'espace MikTunnel), jamais un
// fulltunnel déguisé. Instructions calquées sur vpnDeliveryBody remote
// (import WireGuard, périmètre de routage dit HONNÊTE).
func publicVpnProEmailBodies(order model.PublicVpnOrder, peer model.VpnPeer, conf string) (title, textBody, htmlBody string) {
	title = "MikTunnel — Votre Accès Pro est prêt (" + order.Ref + ")"
	lanExtended := strings.Contains(conf, "AllowedIPs = 10.8.0.0/24, 10.8.2.0/24, ")
	perimeter := "vos routeurs MikroTik (segment tunnel 10.8.0.0/24 + votre accès 10.8.2.0/24)"
	if lanExtended {
		perimeter = "vos routeurs MikroTik ET votre réseau local derrière eux (caméras, NAS — cf. AllowedIPs de la configuration)"
	}
	var sb strings.Builder
	sb.WriteString("MikTunnel — Votre Accès Pro (powered by FTech CI)\n\n")
	sb.WriteString("Commande : " + order.Ref + "\n")
	if plan := model.ResolvePublicVpnPlan(order.PlanID); plan != nil {
		sb.WriteString("Formule : " + plan.Label + " (" + plan.PeriodLabel + ")\n")
	}
	sb.WriteString("Valide jusqu'au : " + order.ExpiresAt + "\n")
	sb.WriteString("Adresse tunnel de cet appareil : " + peer.IPv4 + "\n\n")
	sb.WriteString("Cet accès PRO supervise " + perimeter + ".\n")
	if !lanExtended {
		sb.WriteString("Le LAN étendu (caméras/NAS) s'active en un clic dans votre espace MikTunnel :\n")
		sb.WriteString("tunnel.ftci.fr → connexion par code → page « Accès Pro » → « Étendre au LAN ».\n\n")
	}
	sb.WriteString("1. Installez l'application WireGuard (App Store / Google Play / wireguard.com/install).\n")
	sb.WriteString("2. Enregistrez la configuration ci-dessous dans un fichier miktunnel.conf, puis dans WireGuard : « + » → « Importer depuis un fichier ».\n")
	sb.WriteString("3. Activez le tunnel : vos routeurs deviennent joignables (Winbox : http://" + peer.IPv4 + " reste votre propre adresse — vos routeurs répondent sur 10.8.0.x).\n\n")
	sb.WriteString("Le tunnel ne route RIEN d'autre — ni votre navigation Internet, ni votre DNS : supervision et LAN de VOS équipements, rien de plus.\n\n")
	sb.WriteString("Gardez cette référence (" + order.Ref + ") et votre espace MikTunnel (tunnel.ftci.fr) : configuration récupérable à tout moment, renouvellement en un clic.\n\n")
	sb.WriteString(conf)
	textBody = sb.String()

	htmlBody = "<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px\">" +
		"<h2 style=\"color:#0f766e;margin:0 0 16px\">MikTunnel — Accès Pro prêt</h2>" +
		"<p style=\"color:#334155;font-size:15px\">Commande <code>" + html.EscapeString(order.Ref) + "</code> — <b>valide jusqu'au</b> " + html.EscapeString(order.ExpiresAt) + "</p>" +
		"<p style=\"color:#0f172a;font-size:15px\">Cet accès supervise <b>" + html.EscapeString(perimeter) + "</b>.</p>"
	if !lanExtended {
		htmlBody += "<p style=\"color:#334155;font-size:14px\">Le LAN étendu (caméras/NAS) s'active en un clic dans votre <a href=\"https://tunnel.ftci.fr/pro\">espace MikTunnel</a> (page « Accès Pro » → « Étendre au LAN »).</p>"
	}
	htmlBody += "<p style=\"color:#334155;font-size:14px\">1. Installez <b>WireGuard</b> (App Store / Google Play / <a href=\"https://www.wireguard.com/install/\">wireguard.com</a>).<br>" +
		"2. Enregistrez la configuration ci-dessous en <b>miktunnel.conf</b>, puis « + » → « Importer depuis un fichier ».<br>" +
		"3. Activez le tunnel.</p>" +
		"<pre style=\"white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px\">" + html.EscapeString(conf) + "</pre>" +
		"<p style=\"color:#64748b;font-size:13px\">Le tunnel ne route rien d'autre — ni votre navigation, ni votre DNS : supervision et LAN de vos équipements, rien de plus.</p>" +
		"<p style=\"color:#94a3b8;font-size:12px\">— MikTunnel (powered by FTech CI)</p></div>"
	return title, textBody, htmlBody
}

// dispatchPublicVpnProEmail — envoi asynchrone + trace NotifLog SANS secret
// (pattern dispatchPublicVpnConfEmail : jamais d'envoi réseau sous le
// verrou, un échec d'e-mail n'abat rien — le reveal de l'espace reste la
// voie de secours).
func (a *API) dispatchPublicVpnProEmail(senderCfg model.NotificationSettings, order model.PublicVpnOrder, peer model.VpnPeer, conf string) {
	title, textBody, htmlBody := publicVpnProEmailBodies(order, peer, conf)
	cfgCopy := senderCfg
	to := order.Email
	logBody := "Conf Accès Pro " + order.Ref + " livrée à " + to
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
			Channel: "email", Kind: "vpn_pro",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
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
// N°314 — e-mail de confirmation de renouvellement (extension d'échéance)
// ---------------------------------------------------------------------------

// publicVpnRenewEmailBodies — confirmation du renouvellement : la preuve que
// le client attend (jusqu'à quand il est couvert). AUCUNE conf ici (elle ne
// change pas — l'appareil et sa configuration sont conservés, c'est
// l'argument du renouvellement) ; le journal ne porte que le résumé.
func publicVpnRenewEmailBodies(renewal, target model.PublicVpnOrder) (title, textBody, htmlBody string) {
	plan := model.ResolvePublicVpnPlan(renewal.PlanID)
	planLabel := renewal.PlanID
	if plan != nil {
		planLabel = plan.Label
	}
	until := renewal.ExpiresAt
	title = "Votre abonnement MikCloud VPN est renouvelé"
	textBody = "Bonjour,\n\n" +
		"Votre renouvellement (" + planLabel + ") est confirmé — référence " + renewal.Ref + ".\n" +
		"Votre accès " + target.Ref + " est désormais couvert jusqu'au " + until + ".\n\n" +
		"Votre configuration WireGuard ne change pas : elle reste celle livrée à votre adresse,\n" +
		"et reste récupérable dans votre espace MikTunnel à tout moment.\n\n" +
		"— MikCloud VPN (powered by FTech CI)"
	htmlBody = "<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px\">" +
		"<h2 style=\"color:#0f766e;margin:0 0 16px\">Renouvellement confirmé</h2>" +
		"<p style=\"color:#334155;font-size:15px\">Votre renouvellement (" + planLabel + ") est confirmé — référence <code>" + renewal.Ref + "</code>.</p>" +
		"<p style=\"color:#0f172a;font-size:15px\">Votre accès <code>" + target.Ref + "</code> est couvert jusqu'au <strong>" + until + "</strong>.</p>" +
		"<p style=\"color:#64748b;font-size:13px\">Votre configuration WireGuard ne change pas ; elle reste récupérable dans votre espace MikTunnel.</p>" +
		"<p style=\"color:#94a3b8;font-size:12px\">— MikCloud VPN (powered by FTech CI)</p></div>"
	return title, textBody, htmlBody
}

// dispatchPublicVpnRenewEmail — envoi asynchrone + trace NotifLog kind
// « vpn_renew » SANS la conf (pattern dispatchPublicVpnConfEmail : jamais
// d'envoi réseau sous le verrou, un échec d'e-mail n'abat rien).
func (a *API) dispatchPublicVpnRenewEmail(senderCfg model.NotificationSettings, renewal, target model.PublicVpnOrder) {
	title, textBody, htmlBody := publicVpnRenewEmailBodies(renewal, target)
	cfgCopy := senderCfg
	to := renewal.Email
	logBody := "Confirmation de renouvellement VPN B2C " + renewal.Ref + " (cible " + target.Ref + ") envoyée à " + to
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
			Channel: "email", Kind: "vpn_renew",
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
