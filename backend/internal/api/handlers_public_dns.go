// handlers_public_dns.go — N°347 — vitrine DNS « TOURACO » + chaîne GeniusPay
// (/api/public/dns/*, miroir strict de la vente directe VPN N°301) : le canal
// d'abonnement du bouclier DNS TOURACO.
//
// QUATRE routes PUBLIQUES (whitelist middleware.go, aucun JWT — l'acheteur
// n'a PAS de compte SaaS) :
//   - GET  /api/public/dns/offers      : catalogue + frais par moyen (cacheable) ;
//   - POST /api/public/dns/order       : création de commande (honeypot + quota
//     IP + une seule pending par e-mail + plafond d'ordres actifs) ;
//   - GET  /api/public/dns/order/{ref} : statut minimal par référence (le poll
//     de retour de paiement re-vérifie GeniusPay et finalise — filet du
//     webhook retardé, même discipline que le canal VPN) ;
//   - POST /api/public/dns/recover     : re-livraison SELF-SERVICE de l'e-mail
//     d'activation (e-mail + référence) — le produit DNS n'a AUCUNE conf
//     secrète à livrer : le droit est l'échéance, la « livraison » est le
//     message d'activation (capacités + console /dns).
//
// Paiement : GeniusPay (Wave / carte — mêmes clés que l'encaissement SaaS),
// appariement metadata.ref = "MCD-…" (préfixe distinct : MC- = SaaS, MCV- =
// VPN B2C, MCD- = abonnement DNS — le webhook route par préfixe). Sans clés
// configurées : canal "manual" honnête — la commande existe, la plateforme
// confirme l'encaissement dans la console « Vente directe » (resolve).
//
// Provisioning SANS RÉSEAU (la différence structurelle avec le VPN) : le
// produit DNS ne pose aucun peer, aucune conf, aucune clé — le droit EST
// l'échéance posée sur la commande (ExpiresAt = paid + Months), l'entitlement
// effectif d'un e-mail est la PLUS LOINTAINE de ses échéances provisionnées
// non échues (model.DnsSubscriptionOfEmail). Les quotas étendus (profils 25,
// règles 600, logements 15, journal 90 j — model.DnsQuotasTouraco) se
// résolvent À LA LECTURE : aucune recopie, aucun cache, un terme franchi
// retombe immédiatement au tier gratuit INTACT (rien n'est jamais supprimé,
// seule la CRÉATION au-delà des bornes gratuites redevient refusée).
//
// Le renouvellement 1-clic vit dans la console /dns (JWT tunnel,
// POST /api/tunnel/dns/orders/{ref}/renew) et le registre grossiste dans la
// console plateforme (/api/admin/dns/orders — miroir VPN & Vente directe).
package api

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"net/mail"
	"net/url"
	"sort"
	"strings"

	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/notify"
)

// ---------------------------------------------------------------------------
// GET /api/public/dns/offers — catalogue de la vitrine
// ---------------------------------------------------------------------------

// handlePublicDnsOffers — catalogue public : formules + montants PAR MOYEN
// (frais répercutés handlers_pricing.go) + disponibilité du paiement en
// ligne. Vitrine fermée → {"enabled": false} (200 : la page affiche l'état
// « bientôt disponible », aucune donnée ne fuit — miroir VPN).
func (a *API) handlePublicDnsOffers(w http.ResponseWriter, r *http.Request) {
	a.store.Lock()
	db := a.store.Data()
	settings := ensureSettings(db, model.AccountMainID)
	enabled := settings.Platform != nil && settings.Platform.PublicDnsShopEnabled()
	a.store.Unlock()

	if !enabled {
		writeJSONCacheable(w, r, http.StatusOK, map[string]any{"enabled": false})
		return
	}
	_, _, online := geniusPayKeys()
	plans := make([]map[string]any, 0, len(model.PublicDnsPlans))
	for i := range model.PublicDnsPlans {
		p := model.PublicDnsPlans[i]
		pr := payPricingOf(p.BaseFcfa)
		plans = append(plans, map[string]any{
			"id":          p.ID,
			"label":       p.Label,
			"periodLabel": p.PeriodLabel,
			"months":      p.Months,
			"baseFcfa":    p.BaseFcfa,
			"cardFcfa":    pr.ListFcfa,
			"waveFcfa":    pr.WaveFcfa,
		})
	}
	writeJSONCacheable(w, r, http.StatusOK, map[string]any{
		"enabled":       true,
		"onlinePayment": online,
		"plans":         plans,
	})
}

// ---------------------------------------------------------------------------
// POST /api/public/dns/order — création de commande
// ---------------------------------------------------------------------------

// handlePublicDnsOrderCreate — corps {email, phone?, planId, payMethod,
// website? (honeypot)} : crée la commande pending et, si le paiement en
// ligne est configuré, initie la transaction GeniusPay (retour :
// paymentUrl). Sans clés : canal « manual » (confirmation console).
func (a *API) handlePublicDnsOrderCreate(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.dnsOrder.allow(clientIP(r)); !ok {
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
	plan := model.ResolvePublicDnsPlan(strings.TrimSpace(req.PlanID))
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
	if !(settings.Platform != nil && settings.Platform.PublicDnsShopEnabled()) {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "shop_disabled",
			"La vente de l'abonnement DNS 403Shield n'est pas ouverte pour le moment", nil)
		return
	}
	if pending := model.PublicDnsOrderPendingForEmail(db, email); pending != nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "order_pending_exists",
			"Une commande est déjà en attente pour cet e-mail ("+pending.Ref+") — réglez-la ou attendez son expiration", nil)
		return
	}
	if model.PublicDnsActiveOrders(db) >= model.MaxPublicDnsActiveOrders {
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
	order := model.PublicDnsOrder{
		ID: model.NewID("do-"), Ref: model.NewPublicDnsRef(db),
		Email: email, Phone: digitsOf(phone),
		PlanID: plan.ID, Months: plan.Months,
		BaseAmountFcfa: pr.BaseFcfa, AmountFcfa: amount, PayMethod: payMethod,
		Status:    model.PublicDnsOrderPending,
		CreatedAt: now, UpdatedAt: now,
	}
	db.PublicDnsOrders = append(db.PublicDnsOrders, order)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Commande DNS TOURACO créée : "+order.Ref+" ("+model.PublicDnsOrderLabel(order)+", "+fmt.Sprintf("%d FCFA", amount)+")")
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
			Description:   fmt.Sprintf("403Shield DNS %s (%s) — réf %s", plan.Label, plan.PeriodLabel, order.Ref),
			Customer:      &geniusPayCustomer{Name: buyerNameOf(email), Email: email, Phone: phone},
			Metadata:      map[string]string{"ref": order.Ref, "plan_id": plan.ID},
		}
		// N°347 — le retour de paiement revient à la CAISSE DU SITE vitrine
		// (/checkout gère les deux produits : le préfixe de la référence
		// route vers la bonne API de statut — le VPN revenait à /shop
		// console, la caisse DNS naît sur le site).
		payload.SuccessURL = appPublicBaseURL() + "/checkout?order=" + url.QueryEscape(order.Ref)
		payload.ErrorURL = appPublicBaseURL() + "/checkout?order=" + url.QueryEscape(order.Ref)
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
			if o := model.FindPublicDnsOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.PayMethod = "manual"
				o.AmountFcfa = pr.BaseFcfa
				o.ErrorMsg = "initiation paiement en ligne impossible"
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
			a.logActivityBestEffortDns(order.Ref, "bascule canal manual (initiation GeniusPay impossible)")
		} else {
			a.store.Lock()
			if o := model.FindPublicDnsOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.GatewayRef = gatewayRef
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
		}
	}

	resp := map[string]any{
		"ref":        order.Ref,
		"status":     model.PublicDnsOrderPending,
		"amountFcfa": amount,
		"payMethod":  payMethod,
		"paymentUrl": paymentURL,
		"online":     payMethod == "wave" || payMethod == "card",
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// GET /api/public/dns/order/{ref} — statut public + filet de finalisation
// ---------------------------------------------------------------------------

// handlePublicDnsOrderStatus — statut MINIMAL par référence (jamais
// d'e-mail, jamais d'état interne). pending + GatewayRef → re-vérification
// GeniusPay (le webhook peut être en retard : c'est LUI qui finalise, le
// poll ne fait que déclencher la même source unique).
func (a *API) handlePublicDnsOrderStatus(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.dnsStatus.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retry.Seconds())+1))
		writeErr(w, http.StatusTooManyRequests, "Trop de requêtes — réessayez plus tard")
		return
	}
	ref := strings.TrimSpace(r.PathValue("ref"))
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicDnsOrderByRef(db, ref)
	if order == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	snapshot := *order
	a.store.Unlock()

	// Filet de sécurité : paiement en ligne pending → statut réel GeniusPay.
	if snapshot.Status == model.PublicDnsOrderPending && snapshot.GatewayRef != "" {
		pay, err := geniusPayGetPayment(snapshot.GatewayRef)
		if err == nil {
			switch strings.ToLower(strings.TrimSpace(pay.Status)) {
			case "completed", "complete", "succeeded", "success", "paid", "captured":
				if a.markPublicDnsOrderPaid(snapshot.ID, snapshot.GatewayRef, "geniuspay", "poll de retour") {
					// Finalisation synchrone : l'acheteur voit « provisioned »
					// dès son retour de la page de paiement.
					_, _ = a.provisionPublicDnsOrder(snapshot.ID)
				}
			case "failed", "cancelled", "canceled", "expired", "declined", "rejected":
				_ = a.cancelPublicDnsOrder(snapshot.ID, "Paiement non abouti ("+pay.Status+")", "paiement en ligne")
			}
		}
		// Relecture de l'état effectif (provisioning peut avoir eu lieu).
		a.store.Lock()
		if o := model.FindPublicDnsOrderByID(a.store.Data(), snapshot.ID); o != nil {
			snapshot = *o
		}
		a.store.Unlock()
	}

	out := map[string]any{
		"ref":    snapshot.Ref,
		"status": snapshot.Status,
		"months": snapshot.Months,
	}
	if plan := model.ResolvePublicDnsPlan(snapshot.PlanID); plan != nil {
		out["planLabel"] = plan.Label
		out["periodLabel"] = plan.PeriodLabel
	}
	if snapshot.Status == model.PublicDnsOrderProvisioned {
		out["expiresAt"] = snapshot.ExpiresAt
	}
	writeJSON(w, http.StatusOK, out)
}

// ---------------------------------------------------------------------------
// POST /api/public/dns/recover — re-livraison self-service de l'activation
// ---------------------------------------------------------------------------

// handlePublicDnsRecover — corps {email, ref, website?} : appariement STRICT
// e-mail + référence sur une commande provisionée NON expirée → l'e-mail
// d'activation (capacités + console /dns) est re-envoyé. Réponse GÉNÉRIQUE
// (aucune divulgation d'existence — anti-énumération), quota IP serré.
// AUCUNE conf à servir en HTTP : le produit DNS est un droit, pas un secret.
func (a *API) handlePublicDnsRecover(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.dnsRecover.allow(clientIP(r)); !ok {
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
	order := model.FindPublicDnsOrderByRef(db, ref)
	if order == nil || order.Status != model.PublicDnsOrderProvisioned ||
		!strings.EqualFold(order.Email, email) ||
		(order.ExpiresAt != "" && order.ExpiresAt < model.NowISO()) {
		a.store.Unlock()
		// Générique : ni existence, ni raison (anti-énumération).
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Si cette commande existe, l'e-mail d'activation a été envoyé à votre adresse.",
		})
		return
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

	if !senderOK {
		writeErrCode(w, http.StatusServiceUnavailable, "email_unavailable",
			"Envoi d'e-mail indisponible — contactez le support avec votre référence "+ref, nil)
		return
	}
	a.sendPublicDnsEmailWith(senderCfg, snapshot)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Si cette commande existe, l'e-mail d'activation a été envoyé à votre adresse.",
	})
}

// ---------------------------------------------------------------------------
// Machine à états : markPaid / provision / cancel (sources uniques)
// ---------------------------------------------------------------------------

// markPublicDnsOrderPaid — paiement confirmé : pending → paid (idempotent,
// renvoie false si la commande n'est plus pending). N'appelle PAS le
// provisioning (l'appelant enchaîne — webhook, poll, admin, balayage).
func (a *API) markPublicDnsOrderPaid(orderID, gatewayRef, paidVia, resolvedBy string) bool {
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicDnsOrderByID(db, orderID)
	if order == nil || order.Status != model.PublicDnsOrderPending {
		a.store.Unlock()
		return false
	}
	now := model.NowISO()
	order.Status = model.PublicDnsOrderPaid
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
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Paiement DNS TOURACO confirmé : "+order.Ref+" ("+fmt.Sprintf("%d FCFA", order.AmountFcfa)+" via "+paidVia+")")
	a.store.Save()
	a.store.Unlock()
	return true
}

// provisionPublicDnsOrder — pose le droit de la commande (paid →
// provisioned). SANS RÉSEAU (la différence avec le VPN : aucun peer, aucune
// clé — le droit EST l'échéance) : tout se joue sous le verrou, l'e-mail
// d'activation part en asynchrone. Idempotent : une commande non « paid »
// est un no-op.
func (a *API) provisionPublicDnsOrder(orderID string) (model.PublicDnsOrder, error) {
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicDnsOrderByID(db, orderID)
	if order == nil {
		a.store.Unlock()
		return model.PublicDnsOrder{}, fmt.Errorf("commande introuvable")
	}
	if order.Status != model.PublicDnsOrderPaid {
		snapshot := *order
		a.store.Unlock()
		return snapshot, nil // no-op : déjà provisionée/annulée
	}
	// RENOUVELLEMENT : la commande étend une commande EXISTANTE (l'échéance
	// étendue vit sur la CIBLE, seule vérité — la ligne renewal reste une
	// transaction de facturation). Cible morte (expirée par le balayage
	// entre la commande et le paiement) → dégénérescence HONNÊTE en vente :
	// un nouveau droit est posé à partir du paiement.
	if order.Kind == model.PublicDnsKindRenewal {
		if target := model.FindPublicDnsOrderByRef(db, order.RenewTargetRef); target != nil &&
			target.Status == model.PublicDnsOrderProvisioned &&
			strings.EqualFold(target.Email, order.Email) {
			now := model.NowISO()
			newExpiry := model.ExtendPublicDnsExpiry(target.ExpiresAt, now, order.Months)
			target.ExpiresAt = newExpiry
			target.UpdatedAt = now
			order.Status = model.PublicDnsOrderProvisioned
			order.ExpiresAt = newExpiry // échéance miroir (traçabilité facturation)
			order.ErrorMsg = ""
			order.UpdatedAt = now
			a.logActivity(db, model.AccountMainID, "tunnel",
				"Renouvellement DNS TOURACO appliqué : "+order.Ref+" — commande "+target.Ref+" étendue au "+newExpiry)
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
				a.dispatchPublicDnsRenewEmail(senderCfg, finalOrder, finalTarget)
			} else {
				a.logActivityBestEffortDns(order.Ref, "E-MAIL INDISPONIBLE : confirmation de renouvellement non envoyée (relais plateforme absent)")
			}
			return finalOrder, nil
		}
		// Cible morte/invalide : dégénérescence en VENTE (trace visible admin).
		deadTarget := order.RenewTargetRef
		order.Kind = model.PublicDnsKindSale
		order.RenewTargetRef = ""
		order.UpdatedAt = model.NowISO()
		a.logActivity(db, model.AccountMainID, "tunnel",
			"Renouvellement "+order.Ref+" replié en vente neuve : cible "+deadTarget+" indisponible")
	}
	paidAt := order.PaidAt
	if paidAt == "" {
		paidAt = model.NowISO()
	}
	order.Status = model.PublicDnsOrderProvisioned
	order.ExpiresAt = model.AddMonthsISO(paidAt, order.Months)
	order.ErrorMsg = ""
	order.UpdatedAt = model.NowISO()
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Abonnement DNS TOURACO activé : "+order.Ref+" — droit jusqu'au "+order.ExpiresAt+" (quotas étendus pour "+order.Email+")")
	finalOrder := *order
	// Expéditeur (relais plateforme N°150) résolu SOUS verrou, copie VALEUR.
	var senderCfg model.NotificationSettings
	senderOK := false
	if cfg, ok := db.NotifSettings[model.AccountMainID]; ok && notify.EmailCredentialsOK(&cfg) {
		senderCfg, senderOK = cfg, true
	}
	a.store.Save()
	a.store.Unlock()

	// E-mail d'activation (asynchrone — jamais sous verrou).
	if senderOK {
		a.dispatchPublicDnsEmail(senderCfg, finalOrder)
	} else {
		a.logActivityBestEffortDns(order.Ref, "E-MAIL INDISPONIBLE : activation non notifiée (relais plateforme absent) — le droit est actif, la console /dns le montre")
	}
	return finalOrder, nil
}

// cancelPublicDnsOrder — annulation : pending/paid → cancelled ; provisioned
// → cancelled (le DROIT cesse — les quotas retombent au tier gratuit au
// calcul suivant, RIEN n'est supprimé : les profils/logements restent,
// doctrine « jamais de coupure sournoise »). Aucun réseau à révoquer.
func (a *API) cancelPublicDnsOrder(orderID, note, resolvedBy string) error {
	a.store.Lock()
	db := a.store.Data()
	order := model.FindPublicDnsOrderByID(db, orderID)
	if order == nil {
		a.store.Unlock()
		return fmt.Errorf("commande introuvable")
	}
	switch order.Status {
	case model.PublicDnsOrderCancelled, model.PublicDnsOrderExpired:
		a.store.Unlock()
		return nil // idempotent
	case model.PublicDnsOrderPending, model.PublicDnsOrderPaid, model.PublicDnsOrderProvisioned:
		wasProvisioned := order.Status == model.PublicDnsOrderProvisioned
		order.Status = model.PublicDnsOrderCancelled
		order.UpdatedAt = model.NowISO()
		order.ResolvedBy = resolvedBy
		order.ErrorMsg = boundedString(note, 200)
		if wasProvisioned {
			a.logActivity(db, model.AccountMainID, "tunnel",
				"Commande DNS TOURACO annulée : "+order.Ref+" — droit retiré, les quotas retombent au niveau gratuit (rien n'est supprimé)")
		} else {
			a.logActivity(db, model.AccountMainID, "tunnel", "Commande DNS TOURACO annulée : "+order.Ref+" ("+note+")")
		}
		a.store.Save()
		a.store.Unlock()
		return nil
	}
	a.store.Unlock()
	return fmt.Errorf("état inattendu : %s", order.Status)
}

// ---------------------------------------------------------------------------
// E-mails d'activation (relais plateforme, asynchrones, NotifLog sans secret)
// ---------------------------------------------------------------------------

// publicDnsEmailBodies — texte + HTML de l'activation : le produit est le
// DROIT (capacités étendues + échéance + où l'utiliser). AUCUNE conf, aucun
// secret — la console /dns reste la maison des profils et des guides
// d'installation par appareil (Android DoT, profils Apple, box).
func publicDnsEmailBodies(order model.PublicDnsOrder) (title, textBody, htmlBody string) {
	title = "403Shield — Votre abonnement TOURACO est actif (" + order.Ref + ")"
	planLine := order.PlanID
	if plan := model.ResolvePublicDnsPlan(order.PlanID); plan != nil {
		planLine = plan.Label + " (" + plan.PeriodLabel + ")"
	}
	var sb strings.Builder
	sb.WriteString("403Shield — Votre abonnement DNS TOURACO est actif\n\n")
	sb.WriteString("Commande : " + order.Ref + "\n")
	sb.WriteString("Formule : " + planLine + "\n")
	sb.WriteString("Couvert jusqu'au : " + order.ExpiresAt + "\n\n")
	sb.WriteString("Le bouclier DNS TOURACO protège déjà vos appareils et votre maison.\n")
	sb.WriteString("Votre abonnement relève vos capacités jusqu'à cette échéance :\n")
	sb.WriteString("- 25 profils de filtrage (au lieu de 10)\n")
	sb.WriteString("- 600 règles par liste bloquer/autoriser (au lieu de 200)\n")
	sb.WriteString("- 15 logements « toute la maison » (au lieu de 5)\n")
	sb.WriteString("- 90 jours de journal de blocage (au lieu de 30)\n\n")
	sb.WriteString("Tout vit dans votre console DNS : " + tunnelPublicBaseURL() + "/dns\n")
	sb.WriteString("(profils, guides d'installation Android/iPhone/Mac/Box, liaisons maison, journal).\n\n")
	sb.WriteString("Gardez cette référence (" + order.Ref + ") : elle permet de récupérer votre e-mail d'activation\n")
	sb.WriteString("sur la boutique 403Shield et de renouveler en un clic depuis la console.\n\n")
	sb.WriteString("— 403Shield (powered by FTech CI)")
	textBody = sb.String()

	htmlBody = "<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px\">" +
		"<h2 style=\"color:#0f766e;margin:0 0 16px\">TOURACO est actif</h2>" +
		"<p style=\"color:#334155;font-size:15px\">Commande <code>" + html.EscapeString(order.Ref) + "</code> — <b>couvert jusqu'au</b> " + html.EscapeString(order.ExpiresAt) + ".</p>" +
		"<p style=\"color:#0f172a;font-size:15px\">Le bouclier DNS <b>TOURACO</b> protège vos appareils et votre maison. Votre <b>abonnement</b> relève vos capacités :</p>" +
		"<ul style=\"color:#334155;font-size:14px;line-height:1.7\">" +
		"<li><b>25 profils</b> de filtrage (au lieu de 10)</li>" +
		"<li><b>600 règles</b> par liste (au lieu de 200)</li>" +
		"<li><b>15 logements</b> « toute la maison » (au lieu de 5)</li>" +
		"<li><b>90 jours</b> de journal de blocage (au lieu de 30)</li>" +
		"</ul>" +
		"<p style=\"color:#334155;font-size:14px\">Tout vit dans votre <a href=\"" + tunnelPublicBaseURL() + "/dns\">console DNS</a> : profils, guides d'installation par appareil, liaisons maison, journal.</p>" +
		"<p style=\"color:#64748b;font-size:13px\">Gardez votre référence " + html.EscapeString(order.Ref) + " : récupération de l'activation et renouvellement en un clic.</p>" +
		"<p style=\"color:#94a3b8;font-size:12px\">— 403Shield (powered by FTech CI)</p></div>"
	return title, textBody, htmlBody
}

// dispatchPublicDnsEmail — envoi asynchrone + trace NotifLog SANS secret
// (pattern dispatchPublicVpnConfEmail — jamais d'envoi réseau sous le
// verrou, un échec d'e-mail n'abat rien : le droit est actif, la console le
// montre).
func (a *API) dispatchPublicDnsEmail(senderCfg model.NotificationSettings, order model.PublicDnsOrder) {
	title, textBody, htmlBody := publicDnsEmailBodies(order)
	cfgCopy := senderCfg
	to := order.Email
	logBody := "Activation DNS TOURACO " + order.Ref + " envoyée à " + to
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
			Channel: "email", Kind: "dns_order",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}

// sendPublicDnsEmailWith — envoi avec expéditeur déjà résolu (recover) :
// même trace NotifLog, même file asynchrone.
func (a *API) sendPublicDnsEmailWith(senderCfg model.NotificationSettings, order model.PublicDnsOrder) {
	title, textBody, htmlBody := publicDnsEmailBodies(order)
	cfgCopy := senderCfg
	to := order.Email
	logBody := "Activation DNS TOURACO " + order.Ref + " re-envoyée à " + to
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
			Channel: "email", Kind: "dns_order",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}

// publicDnsRenewEmailBodies — confirmation du renouvellement : la preuve que
// l'abonné attend (jusqu'à quand il est couvert). Aucun secret.
func publicDnsRenewEmailBodies(renewal, target model.PublicDnsOrder) (title, textBody, htmlBody string) {
	planLabel := renewal.PlanID
	if plan := model.ResolvePublicDnsPlan(renewal.PlanID); plan != nil {
		planLabel = plan.Label
	}
	until := renewal.ExpiresAt
	title = "Votre abonnement 403Shield DNS TOURACO est renouvelé"
	textBody = "Bonjour,\n\n" +
		"Votre renouvellement (" + planLabel + ") est confirmé — référence " + renewal.Ref + ".\n" +
		"Votre abonnement " + target.Ref + " est désormais couvert jusqu'au " + until + ".\n\n" +
		"Vos capacités étendues (25 profils, 600 règles, 15 logements, 90 jours de journal)\n" +
		"restent actives — vos profils et vos liaisons maison ne changent pas.\n\n" +
		"Votre console DNS : " + tunnelPublicBaseURL() + "/dns\n\n" +
		"— 403Shield (powered by FTech CI)"
	htmlBody = "<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px\">" +
		"<h2 style=\"color:#0f766e;margin:0 0 16px\">Renouvellement confirmé</h2>" +
		"<p style=\"color:#334155;font-size:15px\">Votre renouvellement (" + html.EscapeString(planLabel) + ") est confirmé — référence <code>" + html.EscapeString(renewal.Ref) + "</code>.</p>" +
		"<p style=\"color:#0f172a;font-size:15px\">Votre abonnement <code>" + html.EscapeString(target.Ref) + "</code> est couvert jusqu'au <strong>" + html.EscapeString(until) + "</strong>.</p>" +
		"<p style=\"color:#64748b;font-size:13px\">Vos capacités étendues restent actives — profils et liaisons maison inchangés. Console : <a href=\"" + tunnelPublicBaseURL() + "/dns\">DNS 403Shield</a>.</p>" +
		"<p style=\"color:#94a3b8;font-size:12px\">— 403Shield (powered by FTech CI)</p></div>"
	return title, textBody, htmlBody
}

// dispatchPublicDnsRenewEmail — envoi asynchrone + trace NotifLog kind
// « dns_renew » SANS secret (pattern dispatchPublicVpnRenewEmail).
func (a *API) dispatchPublicDnsRenewEmail(senderCfg model.NotificationSettings, renewal, target model.PublicDnsOrder) {
	title, textBody, htmlBody := publicDnsRenewEmailBodies(renewal, target)
	cfgCopy := senderCfg
	to := renewal.Email
	logBody := "Confirmation de renouvellement DNS TOURACO " + renewal.Ref + " (cible " + target.Ref + ") envoyée à " + to
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
			Channel: "email", Kind: "dns_renew",
			Title: title, Body: logBody, At: model.NowISO(),
		})
		a.store.Save()
		a.store.Unlock()
	})
}

// ---------------------------------------------------------------------------
// Webhook GeniusPay — branche MCD- (abonnements DNS TOURACO)
// ---------------------------------------------------------------------------

// handleGeniusPayWebhookDnsOrder — payment.success/failed d'une commande DNS
// (appariée par metadata.ref "MCD-…", repli GatewayRef). Appelé par
// handleGeniusPayWebhook APRÈS vérification de signature ; l'anti-replay et
// le parse sont déjà faits. Idempotent : une commande non pending est un
// accusé OK.
func (a *API) handleGeniusPayWebhookDnsOrder(w http.ResponseWriter, event, refMeta, gatewayRef string, amount float64) {
	a.store.Lock()
	order := model.FindPublicDnsOrderByRef(a.store.Data(), strings.TrimSpace(refMeta))
	if order == nil && gatewayRef != "" {
		for i := range a.store.Data().PublicDnsOrders {
			if a.store.Data().PublicDnsOrders[i].GatewayRef != "" &&
				strings.EqualFold(a.store.Data().PublicDnsOrders[i].GatewayRef, gatewayRef) {
				order = &a.store.Data().PublicDnsOrders[i]
				break
			}
		}
	}
	if order == nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusNotFound, "unknown_ref",
			"Aucune commande DNS pour la référence "+refMeta+gatewayRef, nil)
		return
	}
	if order.Status != model.PublicDnsOrderPending {
		a.store.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": order.Ref, "status": order.Status, "idempotent": true})
		return
	}
	orderID, ref := order.ID, order.Ref
	expectedAmt := order.AmountFcfa
	a.store.Unlock()

	if event == "payment.failed" {
		if err := a.cancelPublicDnsOrder(orderID, "Paiement échoué (payment.failed)", "webhook GeniusPay"); err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicDnsOrderCancelled})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicDnsOrderPending})
		return
	}

	if amount > 0 && int(amount) != expectedAmt {
		writeErrCode(w, http.StatusConflict, "amount_mismatch",
			fmt.Sprintf("Montant incohérent : reçu %.0f FCFA, attendu %d FCFA (référence %s)", amount, expectedAmt, ref), nil)
		return
	}
	if a.markPublicDnsOrderPaid(orderID, gatewayRef, "geniuspay", "webhook GeniusPay") {
		if _, err := a.provisionPublicDnsOrder(orderID); err != nil {
			// Provisioning différé : la commande reste « paid » — accusé OK au
			// webhook (GeniusPay relivrerait sinon) ; le balayage horaire
			// rejoue et l'erreur est visible en console.
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicDnsOrderPaid, "deferred": true})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "status": model.PublicDnsOrderProvisioned})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ref": ref, "idempotent": true})
}

// logActivityBestEffortDns — trace d'activité sans contexte de requête HTTP
// (goroutines, replis) : jamais bloquant, jamais en échec (miroir VPN).
func (a *API) logActivityBestEffortDns(ref, message string) {
	defer func() { _ = recover() }()
	a.store.Lock()
	db := a.store.Data()
	a.logActivity(db, model.AccountMainID, "tunnel", "DNS TOURACO "+ref+" : "+message)
	a.store.Save()
	a.store.Unlock()
}

// ---------------------------------------------------------------------------
// POST /api/tunnel/dns/orders/{ref}/renew — renouvellement 1-clic (console
// /dns, JWT tunnel — miroir handleTunnelRenew du canal VPN)
// ---------------------------------------------------------------------------

// handleTunnelDnsRenew — corps {planId, payMethod, phone?, website?} : crée
// la commande de renouvellement (kind renewal, cible = la commande du
// chemin, appariée à l'e-mail du client tunnel) et initie le paiement
// GeniusPay (retour console /dns). Le webhook MCD- convergera vers
// provisionPublicDnsOrder, qui applique l'extension d'échéance.
func (a *API) handleTunnelDnsRenew(w http.ResponseWriter, r *http.Request) {
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
		writeJSON(w, http.StatusOK, map[string]any{"ref": "", "status": model.PublicDnsOrderPending})
		return
	}
	plan := model.ResolvePublicDnsPlan(strings.TrimSpace(req.PlanID))
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
	target := model.FindPublicDnsOrderByRef(db, ref)
	// Anti-énumération : référence inconnue ≡ e-mail divergent → même 404.
	if target == nil || !strings.EqualFold(target.Email, client.Email) {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	if target.Status != model.PublicDnsOrderProvisioned {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "target_not_active",
			"Cet abonnement n'est plus actif — souscrivez-en un nouveau sur la boutique 403Shield (/dns)", nil)
		return
	}
	settings := ensureSettings(db, model.AccountMainID)
	if !(settings.Platform != nil && settings.Platform.PublicDnsShopEnabled()) {
		a.store.Unlock()
		writeErrCode(w, http.StatusForbidden, "shop_disabled",
			"La vente de l'abonnement DNS 403Shield n'est pas ouverte pour le moment", nil)
		return
	}
	if pending := model.PublicDnsOrderPendingForEmail(db, client.Email); pending != nil {
		a.store.Unlock()
		writeErrCode(w, http.StatusConflict, "order_pending_exists",
			"Une commande est déjà en attente pour cet e-mail ("+pending.Ref+") — réglez-la ou attendez son expiration", nil)
		return
	}
	if model.PublicDnsActiveOrders(db) >= model.MaxPublicDnsActiveOrders {
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
	order := model.PublicDnsOrder{
		ID: model.NewID("do-"), Ref: model.NewPublicDnsRef(db),
		Email: client.Email, Phone: digitsOf(phone),
		PlanID: plan.ID, Months: plan.Months,
		BaseAmountFcfa: pr.BaseFcfa, AmountFcfa: amount, PayMethod: payMethod,
		Kind:           model.PublicDnsKindRenewal,
		RenewTargetRef: target.Ref,
		Status:         model.PublicDnsOrderPending,
		CreatedAt:      now, UpdatedAt: now,
	}
	db.PublicDnsOrders = append(db.PublicDnsOrders, order)
	a.logActivity(db, model.AccountMainID, "tunnel",
		"Renouvellement DNS TOURACO créé : "+order.Ref+" (cible "+target.Ref+", "+model.PublicDnsOrderLabel(order)+", "+fmt.Sprintf("%d FCFA", amount)+")")
	a.store.Save()
	a.store.Unlock()

	// ---- Initiation GeniusPay HORS verrou (miroir handlePublicDnsOrderCreate) ----
	paymentURL := ""
	gatewayRef := ""
	if payMethod == "wave" || payMethod == "card" {
		payload := geniusPayCreateReq{
			Amount:        amount,
			PaymentMethod: payMethod,
			Description:   fmt.Sprintf("Renouvellement 403Shield DNS %s (%s) — réf %s", plan.Label, plan.PeriodLabel, order.Ref),
			Customer:      &geniusPayCustomer{Name: buyerNameOf(client.Email), Email: client.Email, Phone: phone},
			Metadata:      map[string]string{"ref": order.Ref, "plan_id": plan.ID},
		}
		// Le renouvellement part de la console /dns : le paiement y revient.
		returnBase := tunnelConsoleReturnURL(r)
		if returnBase == "" {
			returnBase = tunnelPublicBaseURL() + "/dns"
		}
		payload.SuccessURL = returnBase + "?order=" + url.QueryEscape(order.Ref)
		payload.ErrorURL = returnBase + "?order=" + url.QueryEscape(order.Ref)
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
			if o := model.FindPublicDnsOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.PayMethod = "manual"
				o.AmountFcfa = pr.BaseFcfa
				o.ErrorMsg = "initiation paiement en ligne impossible"
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
			a.logActivityBestEffortDns(order.Ref, "bascule canal manual (initiation GeniusPay impossible)")
		} else {
			a.store.Lock()
			if o := model.FindPublicDnsOrderByRef(a.store.Data(), order.Ref); o != nil {
				o.GatewayRef = gatewayRef
				o.UpdatedAt = model.NowISO()
				a.store.Save()
			}
			a.store.Unlock()
		}
	}

	resp := map[string]any{
		"ref":        order.Ref,
		"status":     model.PublicDnsOrderPending,
		"amountFcfa": amount,
		"payMethod":  payMethod,
		"paymentUrl": paymentURL,
		"online":     payMethod == "wave" || payMethod == "card",
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// Console plateforme : registre des commandes DNS (miroir VPN & Vente
// directe — requireRole(3) à l'enregistrement + isPlatformAdmin DOUBLÉE
// dans chaque handler)
// ---------------------------------------------------------------------------

// handlePlatformDnsOrders — la file du canal DNS : pending en tête (le
// travail de la plateforme : confirmer ou annuler le canal manual), puis
// paid/provisioned, puis l'historique (plafonné — discipline des listes).
func (a *API) handlePlatformDnsOrders(w http.ResponseWriter, r *http.Request) {
	if !isPlatformAdmin(r) {
		writeErr(w, http.StatusForbidden, "Réservé aux administrateurs de la plateforme")
		return
	}
	a.store.Lock()
	db := a.store.Data()
	rank := map[string]int{
		model.PublicDnsOrderPending: 0, model.PublicDnsOrderPaid: 1,
		model.PublicDnsOrderProvisioned: 2, model.PublicDnsOrderCancelled: 3,
		model.PublicDnsOrderExpired: 4,
	}
	out := make([]model.PublicDnsOrder, 0, len(db.PublicDnsOrders))
	out = append(out, db.PublicDnsOrders...)
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

// handlePlatformDnsOrderResolve — corps {action: "markPaid" | "cancel"} :
//   - markPaid : encaissement hors ligne confirmé (canal manual) → paid puis
//     provisioning AUTO (même source unique que le webhook) ;
//   - cancel   : annulation — une commande provisionée perd son droit (les
//     quotas retombent au niveau gratuit, RIEN n'est supprimé).
func (a *API) handlePlatformDnsOrderResolve(w http.ResponseWriter, r *http.Request) {
	if !isPlatformAdmin(r) {
		writeErr(w, http.StatusForbidden, "Réservé aux administrateurs de la plateforme")
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
	order := model.FindPublicDnsOrderByID(a.store.Data(), orderID)
	if order == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Commande introuvable")
		return
	}
	snapshot := *order
	a.store.Unlock()

	switch action {
	case "cancel":
		if err := a.cancelPublicDnsOrder(orderID, "annulée par la plateforme", "console plateforme"); err != nil {
			writeErrCode(w, http.StatusBadGateway, "cancel_error",
				"Annulation impossible : "+err.Error(), nil)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Commande annulée" + ternaryStr(snapshot.Status == model.PublicDnsOrderProvisioned, " — droit retiré, les quotas retombent au niveau gratuit (rien n'est supprimé)", ""),
		})
	default: // markPaid
		if snapshot.Status != model.PublicDnsOrderPending {
			writeErr(w, http.StatusConflict, "Commande non en attente (état : "+snapshot.Status+")")
			return
		}
		if !a.markPublicDnsOrderPaid(orderID, "", "manual", "console plateforme") {
			writeErr(w, http.StatusConflict, "Commande déjà traitée entre-temps")
			return
		}
		order, err := a.provisionPublicDnsOrder(orderID)
		if err != nil {
			writeJSON(w, http.StatusAccepted, map[string]any{
				"ok":      true,
				"status":  model.PublicDnsOrderPaid,
				"message": "Encaissement enregistré — provisioning différé : " + boundedString(err.Error(), 160) + " (rejoué automatiquement)",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"status":  order.Status,
			"message": "Commande confirmée et abonnement TOURACO activé jusqu'au " + order.ExpiresAt + " — e-mail envoyé à " + order.Email,
		})
	}
}
