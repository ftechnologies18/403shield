// dnsprofile.go — N°339 — PROFILS DU BOUCLIER DNS « 403Shield DNS »
// (Programme Bouclier DNS, phase 1 : filtrage par résolveur — le produit
// « appareil protégé SANS routeur 403Shield », miroir direct du consommable
// SafeWiFi N°80 qui filtre le WiFi PUBLIC via les routeurs).
//
// PRODUIT : chaque appareil (téléphone, PC, box domestique) pointe vers le
// résolveur DoH 403Shield avec un IDENTIFIANT DE PROFIL public dans l'URL
// (pattern NextDNS : https://…/dns-query/<publicId> — l'identifiant EST le
// secret faible, 16 hex aléatoires). Le profil porte :
//   - un NIVEAU (off | threats | family — miroir exact des niveaux SafeWiFi
//     N°80, même vocabulaire produit, deux canaux de distribution) ;
//   - des RÈGLES PERSONNELLES : listes bloquer/autoriser par domaine (le
//     parent bloque « example.com » → tous les sous-domaines suivent —
//
// match par suffixe) ;
//   - un COUVRE-FEU (réutilise FamilyGuardConfig N°82 TEL QUEL : même spec
//     "1|22:00|06:00|1111111", même sémantique des jours, même décision
//     UTC — Africa/Abidjan == GMT, sans heure d'été, la justification N°82
//     tient mot pour mot) ;
//   - un journal D'ÉVÉNEMENTS de blocage (DnsEvent — journalisation
//     MINIMALE : seuls les blocages et couvre-feux sont consignés, jamais
//     les requêtes autorisées — la promesse de confidentialité est un
//     argument produit, pas un détail).
//
// L'IDENTITÉ PROPRIÉTAIRE est l'e-mail du client console tunnel
// (TunnelClient.Email — même frontière que l'Accès Pro N°315 : le JWT rôle
// tunnel prouve la possession de la boîte, l'e-mail EST l'identité). Un
// profil n'appartient JAMAIS à un compte gérant SaaS : le produit DNS est
// vendu à la PERSONNE, pas au site WiFi.
//
// AUCUN secret dans cette table : le PublicID n'est pas un secret de
// chiffrement, c'est un identifiant d'acheminement (comme une adresse
// e-mail) — sa compromission filtre au pire le trafic DNS de son propre
// propriétaire, elle ne révèle rien.
package model

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// Niveaux du bouclier DNS — miroir strict de SafeWiFi (N°80) : le client
// retrouve le MÊME vocabulaire sur les deux canaux (WiFi public = routeur ;
// appareil = profil DNS).
const (
	DnsLevelOff     = "off"     // aucun filtrage de catégorie (règles perso actives)
	DnsLevelThreats = "threats" // menaces : malwares/phishing (listes N°339)
	DnsLevelFamily  = "family"  // famille : menaces + adulte + jeux d'argent
)

// DnsProfileStatus — active | blocked (un profil bloqué cesse d'être servi
// par le résolveur : la réponse DoH devient 404, l'appareil retombe sur son
// DNS système — jamais de réponse mensongère).
const (
	DnsProfileActive  = "active"
	DnsProfileBlocked = "blocked"
)

// Limites produit du MVP (défense en profondeur : le handler valide, le
// modèle re-valide — une donnée avariée ne traverse jamais le store).
const (
	MaxDnsProfilesPerEmail = 10  // un parent protège la famille, pas un lycée
	MaxDnsRulesPerList     = 200 // bloquer/autoriser : une liste lisible
	MaxDnsNameLength       = 80  // nom affiché, borné
)

// DnsProfile — un profil de filtrage DNS possédé par un e-mail client.
type DnsProfile struct {
	ID string `json:"id"`
	// PublicID — identifiant d'acheminement DoH (16 hex, crypto/rand) :
	// présent dans l'URL de l'appareil, UNIQUE, non énumérable.
	PublicID string `json:"publicId"`
	// OwnerEmail — e-mail du client console tunnel (minuscules).
	OwnerEmail string `json:"ownerEmail"`
	// Name — nom lisible choisi par le parent (« Tablette de Yao »).
	Name string `json:"name"`
	// Level — off | threats | family (miroir SafeWiFi N°80).
	Level string `json:"level"`
	// BlockRules — domaines bloqués perso, un par ligne (suffixe match).
	BlockRules string `json:"blockRules"`
	// AllowRules — domaines autorisés perso (surpassent catégories ET
	// couvre-feu : l'exception « devoirs » du cadrage produit).
	AllowRules string `json:"allowRules"`
	// CurfewSpec — spec FamilyGuard N°82 ("1|22:00|06:00|1111111"),
	// vide = jamais configuré. Réutilisé TEL QUEL (ActiveAt, même
	// sémantique) — une seule implémentation du couvre-feu, jamais deux.
	CurfewSpec string `json:"curfewSpec"`
	// Status — active | blocked.
	Status string `json:"status"`
	// CreatedAt / UpdatedAt — RFC3339 (NowISO).
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// DnsEvent — un blocage (ou un refus de couvre-feu) consigné : la base du
// rapport d'activité du parent. Les requêtes AUTORISÉES ne sont JAMAIS
// consignées (journalisation minimale — promesse produit).
type DnsEvent struct {
	ID string `json:"id"`
	// ProfileID — profil concerné (indexé).
	ProfileID string `json:"profileId"`
	// Domain — nom demandé (minuscules, borné 253).
	Domain string `json:"domain"`
	// Action — blocked | curfew.
	Action string `json:"action"`
	// CreatedAt — RFC3339 (NowISO).
	CreatedAt string `json:"createdAt"`
}

// Actions d'événement.
const (
	DnsEventBlocked = "blocked"
	DnsEventCurfew  = "curfew"
)

// NewDnsProfilePublicID — 16 hex aléatoires (crypto/rand) : l'identifiant
// d'acheminement. 64 bits d'aléa suffisent : la ressource protégée est un
// service de filtrage GRATUIT, pas un coffre (pattern des identifiants
// NextDNS — et l'énumération est de toute façon anti-économique).
func NewDnsProfilePublicID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand ne échoue pas sur Linux (getrandom(2)) ; un échec ici
		// est une panne machine : l'ID dégradé reste unique par le temps.
		return hex.EncodeToString([]byte(NowISO()))[:16]
	}
	return hex.EncodeToString(b)
}

// ValidDnsLevel — niveau connu.
func ValidDnsLevel(level string) bool {
	return level == DnsLevelOff || level == DnsLevelThreats || level == DnsLevelFamily
}

// dnsRuleDomainRe — un domaine de règle : minuscules a-z 0-9, points,
// tirets ; ni wildcard ni caractère d'échappement (le match est un simple
// suffixe — rien d'autre ne peut traverser).
func validDnsRuleDomain(d string) bool {
	if len(d) < 1 || len(d) > 253 {
		return false
	}
	for i := 0; i < len(d); i++ {
		c := d[i]
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '-' {
			continue
		}
		return false
	}
	// Pas de point en tête ni en queue, pas de segment vide (..), pas de
	// segment purement ponctuation.
	if d[0] == '.' || d[len(d)-1] == '.' || strings.Contains(d, "..") {
		return false
	}
	return true
}

// NormalizeDnsRules — normalise une liste (séparateurs retour-ligne ou
// virgule tolérés à l'entrée) : trim, minuscules, point de tête retiré,
// doublons supprimés, ordre d'entrée conservé. Retour ok=false si un
// domaine est invalide ou si la liste dépasse MaxDnsRulesPerList (le
// refus est honnête : toute la liste d'un coup, jamais de tri silencieux).
func NormalizeDnsRules(raw string) (string, bool) {
	fields := strings.FieldsFunc(raw, func(r rune) bool { return r == '\n' || r == '\r' || r == ',' || r == ' ' || r == '\t' })
	seen := map[string]bool{}
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		d := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(f), "."))
		if d == "" {
			continue
		}
		if !validDnsRuleDomain(d) {
			return "", false
		}
		if seen[d] {
			continue
		}
		seen[d] = true
		out = append(out, d)
	}
	if len(out) > MaxDnsRulesPerList {
		return "", false
	}
	return strings.Join(out, "\n"), true
}

// DnsRuleMatches — le domaine demandé correspond-il à la règle ? Match par
// suffixe : bloquer « example.com » couvre « a.example.com » (consommable
// du cadrage : « un blocage de domaine couvre automatiquement ses
// sous-domaines »). Égalité exacte OU « .suffixe » en queue.
func DnsRuleMatches(rule, qname string) bool {
	qname = strings.ToLower(strings.TrimSuffix(qname, "."))
	if qname == rule {
		return true
	}
	return strings.HasSuffix(qname, "."+rule)
}

// DnsRulesList — la liste en tranches (itération moteur).
func DnsRulesList(rules string) []string {
	if rules == "" {
		return nil
	}
	return strings.Split(rules, "\n")
}

// FindDnsProfileByID — profil par ID interne (registre ordre d'insertion).
func FindDnsProfileByID(db *DB, id string) *DnsProfile {
	for i := range db.DnsProfiles {
		if db.DnsProfiles[i].ID == id {
			return &db.DnsProfiles[i]
		}
	}
	return nil
}

// FindDnsProfileByPublicID — profil par identifiant d'acheminement DoH.
func FindDnsProfileByPublicID(db *DB, publicID string) *DnsProfile {
	for i := range db.DnsProfiles {
		if db.DnsProfiles[i].PublicID == publicID {
			return &db.DnsProfiles[i]
		}
	}
	return nil
}

// DnsProfilesOfEmail — les profils d'un propriétaire (ordre de création).
func DnsProfilesOfEmail(db *DB, email string) []*DnsProfile {
	out := []*DnsProfile{}
	for i := range db.DnsProfiles {
		if strings.EqualFold(db.DnsProfiles[i].OwnerEmail, email) {
			out = append(out, &db.DnsProfiles[i])
		}
	}
	return out
}
