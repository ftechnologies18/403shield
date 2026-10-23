// dnshomebinding.go — N°346 — LIAISONS « TOUTE LA MAISON » DU BOUCLIER DNS
// (Programme Bouclier DNS, phase 4 : le résolveur UDP/53).
//
// PRODUIT : après l'appareil (DoH N°339) et le téléphone (DoT N°345), la
// MAISON entière — box FAI, Starlink, routeur perso. L'utilisateur pointe
// les serveurs DNS de sa box vers le résolveur 403Shield : chaque requête
// DNS du logement (TV, consoles, objets connectés, invités — sans rien
// installer) arrive depuis l'IP PUBLIQUE de la maison. La LIAISON
// (binding) est cette IP publique → un profil de filtrage :
//
//	IP 41.207.x.x  →  profil « Famille » (dp-…)  →  toute la maison filtrée
//
// POURQUOI L'IP ET PAS UN IDENTIFIANT : le DNS classique (UDP/53, RFC
// 1035) n'a AUCUN champ pour porter un identifiant de profil — ni SNI
// (DoT) ni URL (DoH). La seule information d'acheminement disponible est
// l'IP SOURCE. La liaison est revendiquée depuis la console (le client
// navigue DEPUIS chez lui : l'IP de sa requête HTTP EST l'IP de sa box)
// ou révélée par la SONDE (probe-<token> — une commande à lancer sur un
// appareil du logement, qui fait aussi la détection du détournement du
// port 53 par certains FAI).
//
// ANTI-RÉSOLVEUR-OUVERT (la discipline de ce jalon) : une IP sans liaison
// reçoit REFUSED — le serveur n'est JAMAIS un amplificateur DNS public
// (jamais de résolution pour des tiers, jamais d'open resolver). Le quota
// par e-mail borne la table ; l'IP est UNIQUE (une maison = une liaison).
//
// CGNAT (honnêteté documentée) : certains FAI partagent une IP publique
// entre foyers. La liaison reste fonctionnelle (le filtrage est celui du
// profil lié) mais deux foyers derrière la même IP partagent le même
// filtrage — la console le dit tel quel, aucune promesse mensongère.
//
// AUCUN secret dans cette table : l'IP publique d'un logement n'est pas
// un secret de chiffrement, c'est une adresse d'acheminement — comme le
// PublicID des profils (dnsprofile.go, même doctrine).
package model

import (
	"net"
	"strings"
)

// Limites produit du jalon maison (défense en profondeur : le handler
// valide, le modèle re-valide).
const (
	// MaxDnsHomeBindingsPerEmail — maison + bureau + résidence
	// secondaire : un foyer n'a pas dix lignes.
	MaxDnsHomeBindingsPerEmail = 5
	// MaxDnsHomeLabelLength — nom lisible borné (« Maison », « Bureau »).
	MaxDnsHomeLabelLength = 60
)

// DnsHomeBinding — une liaison IP publique de logement → profil DNS.
type DnsHomeBinding struct {
	ID string `json:"id"`
	// ProfileID — profil filtrant servi aux requêtes de cette IP.
	ProfileID string `json:"profileId"`
	// OwnerEmail — e-mail du client console tunnel (dénormalisé : la
	// liste et le contrôle de propriété ne rejoignent pas le registre
	// des profils — même frontière que DnsProfile.OwnerEmail).
	OwnerEmail string `json:"ownerEmail"`
	// IP — l'adresse publique du logement (forme canonique net.IP.String(),
	// v4 ou v6 — unique dans la table).
	IP string `json:"ip"`
	// Label — nom lisible choisi par le client (« Maison », « Boutique »).
	Label string `json:"label"`
	// LastQueryAt — dernière requête DNS reçue de cette IP (RFC3339).
	// Mis à jour par le serveur UDP/53 via un flush différé (≤ 60 s de
	// granularité — jamais une écriture par requête) : l'indicateur de
	// santé « votre maison est bien protégée » de la console.
	LastQueryAt string `json:"lastQueryAt"`
	// QueryCount — compteur APPROXIMATIF de requêtes servies (incrémenté
	// par le même flush différé — un ordre de grandeur honnête, pas une
	// comptabilité exacte).
	QueryCount int `json:"queryCount"`
	// CreatedAt / UpdatedAt — RFC3339 (NowISO).
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// NormalizeDnsHomeIP — valide et canonise l'IP d'un logement : net.ParseIP
// puis forme canonique (dédup les écritures v4-en-v6). REFUSE les plages
// qui ne sont JAMAIS une IP publique de logement (boucle, privé, link-
// local, multicast, non spécifié) — une liaison sur 192.168.x.x serait un
// symptôme de proxy mal configuré, pas une maison.
func NormalizeDnsHomeIP(raw string) (string, bool) {
	ip := net.ParseIP(strings.TrimSpace(raw))
	if ip == nil {
		return "", false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return "", false
	}
	return ip.String(), true
}

// FindDnsHomeBindingByIP — la liaison d'une IP source (chemin chaud du
// serveur UDP/53 : registre en mémoire, parcours linéaire — quelques
// centaines de liaisons au maximum, microsecondes).
func FindDnsHomeBindingByIP(db *DB, ip string) *DnsHomeBinding {
	for i := range db.DnsHomeBindings {
		if db.DnsHomeBindings[i].IP == ip {
			return &db.DnsHomeBindings[i]
		}
	}
	return nil
}

// FindDnsHomeBindingByID — liaison par ID interne.
func FindDnsHomeBindingByID(db *DB, id string) *DnsHomeBinding {
	for i := range db.DnsHomeBindings {
		if db.DnsHomeBindings[i].ID == id {
			return &db.DnsHomeBindings[i]
		}
	}
	return nil
}

// DnsHomeBindingsOfEmail — les liaisons d'un propriétaire (ordre de création).
func DnsHomeBindingsOfEmail(db *DB, email string) []*DnsHomeBinding {
	out := []*DnsHomeBinding{}
	for i := range db.DnsHomeBindings {
		if strings.EqualFold(db.DnsHomeBindings[i].OwnerEmail, email) {
			out = append(out, &db.DnsHomeBindings[i])
		}
	}
	return out
}

// DnsHomeBindingsOfProfile — les liaisons qui servent un profil (la
// suppression d'un profil doit les retirer — jamais de liaison orpheline
// qui filtrerait sur un profil disparu).
func DnsHomeBindingsOfProfile(db *DB, profileID string) []*DnsHomeBinding {
	out := []*DnsHomeBinding{}
	for i := range db.DnsHomeBindings {
		if db.DnsHomeBindings[i].ProfileID == profileID {
			out = append(out, &db.DnsHomeBindings[i])
		}
	}
	return out
}
