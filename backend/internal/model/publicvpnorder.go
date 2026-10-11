// PublicVpnOrder — N°301 — commande VPN WireGuard B2C « vente directe
// plateforme » : la vitrine publique MikCloud (/vpn, hors zone des gérants —
// doctrine « jamais en concurrence avec ses revendeurs ») vend un accès
// fulltunnel au client final SANS compte SaaS, le provisioning est AUTOMATIQUE
// (peer wg0 posé par wg-mini au nom du compte principal, refacturé à nul
// gérant) et la re-livraison de la conf est SELF-SERVICE (e-mail + référence).
//
// Chantier ⑧ de la console plateforme (vue « VPN & Vente directe ») :
//   - le grossiste (admin plateforme) voit TOUTES les commandes B2C, confirme
//     manuellement celles du canal « manual » (paiement hors ligne) et peut
//     annuler/révoquer ;
//   - l'encaissement en ligne réutilise GeniusPay (Wave / carte — mêmes clés,
//     même appariement metadata.ref, préfixe MCV- pour distinguer des demandes
//     d'abonnement MC-) ;
//   - le peer lié vit dans le registre vpn_peers EXISTANT avec
//     AccountID = model.AccountMainID : pool wg0 global, conf chiffrée au
//     repos (D5-a inchangée), révocation wg-peer.sh remove à chaud.
//
// Cycle de vie (machine à états linéaire, jamais de retour arrière) :
//   pending   — commande créée (vitrine), paiement non confirmé ;
//   paid      — paiement confirmé (webhook GeniusPay signé, poll de retour,
//               ou confirmation manuelle de la plateforme) ;
//   provisioned — peer posé sur wg0 + conf livrée par e-mail + ExpiresAt posé ;
//   cancelled — paiement échoué / annulation admin / commande stale (>48 h) ;
//   expired   — terme atteint : le balayage horaire révoque le peer (le
//               client n'a plus d'accès, la ligne d'historique reste).
//
// La conf ELLE-MÊME ne vit jamais ici : elle reste sur le VpnPeer lié
// (PeerID) — coffre unique, discipline D5-a (json:"-" + secretbox côté
// store). La commande ne porte que des métadonnées de facturation.
//
// Garde-fous : une seule commande pending PAR E-MAIL (le buyer qui répète
// reçoit un 409 clair), plafond d'ordres ACTIFS à la fois (constante honnête
// v1 — le pool wg0 reste la vraie borne), quota IP sur les trois POST
// publics (création / récupération), honeypot sur le formulaire.
package model

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// Statuts du cycle de vie (cf. en-tête).
const (
	PublicVpnOrderPending     = "pending"
	PublicVpnOrderPaid        = "paid"
	PublicVpnOrderProvisioned = "provisioned"
	PublicVpnOrderCancelled   = "cancelled"
	PublicVpnOrderExpired     = "expired"
)

// PublicVpnOrder — ligne du registre des commandes B2C (table
// « public_vpn_orders »). Les montants suivent la discipline FCFA int du
// repo (handlers_pricing.go) : BaseAmountFcfa = net catalogue,
// AmountFcfa = montant EFFECTIVEMENT débité (frais du moyen compris).
type PublicVpnOrder struct {
	ID string `json:"id"`
	// Ref — référence PUBLIQUE (MCV-XXXXXXXX) : servie à l'acheteur, attendue
	// dans le webhook GeniusPay (metadata.ref) et demandée pour la
	// récupération self-service de la conf.
	Ref string `json:"ref"`
	// Email — adresse de facturation ET de livraison de la conf. La
	// configuration n'est JAMAIS servie par l'API publique : elle part par
	// e-mail (ou reveal console) uniquement.
	Email string `json:"email"`
	// Phone — téléphone de paiement (Wave exige un numéro à débiter),
	// chiffres E.164 sans « + » (discipline Account.Phone). Vide pour carte.
	Phone string `json:"phone"`
	// PlanID / Months — formule achetée (PublicVpnPlans) et durée couverte.
	PlanID string `json:"planId"`
	Months int    `json:"months"`
	// BaseAmountFcfa — net catalogue de la formule (avant frais de moyen).
	BaseAmountFcfa int `json:"baseAmountFcfa"`
	// AmountFcfa — montant débité (gross-up carte / remise Wave / net manual).
	AmountFcfa int `json:"amountFcfa"`
	// PayMethod — "wave" | "card" | "manual" (hors ligne, confirmation admin).
	PayMethod string `json:"payMethod"`
	// PaidVia — "geniuspay" | "manual" (traçabilité de l'encaissement).
	PaidVia string `json:"paidVia,omitempty"`
	// GatewayRef — référence marchande GeniusPay (appariement webhook,
	// re-check au poll de retour). Vide pour le canal manual.
	GatewayRef string `json:"gatewayRef"`
	// Status — machine à états (constantes PublicVpnOrder*).
	Status string `json:"status"`
	// PeerID / PeerName — peer wg0 lié (posé au provisioning au nom du compte
	// principal). PeerID vide tant que Status < paid.
	PeerID   string `json:"peerId"`
	PeerName string `json:"peerName"`
	// ExpiresAt — terme de l'accès (paid + Months) : le balayage horaire
	// révoque le peer passé cette date. RFC3339, vide avant provisioning.
	ExpiresAt string `json:"expiresAt"`
	// ErrorMsg — dernier échec de provisioning (wg-mini injoignable, pool
	// épuisé…). Une commande « paid » avec ErrorMsg est REJOUÉE par le
	// balayage — jamais définitivement perdue.
	ErrorMsg string `json:"errorMsg,omitempty"`
	// ResolvedBy — acteur de la confirmation/annulation manuelle (pseudo
	// admin) ou libellé du canal automatique (webhook/poll).
	ResolvedBy string `json:"resolvedBy,omitempty"`
	// CreatedAt / UpdatedAt / PaidAt — RFC3339 (model.NowISO).
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	PaidAt    string `json:"paidAt,omitempty"`
}

// ---------------------------------------------------------------------------
// Catalogue des formules B2C (constantes v1 — même doctrine que SaasPlans
// avant l'éditeur de formules ; prix par compte principal ajustable ensuite)
// ---------------------------------------------------------------------------

// PublicVpnPlan — une formule de la vitrine (net catalogue, FCFA int).
type PublicVpnPlan struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	PeriodLabel string `json:"periodLabel"`
	Months      int    `json:"months"`
	// BaseFcfa — net cible plateforme (prix catalogue).
	BaseFcfa int `json:"baseFcfa"`
}

// IDs de formules (stables — persistés sur les commandes).
const (
	PublicVpnPlanMonthID = "vpn-b2c-month"
	PublicVpnPlanYearID  = "vpn-b2c-year"
)

// PublicVpnPlans — catalogue de la vitrine : VPN mensuel et annuel
// (fulltunnel, sortie par la VM — IP fixe FR). Le prix annuel offre ~2 mois
// offerts par rapport au mensuel (discipline SaasPlans).
var PublicVpnPlans = []PublicVpnPlan{
	{ID: PublicVpnPlanMonthID, Label: "MikCloud VPN Mensuel", PeriodLabel: "1 mois", Months: 1, BaseFcfa: 1500},
	{ID: PublicVpnPlanYearID, Label: "MikCloud VPN Annuel", PeriodLabel: "12 mois", Months: 12, BaseFcfa: 15000},
}

// ResolvePublicVpnPlan — formule par ID (nil si inconnue).
func ResolvePublicVpnPlan(id string) *PublicVpnPlan {
	for i := range PublicVpnPlans {
		if PublicVpnPlans[i].ID == id {
			return &PublicVpnPlans[i]
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Bornes et garde-fous
// ---------------------------------------------------------------------------

// MaxPublicVpnActiveOrders — plafond d'ordres B2C ACTIFS à la fois
// (pending + paid + provisioned) : borne produit honnête v1, bien sous le
// pool wg0 (253) — le grossiste révogue/expire pour libérer.
const MaxPublicVpnActiveOrders = 200

// PublicVpnStaleAfter — une commande pending non réglée depuis ce délai est
// annulée par le balayage (nettoyage du registre, liens GeniusPay expirés
// de toute façon sous 24 h).
const PublicVpnStaleAfter = 48 * time.Hour

// ---------------------------------------------------------------------------
// Finders (discipline Scoped du repo — l'appariement public ref+e-mail se
// vérifie à CHAQUE résolution)
// ---------------------------------------------------------------------------

// FindPublicVpnOrderByRef — commande par référence exacte (nil si absente).
func FindPublicVpnOrderByRef(db *DB, ref string) *PublicVpnOrder {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return nil
	}
	for i := range db.PublicVpnOrders {
		if db.PublicVpnOrders[i].Ref == ref {
			return &db.PublicVpnOrders[i]
		}
	}
	return nil
}

// FindPublicVpnOrderByID — commande par ID interne (nil si absente).
func FindPublicVpnOrderByID(db *DB, id string) *PublicVpnOrder {
	if id == "" {
		return nil
	}
	for i := range db.PublicVpnOrders {
		if db.PublicVpnOrders[i].ID == id {
			return &db.PublicVpnOrders[i]
		}
	}
	return nil
}

// PublicVpnOrderPendingForEmail — existe-t-il une commande PENDING pour cet
// e-mail ? (une seule commande en attente par acheteur — le refus est clair,
// pas une réutilisation sournoise d'une ref expirée).
func PublicVpnOrderPendingForEmail(db *DB, email string) *PublicVpnOrder {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil
	}
	for i := range db.PublicVpnOrders {
		o := &db.PublicVpnOrders[i]
		if strings.EqualFold(o.Email, email) && o.Status == PublicVpnOrderPending {
			return o
		}
	}
	return nil
}

// PublicVpnActiveOrders — jauge des commandes actives (pending+paid+
// provisioned) contre MaxPublicVpnActiveOrders.
func PublicVpnActiveOrders(db *DB) int {
	n := 0
	for i := range db.PublicVpnOrders {
		switch db.PublicVpnOrders[i].Status {
		case PublicVpnOrderPending, PublicVpnOrderPaid, PublicVpnOrderProvisioned:
			n++
		}
	}
	return n
}

// ---------------------------------------------------------------------------
// Référence publique (MCV-XXXXXXXX — même alphabet que MC-, préfixe distinct
// pour le routage du webhook GeniusPay)
// ---------------------------------------------------------------------------

// NewPublicVpnRef — référence publique d'une commande (4 octets aléatoires,
// unicité vérifiée par l'appelant contre le registre).
func NewPublicVpnRef(db *DB) string {
	for {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			return "MCV-" + fmt.Sprintf("%08X", time.Now().UnixNano()&0xFFFFFFFF)
		}
		ref := "MCV-" + strings.ToUpper(hex.EncodeToString(b))
		if FindPublicVpnOrderByRef(db, ref) == nil {
			return ref
		}
	}
}

// PublicVpnRefTaken — la référence est-elle déjà portée ? (verrou
// d'unicité à l'insertion, miroir newPayRef).
func PublicVpnRefTaken(db *DB, ref string) bool {
	return FindPublicVpnOrderByRef(db, ref) != nil
}

// ---------------------------------------------------------------------------
// Outillage temps (RFC3339 discipline NowISO)
// ---------------------------------------------------------------------------

// AddMonthsISO — date RFC3339 + n mois calendaires (UTC). Repli « maintenant »
// sur date illisible (défensif — jamais de panic sur une donnée de base).
func AddMonthsISO(startISO string, months int) string {
	t, err := time.Parse(time.RFC3339, startISO)
	if err != nil {
		t = time.Now().UTC()
	}
	return t.AddDate(0, months, 0).UTC().Format(time.RFC3339)
}

// PublicVpnOrderLabel — libellé d'affichage console : formule + e-mail.
func PublicVpnOrderLabel(o PublicVpnOrder) string {
	plan := ResolvePublicVpnPlan(o.PlanID)
	if plan != nil {
		return plan.Label + " — " + o.Email
	}
	return o.Email
}
