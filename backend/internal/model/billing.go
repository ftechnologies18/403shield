// Requêtes de facturation et souscriptions GeniusPay.
// Extrait du monolithe models.go (N°88) — même package, contenu inchangé.
package model

// BillingRequest — demande de souscription / renouvellement d'abonnement
// créée par un compte client (verrou du cycle de facturation, POST
// /api/subscription). Complète le journal (type billing) par une FILE
// actionnable dans la console plateforme : chaque demande porte un statut,
// une référence de paiement (appariement webhook Wave) et sa résolution.
type BillingRequest struct {
	ID         string `json:"id"`
	AccountID  string `json:"accountId"`
	PlanID     string `json:"planId"`     // essentiel | illimite
	PlanName   string `json:"planName"`   // libellé figé à la demande
	AmountFcfa int    `json:"amountFcfa"` // montant attendu (moyen actif — wave par défaut)
	// BaseAmountFcfa — net cible de la PLATEFORME (prix catalogue, hors frais
	// de paiement). Les montants débités (Wave / carte) en sont dérivés par
	// répercussion des frais GeniusPay (handlers_pricing.go). 0 = demande
	// antérieure à la répercussion (montant = net historique).
	BaseAmountFcfa int `json:"baseAmountFcfa,omitempty"`
	// PayMethod — moyen de paiement ACTIF de la demande : "wave" (défaut,
	// remise mobile money) ou "card" (prix de liste). Basculé à chaque
	// initiation ; le webhook fixe le moyen effectivement payé.
	PayMethod   string `json:"payMethod,omitempty"`
	PeriodLabel string `json:"periodLabel"` // « 1 mois » | « N mois » (N°350) | « 1 an »
	RouterCount int    `json:"routerCount"` // assiette au moment de la demande
	// Months — durée SOUSCRITE en mois de plateforme (N°350 : le client
	// choisit sa durée sur la formule mensuelle ; N°351 — elle s'applique
	// aux DEUX moyens : paiement Wave ponctuel OU carte ponctuelle au prix
	// de liste ; la récurrence carte reste au cycle d'1 mois).
	// L'activation (webhook/file/fiche) empile exactement cette durée.
	// 0 = demande antérieure à N°350 ou posée par la plateforme : 1
	// période du plan (12 mois si formule annuelle).
	Months int `json:"months,omitempty"`
	// Ref — référence de paiement publique (MC-XXXXXXXX), renvoyée au client
	// et attendue dans le webhook Wave pour l'appariement automatique.
	Ref string `json:"ref"`
	// GatewayRef — référence de la transaction GeniusPay (MTX-…), remplie
	// quand le client a initié le paiement Wave en ligne (POST
	// /api/subscription/pay). Repli d'appariement du webhook GeniusPay.
	GatewayRef string `json:"gatewayRef,omitempty"`
	Status     string `json:"status"` // pending | done | cancelled
	CreatedAt  string `json:"createdAt"`
	ResolvedAt string `json:"resolvedAt,omitempty"`
	// ResolvedBy — nom de l'admin plateforme ou « webhook Wave ».
	ResolvedBy string `json:"resolvedBy,omitempty"`
	Note       string `json:"note,omitempty"`
	// PaidVia — manual (fiche/file plateforme) | wave (webhook) ; vide sur
	// les demandes annulées.
	PaidVia string `json:"paidVia,omitempty"`
}

// GeniusPaySub — abonnement RÉCURRENT par carte bancaire (Stripe via
// GeniusPay). Créé une fois par le client (POST /api/subscription/stripe),
// débité automatiquement à chaque échéance par Stripe ; chaque facture payée
// (webhook subscription.payment_succeeded, ou resynchronisation au retour du
// client) active/empile la période 403Shield correspondante — la source unique
// du calcul de période reste applySubscriptionLocked.

// GeniusPaySub — abonnement RÉCURRENT par carte bancaire (Stripe via
// GeniusPay). Créé une fois par le client (POST /api/subscription/stripe),
// débité automatiquement à chaque échéance par Stripe ; chaque facture payée
// (webhook subscription.payment_succeeded, ou resynchronisation au retour du
// client) active/empile la période 403Shield correspondante — la source unique
// du calcul de période reste applySubscriptionLocked.
type GeniusPaySub struct {
	// UUID — identifiant GeniusPay (sub_…), clé primaire locale.
	UUID      string `json:"uuid"`
	AccountID string `json:"accountId"`
	PlanID    string `json:"planId"`   // essentiel | illimite
	PlanName  string `json:"planName"` // libellé figé à la création
	Cycle     string `json:"cycle"`    // monthly | yearly
	// AmountFcfa — montant FIXE débité par cycle (assiette figée à la création :
	// Essentiel = 1 250 F × routeurs, Illimité = 12 000 F). Slots — routeurs
	// couverts (essentiel). Status — pending|trialing|active|past_due|paused|
	// cancelled|expired.
	AmountFcfa    int    `json:"amountFcfa"`
	Slots         int    `json:"slots"`
	Status        string `json:"status"`
	CustomerName  string `json:"customerName,omitempty"`
	CustomerEmail string `json:"customerEmail,omitempty"`
	Phone         string `json:"phone,omitempty"`
	NextBilling   string `json:"nextBilling,omitempty"` // prochaine échéance (AAAA-MM-JJ)
	// LastInvoiceAt — paid_at de la DERNIÈRE facture APPLIQUÉE (idempotence du
	// webhook et des resynchronisations).
	LastInvoiceAt string `json:"lastInvoiceAt,omitempty"`
	LastRenewalAt string `json:"lastRenewalAt,omitempty"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt,omitempty"`
	CancelledAt   string `json:"cancelledAt,omitempty"`
}

// Kinds de commandes agent (routeur -> cloud en HTTP-poll).
