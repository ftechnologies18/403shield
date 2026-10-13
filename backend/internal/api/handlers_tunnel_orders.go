// handlers_tunnel_orders.go — N°314 — gestion des commandes B2C DEPUIS la
// console tunnel (Programme Tunnel, phase 2 : l'espace client passe de la
// vitrine de rappel au PORTFOLIO complet).
//
// Deux routes (JWT rôle « tunnel », whitelist /api/tunnel/* ONLY) :
//
//   - POST /api/tunnel/orders/{ref}/reveal — re-livraison de la conf dans
//     l'espace : appariement STRICT e-mail (le JWT est né d'un code reçu à
//     CETTE adresse — la preuve de possession est plus forte que le duo
//     e-mail+ref de la vitrine), commande provisionée non expirée, conf du
//     peer lié avec self-healing wg-mini (pattern D5-a de handlePublicVpnRecover
//     / vue VPN gérant). Une RENEWAL suit sa cible (la conf vit sur la
//     commande renouvelée — la renewal n'est qu'une transaction) ;
//   - POST /api/tunnel/orders/{ref}/renew — renouvellement 1-clic : crée une
//     commande kind « renewal » (mêmes montants/formules que la vitrine,
//     même machine à états, même webhook GeniusPay MCV-) ciblant la commande
//     active ; à la confirmation du paiement, provisionPublicVpnOrder ÉTEND
//     l'échéance de la cible au lieu de poser un nouveau peer (l'appareil et
//     sa conf sont conservés — c'est l'argument produit).
//
// Disciplines :
//   - anti-énumération : e-mail divergent → 404 « Commande introuvable »,
//     identique à une référence inconnue (jamais de divulgation d'existence) ;
//   - la conf ne sort QUE dans la réponse du reveal (jamais dans un journal,
//     jamais dans /me — trace d'activité SANS la conf, conventions §8) ;
//   - appels GeniusPay HORS verrou du store (miroir handlePublicVpnOrderCreate) ;
//   - retour de paiement : vers la console d'origine (en-tête Origin https)
//     si elle est connue, repli vitrine MikCloud /vpn comme une vente ;
//   - quotas IP (tunnelAction) + honeypot sur le renouvellement (formulaire).
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// POST /api/tunnel/orders/{ref}/reveal — re-livraison de la conf (espace)
// ---------------------------------------------------------------------------

// handleTunnelReveal — appariement JWT tunnel ↔ commande : la référence dans
// le chemin, l'e-mail du CLIENT authentifié (le JWT est la preuve de
// possession de la boîte). La conf renvoyée est celle du peer lié — copie
// cloud, self-healing wg-mini si la copie est vide.
func (a *API) handleTunnelReveal(w http.ResponseWriter, r *http.Request) {
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
	ref := strings.TrimSpace(r.PathValue("ref"))

	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	order := model.FindPublicVpnOrderByRef(db, ref)
	// Anti-énumération : référence inconnue et e-mail divergent → même 404.
	if order == nil || !strings.EqualFold(order.Email, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	// Une RENEWAL est une transaction de facturation : la conf vit sur sa
	// CIBLE (renouveler ne change pas la configuration — c'est l'argument).
	for order.Kind == model.PublicVpnKindRenewal && order.RenewTargetRef != "" {
		target := model.FindPublicVpnOrderByRef(db, order.RenewTargetRef)
		if target == nil || !strings.EqualFold(target.Email, client.Email) {
			break
		}
		order = target
		break
	}
	if order.Status != model.PublicVpnOrderProvisioned {
		a.store.Unlock()
		writeErr(w, http.StatusGone, "Cette commande n'est plus active — renouvelez-la ou souscrivez un nouvel accès")
		return
	}
	if order.ExpiresAt != "" && order.ExpiresAt < model.NowISO() {
		a.store.Unlock()
		writeErr(w, http.StatusGone, "Cet accès est arrivé à terme le "+order.ExpiresAt+" — renouvelez-le pour continuer")
		return
	}
	if order.PeerID == "" {
		a.store.Unlock()
		writeErrCode(w, http.StatusServiceUnavailable, "conf_unavailable",
			"Configuration indisponible — contactez le support avec votre référence "+order.Ref, nil)
		return
	}
	var peer model.VpnPeer
	found := false
	if p := model.FindVpnPeerScoped(db, order.PeerID, model.AccountMainID); p != nil {
		peer = *p
		found = true
	}
	snapshot := *order
	a.store.Unlock()

	// Conf : copie cloud, self-healing wg-mini si vide (miroir D5-a).
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
			"Configuration indisponible — contactez le support avec votre référence "+snapshot.Ref, nil)
		return
	}

	// Trace SANS la conf (le journal n'est pas un coffre, conventions §8).
	a.store.Lock()
	a.logActivity(a.store.Data(), model.AccountMainID, "tunnel",
		"Reveal conf console tunnel : "+snapshot.Ref+" ("+client.Email+")")
	a.store.Save()
	a.store.Unlock()

	planLabel := snapshot.PlanID
	if plan := model.ResolvePublicVpnPlan(snapshot.PlanID); plan != nil {
		planLabel = plan.Label
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ref":       snapshot.Ref,
		"conf":      conf,
		"ipv4":      peer.IPv4,
		"plan":      planLabel,
		"months":    snapshot.Months,
		"expiresAt": snapshot.ExpiresAt,
	})
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/orders/{ref}/renew — renouvellement 1-clic
// ---------------------------------------------------------------------------

// tunnelConsoleReturnURL — base de retour de paiement pour la console : si la
// requête arrive DEPUIS une origine https connue (la console elle-même), le
// paiement GeniusPay y revient ; sinon repli vitrine MikCloud (/vpn), comme
// une vente. Le redirect GeniusPay ne concerne que l'ACHETEUR lui-même
// (initiateur du paiement) — aucune surface pour autrui.
func tunnelConsoleReturnURL(r *http.Request) string {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if strings.HasPrefix(origin, "https://") {
		return strings.TrimRight(origin, "/") + "/me"
	}
	return ""
}

// handleTunnelRenew — corps {planId, payMethod, phone?, website? (honeypot)} :
// crée la commande de renouvellement (kind renewal, cible = la commande du
// chemin) et initie le paiement GeniusPay (Wave/carte — mêmes clés, mêmes
// frais que la vitrine ; sans clés : bascule honnête sur le canal manual,
// l'admin confirme en console). Le webhook MCV- convergera vers
// provisionPublicVpnOrder, qui applique l'extension d'échéance.
func (a *API) handleTunnelRenew(w http.ResponseWriter, r *http.Request) {
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
	ref := strings.TrimSpace(r.PathValue("ref"))

	// ---- Vérifications + création de la commande (verrou) ----
	a.store.Lock()
	db := a.store.Data()
	client := model.FindTunnelClientByID(db, c.Sub)
	if client == nil || client.Status != model.TunnelClientActive {
		a.store.Unlock()
		writeErr(w, http.StatusUnauthorized, "Session invalide — reconnectez-vous")
		return
	}
	target := model.FindPublicVpnOrderByRef(db, ref)
	// Anti-énumération : référence inconnue ≡ e-mail divergent → même 404.
	if target == nil || !strings.EqualFold(target.Email, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	if target.Status != model.PublicVpnOrderProvisioned {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "target_not_active",
			"Cet accès n'est plus actif — souscrivez un nouvel accès sur la vitrine MikCloud VPN (mikcloud.ftci.fr/vpn)", nil)
		return
	}
	settings := ensureSettings(db, model.AccountMainID)
	if !(settings.Platform != nil && settings.Platform.PublicVpnShopEnabled()) {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "shop_disabled",
			"La vente directe MikCloud VPN n'est pas ouverte pour le moment", nil)
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
		Email: client.Email, Phone: digitsOf(phone),
		PlanID: plan.ID, Months: plan.Months,
		BaseAmountFcfa: pr.BaseFcfa, AmountFcfa: amount, PayMethod: payMethod,
		Kind:           model.PublicVpnKindRenewal,
		RenewTargetRef: target.Ref,
		Status:         model.PublicVpnOrderPending,
		CreatedAt:      now, UpdatedAt: now,
	}
	db.PublicVpnOrders = append(db.PublicVpnOrders, order)
	a.logActivity(db, model.AccountMainID, "vpn",
		"Renouvellement VPN B2C créé : "+order.Ref+" (cible "+target.Ref+", "+model.PublicVpnOrderLabel(order)+", "+fmt.Sprintf("%d FCFA", amount)+")")
	a.store.Save()
	a.store.Unlock()

	// ---- Initiation GeniusPay HORS verrou (miroir handlePublicVpnOrderCreate) ----
	paymentURL := ""
	gatewayRef := ""
	if payMethod == "wave" || payMethod == "card" {
		payload := geniusPayCreateReq{
			Amount:        amount,
			PaymentMethod: payMethod,
			Description:   fmt.Sprintf("Renouvellement MikCloud VPN %s (%s) — réf %s", plan.Label, plan.PeriodLabel, order.Ref),
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
		"targetRef":  target.Ref,
		"status":     model.PublicVpnOrderPending,
		"amountFcfa": amount,
		"payMethod":  payMethod,
		"paymentUrl": paymentURL,
		"online":     payMethod == "wave" || payMethod == "card",
	})
}
