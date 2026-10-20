// vpnguest.go — N°342 — ACCÈS INVITÉ : peers WireGuard EXPIRABLES pour tiers
// (serveur de jeu avec des amis, démo web à un client, collaborateur
// ponctuel) — le chantier qui ferme la promesse « partagez SANS exposer ».
//
// POSITIONNEMENT PRODUIT : un invité est un peer du segment dédié
// 10.8.3.0/24 (4e segment du pool wg0, wg-peer.sh v6) dont le périmètre est
// MINIMAL PAR CONSTRUCTION :
//   - conf cliente : AllowedIPs = <ip-hôte>/32 SEULEMENT (l'appareil Pro qui
//     accueille — jamais un segment, jamais 0.0.0.0/0) ;
//   - VM : chaîne iptables dédiée « mikcloud-guests » à DROP terminal, les
//     seules ouvertures étant les pin-holes invité→hôte sur les ports
//     déclarés (1-6, TCP+UDP) — fail-closed, même avec une conf trafiquée ;
//   - AUCUNE sortie Internet (pas de MASQUERADE sur 10.8.3.0/24), aucun
//     autre appareil Pro, aucun routeur, aucun LAN étendu, aucun pair-à-pair.
//
// La doctrine « 1 conf = 1 appareil » (N°338) est CONSERVÉE : un invité =
// une conf = un appareil tiers ; le partage de la conf Pro de l'hôte reste
// INTERDIT par conception (roaming de sessions WireGuard).
//
// CYCLE DE VIE : création par le GÉRANT propriétaire de l'hôte (JWT rôle
// tunnel — l'e-mail EST l'identité, même frontière que l'Accès Pro N°315),
// TTL court borné (1 à 72 h), expiration par balayage (vpnguest_sweep.go,
// 5 min — le retrait wg0 suit le même geste « remove » que toute révocation),
// révocation immédiate possible. La conf vit CHIFFRÉE au repos (colonne
// conf — secretbox, pattern VpnPeer.Conf N°291/D5-a) et ne sort QUE par le
// reveal (jamais dans un journal, jamais dans la liste).
//
// SÉCURITÉ — le segment invité est cloisonné PAR CONSTRUCTION, ce qui ferme
// la note du dossier N°341 : le hairpin remote↔remote (10.8.2.0/24) n'est
// pas cloisonné par compte au niveau iptables, mais les invités n'y ont
// JAMAIS accès (chaîne dédiée avant les ACCEPT génériques + fermetures
// B2C/routeurs vers 10.8.3.0/24). Un invité ne voit que SON hôte.
package model

import (
	"regexp"
	"strconv"
	"strings"
)

// États d'un invité (State). « expired » est DÉRIVÉ d'ExpiresAt à l'affichage
// (jamais persisté : l'heure de vérité est la comparaison à maintenant, pas
// un champ que le balayage mettrait à jour avec retard).
const (
	VpnGuestStateActive  = "active"
	VpnGuestStateRevoked = "revoked"
	VpnGuestStateError   = "error"
)

// VpnGuest — ligne du registre des invités (table « vpn_guests »).
type VpnGuest struct {
	ID string `json:"id"`
	// AccountID — le compte gérant PROPRIÉTAIRE DE L'HÔTE (apparié par
	// e-mail au JWT tunnel, miroir tunnelProAccountLocked N°315). L'invité
	// est créé sous ce compte : l'isolation se vérifie à CHAQUE résolution
	// (FindVpnGuestScoped).
	AccountID string `json:"accountId"`
	// Name — nom du peer CÔTÉ VM (wg-peer.sh) : préfixe « vpn- » obligatoire
	// (MÊME namespace global wg0 que les peers vendus — la jauge
	// VpnPeerNameTaken couvre les deux registres, et wg-mini valide le même
	// format sur la VM).
	Name string `json:"name"`
	// Label — nom commercial choisi par le gérant (« Ami du samedi »,
	// « Client démo Alpha »). Vide = repli UI sur « Invité » + date.
	// Même borne que les postes cyber (SanitizeDeviceName, 48 caractères).
	Label string `json:"label"`
	// HostPeerID — l'ID du VpnPeer « remote » (Accès Pro) qui ACCUEILLE
	// l'invité : le PC du serveur de jeu, la machine de la démo web. Lié au
	// moment de la création, re-résolu à l'affichage (l'hôte peut mourir —
	// l'invité devient inutilisable, son TTL court fait le reste).
	HostPeerID string `json:"hostPeerId"`
	// HostIP — l'adresse tunnel de l'hôte (10.8.2.N) figée à la création :
	// c'est ELLE que porte la conf invité (AllowedIPs) et les pin-holes VM —
	// la vérité réseau, même si le peer hôte change d'état côté registre.
	HostIP string `json:"hostIp"`
	// Ports — les ports pin-holés invité→hôte, csv « 25565 » ou
	// « 3000,80,443 » (1 à 6 ports, TCP+UDP des deux protocoles — la
	// règle multiport est commune). Validés aux TROIS frontières (cloud,
	// wg-mini, wg-peer.sh).
	Ports string `json:"ports"`
	// IPv4 — adresse tunnel de l'invité (10.8.3.N, informationnelle : la
	// vérité d'allocation reste wg-peer.sh sur la VM).
	IPv4 string `json:"ipv4"`
	// State — cycle de vie persisté (active/revoked/error ; « expired »
	// dérivé d'ExpiresAt).
	State string `json:"state"`
	// ErrorMsg — dernier échec wg-mini (affiché console ; JAMAIS de secret).
	ErrorMsg string `json:"errorMsg,omitempty"`
	// Conf — la configuration client COMPLÈTE (PrivateKey + PresharedKey
	// incluses). JAMAIS sérialisée (json:"-", double barrière avec le
	// seal/unseal du store, pattern VpnPeer.Conf) : chiffrée au repos,
	// re-livré par le reveal (self-healing wg-mini D5-a).
	Conf string `json:"-"`
	// ExpiresAt — RFC3339 strict (model.NowISO + TTL heures). Borné à la
	// création entre MinGuestTTLHours et MaxGuestTTLHours.
	ExpiresAt string `json:"expiresAt"`
	// CreatedAt / UpdatedAt — RFC3339 (model.NowISO).
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// VpnGuestLabel — libellé d'affichage : celui du gérant, sinon un repli
// neutre daté (jamais le nom VM, illisible pour un humain).
func VpnGuestLabel(g VpnGuest) string {
	if g.Label != "" {
		return g.Label
	}
	if len(g.CreatedAt) >= 10 {
		return "Invité du " + g.CreatedAt[:10]
	}
	return "Invité"
}

// guestHostIPRe — l'IP tunnel d'un HÔTE d'invité : un appareil Pro du
// segment remote (10.8.2.N, N ≥ 2 — le .1 est la gateway du segment).
// Miroir exact de guestHostRe dans wg-mini v6 et du contrôle wg-peer.sh
// add-guest : défense aux TROIS frontières.
var guestHostIPRe = regexp.MustCompile(`^10\.8\.2\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$`)

// ValidGuestHostIP — la discipline d'hôte côté cloud : SEUL un appareil Pro
// (10.8.2.x) peut accueillir un invité — jamais un routeur (10.8.0.x,
// supervision réservée au gérant), jamais un client B2C (10.8.1.x).
func ValidGuestHostIP(ip string) bool {
	return guestHostIPRe.MatchString(strings.TrimSpace(ip))
}

// MaxGuestPorts — borne du nombre de ports pin-holés par invité (même borne
// que wg-peer.sh v6 et wg-mini v6 — trois frontières).
const MaxGuestPorts = 6

// ValidGuestPorts — csv de 1 à MaxGuestPorts ports, chacun dans [1, 65535],
// sans espace : « 25565 » ou « 3000,80,443 ». La normalisation (trim) est
// faite par l'APPELANT avant la validation — ici la réponse est stricte.
func ValidGuestPorts(ports string) bool {
	ports = strings.TrimSpace(ports)
	if ports == "" {
		return false
	}
	items := strings.Split(ports, ",")
	if len(items) > MaxGuestPorts {
		return false
	}
	seen := map[string]bool{}
	for _, it := range items {
		it = strings.TrimSpace(it)
		if it == "" || seen[it] {
			return false // vide ou doublon — un invité propre n'a pas de doublon
		}
		seen[it] = true
		n, err := strconv.Atoi(it)
		if err != nil || n < 1 || n > 65535 {
			return false
		}
	}
	return true
}

// Bornes du TTL d'un invité (heures) : assez court pour qu'un oubli se
// referme seul (le lendemain au plus tard pour un partage du jour), assez
// long pour une démo ou un week-end LAN. Un invité n'est JAMAIS permanent —
// c'est un tiers, pas un appareil du compte.
const (
	MinGuestTTLHours = 1
	MaxGuestTTLHours = 72
)

// MaxVpnGuestsPerAccount — plafond d'invités ACTIFS par compte (garde-fou
// v1, même doctrine que MaxVpnPeersPerAccount : borne constante honnête ;
// le plafond par formule suivra avec l'éditeur de formules).
const MaxVpnGuestsPerAccount = 10

// FindVpnGuestScoped — retrouve l'invité d'un compte par son ID exact (nil
// si absent ou appartenant à un autre compte — l'isolation se vérifie à
// CHAQUE résolution, même discipline que FindVpnPeerScoped).
func FindVpnGuestScoped(db *DB, id, accountID string) *VpnGuest {
	if id == "" {
		return nil
	}
	for i := range db.VpnGuests {
		if db.VpnGuests[i].ID == id && db.VpnGuests[i].AccountID == accountID {
			return &db.VpnGuests[i]
		}
	}
	return nil
}

// VpnGuestExpired — l'invité est-il à terme ? (ExpiresAt vide = jamais —
// défaut conservateur : la ligne vivante sans échéance reste vivante).
func VpnGuestExpired(g *VpnGuest, nowISO string) bool {
	return g.ExpiresAt != "" && g.ExpiresAt < nowISO
}

// VpnGuestsActiveForAccount — jauge du plafond : invités vivants (actifs ET
// non échus) du compte. Les révoqués/échus ne comptent plus — le gérant
// peut en recréer aussitôt.
func VpnGuestsActiveForAccount(db *DB, accountID, nowISO string) int {
	n := 0
	for i := range db.VpnGuests {
		g := &db.VpnGuests[i]
		if g.AccountID == accountID && g.State == VpnGuestStateActive && !VpnGuestExpired(g, nowISO) {
			n++
		}
	}
	return n
}

// VpnGuestEffectiveState — l'état DÉRIVÉ affiché : revoked > error >
// expired > active (l'échéance n'est PAS persistée — elle se lit à
// l'instant, honnête par construction).
func VpnGuestEffectiveState(g *VpnGuest, nowISO string) string {
	switch g.State {
	case VpnGuestStateRevoked:
		return VpnGuestStateRevoked
	case VpnGuestStateError:
		return VpnGuestStateError
	}
	if VpnGuestExpired(g, nowISO) {
		return "expired"
	}
	if g.State == VpnGuestStateActive {
		return VpnGuestStateActive
	}
	return VpnGuestStateError
}
