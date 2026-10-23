// publicdnsorder.go — N°347 — commande de l'abonnement DNS « TOURACO »
// (Programme Bouclier DNS, phase 5 : la vitrine /dns + GeniusPay).
//
// PRODUIT : le bouclier DNS TOURACO (résolveur DoH N°339, menaces vivantes
// N°343, serveur DoT N°345, toute-la-maison UDP/53 N°346) est UTILISABLE
// GRATUITEMENT — l'oiseau guetteur africain veille sur tous, l'abonnement
// vend des CAPACITÉS ÉTENDUES, jamais une coupure : la doctrine du
// jalon est ADDITIVE, aucune régression pour les utilisateurs gratuits
// (profils, règles, logements et rétention restent SERVIS — seules les
// CRÉATIONS au-delà des bornes gratuites sont refusées, rien n'est jamais
// supprimé ni bloqué à l'expiration : le droit cesse, les quotas
// retombent, les profils restent).
//
//   - GRATUIT (INTACT, constantes dnsprofile.go/dnshomebinding.go) :
//     10 profils · 200 règles par liste · 5 logements · journal 30 j ;
//   - TOURACO actif (droit porté par l'E-MAIL, miroir de l'identité
//     propriétaire des profils DnsProfile.OwnerEmail) :
//     25 profils · 600 règles par liste · 15 logements · journal 90 j.
//
// LE CANAL (miroir strict de la vente directe VPN B2C N°301) : la vitrine
// publique 403Shield (/dns) vend SANS COMPTE — l'acheteur donne son
// e-mail, paie par GeniusPay (Wave/carte, préfixe MCD- pour le routage du
// webhook : MCV- = VPN, MC- = abonnements SaaS), le droit s'active
// automatiquement (AUCUN réseau à provisionner : l'entitlement EST
// l'échéance, la plus lointaine des commandes provisionnées de l'e-mail).
// Le renouvellement 1-clic vit dans la console /dns (JWT tunnel).
//
// Cycle de vie (machine à états linéaire, jamais de retour arrière) :
//
//	pending     — commande créée (vitrine ou console), paiement non
//	              confirmé ;
//	paid        — paiement confirmé (webhook GeniusPay signé, poll de
//	              retour, ou confirmation manuelle de la plateforme) ;
//	provisioned — droit actif, ExpiresAt posé (paid + Months) ;
//	cancelled   — paiement échoué / annulation admin / stale (>48 h) ;
//	expired     — terme atteint : le balayage horaire marque la ligne,
//	              l'entitlement disparaît, les quotas retombent au
//	              niveau gratuit (les profils/logements restent).
//
// Aucun secret dans cette table (miroir public_vpn_orders : métadonnées
// de facturation uniquement). Garde-fous : une seule commande pending par
// e-mail, plafond d'ordres actifs, quota IP sur les POST publics,
// honeypot sur le formulaire.
package model

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// Statuts du cycle de vie (cf. en-tête) — mêmes libellés que le canal VPN
// (une seule machine à états lue par la console plateforme).
const (
	PublicDnsOrderPending     = "pending"
	PublicDnsOrderPaid        = "paid"
	PublicDnsOrderProvisioned = "provisioned"
	PublicDnsOrderCancelled   = "cancelled"
	PublicDnsOrderExpired     = "expired"
)

// Genres de commande : « sale » = achat classique (nouveau droit posé) ;
// « renewal » = renouvellement d'une commande EXISTANTE (l'échéance étendue
// vit sur la CIBLE, seule vérité — la ligne renewal reste une transaction
// de facturation). Une renewal dont la cible est morte au paiement
// (expirée entre-temps) dégénère honnêtement en vente.
const (
	PublicDnsKindSale    = "sale"
	PublicDnsKindRenewal = "renewal"
)

// PublicDnsOrder — ligne du registre des commandes DNS (table
// « public_dns_orders », 48e table différentielle). Les montants suivent la
// discipline FCFA int du repo : BaseAmountFcfa = net catalogue,
// AmountFcfa = montant EFFECTIVEMENT débité (frais du moyen compris).
type PublicDnsOrder struct {
	ID string `json:"id"`
	// Ref — référence PUBLIQUE (MCD-XXXXXXXX) : servie à l'acheteur,
	// attendue dans le webhook GeniusPay (metadata.ref) et demandée pour la
	// récupération self-service de l'e-mail d'activation.
	Ref string `json:"ref"`
	// Email — adresse de facturation ET porteuse du droit : c'est l'e-mail
	// du compte console tunnel (l'identité propriétaire des profils DNS —
	// doctrine N°339 : l'e-mail EST l'identité).
	Email string `json:"email"`
	// Phone — téléphone de paiement (Wave exige un numéro), chiffres E.164
	// sans « + ». Vide pour carte.
	Phone string `json:"phone"`
	// PlanID / Months — formule achetée (PublicDnsPlans) et durée couverte.
	PlanID string `json:"planId"`
	Months int    `json:"months"`
	// BaseAmountFcfa — net catalogue de la formule (avant frais de moyen).
	BaseAmountFcfa int `json:"baseAmountFcfa"`
	// AmountFcfa — montant débité (gross-up carte / remise Wave / net manual).
	AmountFcfa int `json:"amountFcfa"`
	// PayMethod — "wave" | "card" | "manual" (hors ligne, confirmation admin).
	PayMethod string `json:"payMethod"`
	// Kind — "sale" (défaut) | "renewal" : une renewal étend la commande
	// visée par RenewTargetRef à la confirmation du paiement.
	Kind string `json:"kind,omitempty"`
	// RenewTargetRef — référence PUBLIQUE de la commande renouvelée (l'échéance
	// étendue vit sur la CIBLE ; la ligne renewal reste une facturation).
	RenewTargetRef string `json:"renewTargetRef,omitempty"`
	// PaidVia — "geniuspay" | "manual" (traçabilité de l'encaissement).
	PaidVia string `json:"paidVia,omitempty"`
	// GatewayRef — référence marchande GeniusPay (appariement webhook,
	// re-check au poll de retour). Vide pour le canal manual.
	GatewayRef string `json:"gatewayRef"`
	// Status — machine à états (constantes PublicDnsOrder*).
	Status string `json:"status"`
	// ExpiresAt — terme du droit (paid + Months) : RFC3339, vide avant
	// provisioning. L'entitlement actif d'un e-mail est la PLUS LOINTAINE
	// des échéances provisionnées non échues — plusieurs commandes se
	// cumulent proprement (miroir ExtendPublicVpnExpiry du côté VPN).
	ExpiresAt string `json:"expiresAt"`
	// ErrorMsg — dernier échec de provisioning. Une commande « paid » avec
	// ErrorMsg est REJOUÉE par le balayage — jamais définitivement perdue.
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
// Catalogue des formules (constantes v1 — même doctrine que PublicVpnPlans)
// ---------------------------------------------------------------------------

// PublicDnsPlan — une formule de l'abonnement DNS (net catalogue, FCFA int).
type PublicDnsPlan struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	PeriodLabel string `json:"periodLabel"`
	Months      int    `json:"months"`
	// BaseFcfa — net cible plateforme (prix catalogue).
	BaseFcfa int `json:"baseFcfa"`
}

// IDs de formules (stables — persistés sur les commandes).
const (
	PublicDnsPlanMonthID = "dns-month"
	PublicDnsPlanYearID  = "dns-year"
)

// PublicDnsPlans — catalogue de la vitrine /dns : TOURACO mensuel et annuel.
// Le bouclier DNS est un produit LÉGER à opérer (pas de bande passante
// tunnelnée — le filtrage résout, le trafic ne passe pas par la VM) : le prix
// s'aligne sous le VPN B2C (1 500/15 000 F — N°301), même discipline annuelle
// (~2 mois offerts). Le SERVICE porte le nom de l'oiseau : TOURACO, le
// guetteur africain aux ailes écarlates (décision de l'exploitant — il
// remplace le nom de code BAOBAB : l'oiseau veille, l'abonnement étend).
var PublicDnsPlans = []PublicDnsPlan{
	{ID: PublicDnsPlanMonthID, Label: "TOURACO Mensuel", PeriodLabel: "1 mois", Months: 1, BaseFcfa: 1000},
	{ID: PublicDnsPlanYearID, Label: "TOURACO Annuel", PeriodLabel: "12 mois", Months: 12, BaseFcfa: 10000},
}

// ResolvePublicDnsPlan — formule par ID (nil si inconnue).
func ResolvePublicDnsPlan(id string) *PublicDnsPlan {
	for i := range PublicDnsPlans {
		if PublicDnsPlans[i].ID == id {
			return &PublicDnsPlans[i]
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Bornes et garde-fous
// ---------------------------------------------------------------------------

// MaxPublicDnsActiveOrders — plafond d'ordres DNS ACTIFS à la fois (pending +
// paid + provisioned) : borne produit honnête v1 — il n'y a AUCUNE ressource
// physique derrière (contrairement au pool wg0 du VPN), la borne protège le
// registre des commandes orphelines.
const MaxPublicDnsActiveOrders = 500

// PublicDnsStaleAfter — une commande pending non réglée depuis ce délai est
// annulée par le balayage (les liens GeniusPay expirent de toute façon sous
// 24 h).
const PublicDnsStaleAfter = 48 * time.Hour

// ---------------------------------------------------------------------------
// Quotas par entitlement — le cœur du jalon : la base gratuite est INTACTE
// (constantes dnsprofile.go/dnshomebinding.go inchangées), l'abonné actif
// voit ses bornes de CRÉATION relevées (rien n'est jamais supprimé à
// l'expiration : les profils/logements restent servis, seule la création
// au-delà des bornes gratuites redevient refusée).
// ---------------------------------------------------------------------------

// DnsQuotas — bornes effectives d'un e-mail (résolues sous verrou).
type DnsQuotas struct {
	MaxProfiles     int // profils DNS par e-mail
	MaxRules        int // règles par liste (bloquer ET autoriser)
	MaxHomeBindings int // logements « toute la maison »
	RetentionDays   int // rétention du journal de blocage
	MaxEvents       int // borne d'événements par profil
}

// DnsQuotasFree — le tier gratuit, TEL QUE LIVRÉ N°339→346 (les constantes
// historiques restent la source unique — ce struct ne fait que les regrouper
// pour la résolution par e-mail ; aucune valeur dupliquée à la main).
var DnsQuotasFree = DnsQuotas{
	MaxProfiles:     MaxDnsProfilesPerEmail,
	MaxRules:        MaxDnsRulesPerList,
	MaxHomeBindings: MaxDnsHomeBindingsPerEmail,
	RetentionDays:   DnsEventRetentionDays,
	MaxEvents:       MaxDnsEventsPerProfile,
}

// DnsQuotasTouraco — les capacités de l'abonnement TOURACO : la famille
// nombreuse (25 profils), les listes sérieuses (600 règles), les logements
// multiples (15 maisons : domicile + bureau + maison de famille), l'historique
// long (90 jours de journal).
var DnsQuotasTouraco = DnsQuotas{
	MaxProfiles:     25,
	MaxRules:        600,
	MaxHomeBindings: 15,
	RetentionDays:   90,
	MaxEvents:       3000,
}

// DnsSubscriptionOfEmail — l'entitlement EFFECTIF d'un e-mail : la plus
// lointaine échéance parmi ses commandes provisionnées non échues (retour :
// l'échéance ISO, active=true si au moins un droit couvre maintenant). Une
// commande provisionnée sans ExpiresAt est un droit sans terme connu —
// traité ACTIF (miroir du balayage : jamais de coupure par défaut).
func DnsSubscriptionOfEmail(db *DB, email string) (expiresAt string, active bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", false
	}
	now := NowISO()
	for i := range db.PublicDnsOrders {
		o := &db.PublicDnsOrders[i]
		if !strings.EqualFold(o.Email, email) || o.Status != PublicDnsOrderProvisioned {
			continue
		}
		if o.ExpiresAt != "" && o.ExpiresAt < now {
			continue // échue : le balayage la marquera « expired »
		}
		active = true
		if o.ExpiresAt > expiresAt {
			expiresAt = o.ExpiresAt
		}
	}
	return expiresAt, active
}

// DnsQuotasForEmail — bornes effectives de CRÉATION d'un e-mail : TOURACO
// actif → capacités étendues ; sinon → tier gratuit intact. La résolution
// se fait sous le verrou du store par les handlers console (une requête,
// aucun cache à invalider).
func DnsQuotasForEmail(db *DB, email string) DnsQuotas {
	if _, active := DnsSubscriptionOfEmail(db, email); active {
		return DnsQuotasTouraco
	}
	return DnsQuotasFree
}

// DnsActiveSubscribers — le set des e-mails abonnés actifs (utilisé par la
// purge du journal : la rétention étendue est calculée PAR PROPRIÉTAIRE, pas
// par plateforme — un ex-abonné retombe à 30 jours dès la seconde suivante).
func DnsActiveSubscribers(db *DB) map[string]bool {
	out := map[string]bool{}
	now := NowISO()
	for i := range db.PublicDnsOrders {
		o := &db.PublicDnsOrders[i]
		if o.Status != PublicDnsOrderProvisioned {
			continue
		}
		if o.ExpiresAt != "" && o.ExpiresAt < now {
			continue
		}
		out[strings.ToLower(o.Email)] = true
	}
	return out
}

// ---------------------------------------------------------------------------
// Finders (discipline Scoped du repo — l'appariement public ref+e-mail se
// vérifie à CHAQUE résolution)
// ---------------------------------------------------------------------------

// FindPublicDnsOrderByRef — commande par référence exacte (nil si absente).
func FindPublicDnsOrderByRef(db *DB, ref string) *PublicDnsOrder {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return nil
	}
	for i := range db.PublicDnsOrders {
		if db.PublicDnsOrders[i].Ref == ref {
			return &db.PublicDnsOrders[i]
		}
	}
	return nil
}

// FindPublicDnsOrderByID — commande par ID interne (nil si absente).
func FindPublicDnsOrderByID(db *DB, id string) *PublicDnsOrder {
	if id == "" {
		return nil
	}
	for i := range db.PublicDnsOrders {
		if db.PublicDnsOrders[i].ID == id {
			return &db.PublicDnsOrders[i]
		}
	}
	return nil
}

// PublicDnsOrderPendingForEmail — existe-t-il une commande PENDING pour cet
// e-mail ? (une seule commande en attente par acheteur — miroir VPN).
func PublicDnsOrderPendingForEmail(db *DB, email string) *PublicDnsOrder {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil
	}
	for i := range db.PublicDnsOrders {
		o := &db.PublicDnsOrders[i]
		if strings.EqualFold(o.Email, email) && o.Status == PublicDnsOrderPending {
			return o
		}
	}
	return nil
}

// PublicDnsActiveOrders — jauge des commandes actives (pending+paid+
// provisioned) contre MaxPublicDnsActiveOrders.
func PublicDnsActiveOrders(db *DB) int {
	n := 0
	for i := range db.PublicDnsOrders {
		switch db.PublicDnsOrders[i].Status {
		case PublicDnsOrderPending, PublicDnsOrderPaid, PublicDnsOrderProvisioned:
			n++
		}
	}
	return n
}

// ---------------------------------------------------------------------------
// Référence publique (MCD-XXXXXXXX — préfixe distinct pour le routage du
// webhook GeniusPay : MC- = SaaS, MCV- = VPN B2C, MCD- = abonnement DNS)
// ---------------------------------------------------------------------------

// NewPublicDnsRef — référence publique d'une commande (4 octets aléatoires,
// unicité vérifiée par l'appelant contre le registre).
func NewPublicDnsRef(db *DB) string {
	for {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			return "MCD-" + fmt.Sprintf("%08X", time.Now().UnixNano()&0xFFFFFFFF)
		}
		ref := "MCD-" + strings.ToUpper(hex.EncodeToString(b))
		if FindPublicDnsOrderByRef(db, ref) == nil {
			return ref
		}
	}
}

// PublicDnsOrderLabel — libellé d'affichage console : formule + e-mail.
func PublicDnsOrderLabel(o PublicDnsOrder) string {
	plan := ResolvePublicDnsPlan(o.PlanID)
	if plan != nil {
		return plan.Label + " — " + o.Email
	}
	return o.Email
}

// ExtendPublicDnsExpiry — nouvelle échéance d'un renouvellement : mois
// calendaires AJOUTÉS au plus lointain de (échéance courante, maintenant) —
// un abonné qui renouvelle AVANT le terme ne perd jamais les jours restants
// (sémantique partagée avec ExtendPublicVpnExpiry, le nom du canal VPN est
// historique — la fonction délègue).
func ExtendPublicDnsExpiry(currentExpiry, nowISO string, months int) string {
	return ExtendPublicVpnExpiry(currentExpiry, nowISO, months)
}
