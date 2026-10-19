// threats.go — N°343 — LISTES DE MENACES du bouclier DNS : l'agrégation
// URLhaus/OpenPhish promise par le cadrage (le niveau « threats » de la
// phase 1 N°339 était VIDE et VERROUILLÉ par test — ces listes vivent
// quelques heures, une liste figée en source serait mensongère ; doctrine :
// aucun faux chiffre).
//
// SOURCE — deux flux publics en TEXTE BRUT, une URL par ligne :
//   - URLhaus (abuse.ch) : https://urlhaus.abuse.ch/downloads/text/
//     URL de distribution de malwares (malware URLs) ;
//   - OpenPhish (édition communautaire) : https://openphish.com/feed.txt
//     URL de phishing. L'édition gratuite est retardée de 24 h+ : c'est le
//     MVP honnête, l'édition payante (feed.txt temps réel) est un simple
//     changement d'URL si l'exploitant l'achète un jour.
//
// Pureté de l'agrégat : le HOST de chaque URL est extrait (http://host/x →
// host, port retiré, IP nues IGNORÉES — une IP ne traverse pas une question
// DNS de nom), validé par le même alphabet que les règles perso, dédupliqué.
// Le DOMAINE COMPLET de la source est conservé (jamais le domaine
// enregistrable) : « attaquant.github.io » est listé TEL QUEL — la sémantique
// suffixe de ThreatListed bloque lui et ses sous-domaines, JAMAIS les frères
// (« autre.github.io » reste libre — précision exigée par les hébergeurs
// partagés qui peuplent ces flux).
//
// ÉTAT — un SEUL set immuable en mémoire, publié par atomic.Pointer :
// la lecture (chemin chaud Decide, des milliers de requêtes DNS) ne prend
// AUCUN verrou ; le balayage N°343 construit un set NEUF hors ligne puis le
// substitue d'un seul geste. Rien n'est persisté : l'état est RECONSTRUIT
// des flux au démarrage (même doctrine que l'état wg — pas de table pour un
// dérivé rebuildable, le schéma DB reste intact).
//
// FAIL-OPEN (miroir wire.go) : un flux injoignable ne VIDE JAMAIS le set —
// l'ancien reste servi (une liste périmée bloque encore ce qu'elle connaît ;
// une liste vide ne bloque plus rien). Le set démarre vide et honnête
// (ThreatStats l'expose tel quel à la console : 0 domaines tant que le
// premier passage n'a pas réussi — jamais de chiffre fabriqué).
package dnsshield

import (
	"bufio"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"time"
)

// MaxThreatDomains — plafond mémoire de l'agrégat. Les deux flux gratuits
// agrégés tiennent historiquement sous ~40 000 hôtes uniques ; le plafond
// laisse un ordre de grandeur de marge (au-delà, les ajouts sont ignorés et
// le compte reste honnête — un Go de set ne ralentit pas une map).
const MaxThreatDomains = 200000

// threatFeedLineLimit — borné par ligne : une « ligne » de flux sans
// retour-chariot est une attaque de flux, pas une URL.
const threatFeedLineLimit = 2048

// threatState — un instantané immuable du set de menaces (publié entier
// par substitution atomique ; jamais muté après publication).
type threatState struct {
	set   map[string]struct{}
	count int
	at    time.Time
}

// threatCurrent — l'instantané servi aux requêtes (atomic.Pointer : lecture
// sans verrou sur le chemin chaud ; nil = phase de démarrage, set vide).
var threatCurrent atomic.Pointer[threatState]

// ParseThreatFeed — extrait les hôtes d'un flux texte (une URL par ligne,
// commentaires « # » tolérés — format URLhaus/OpenPhish). PUR : aucune I/O,
// le lecteur est fourni. L'ordre des lignes est conservé, les doublons
// ignorés silencieusement (l'agrégat déduplique par construction).
func ParseThreatFeed(r io.Reader) []string {
	out := []string{}
	seen := map[string]bool{}
	sc := bufio.NewScanner(io.LimitReader(r, 64<<20)) // 64 Mo max : un flux honnête en fait ~15
	sc.Buffer(make([]byte, 0, threatFeedLineLimit), threatFeedLineLimit)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		host := threatHostOf(line)
		if host == "" || seen[host] {
			continue
		}
		seen[host] = true
		out = append(out, host)
	}
	return out
}

// threatHostOf — l'hôte d'une ligne de flux : accepte une URL complète
// (http://host:port/chemin) ou un hôte nu. Minuscules, port retiré, IP
// ignorées (retour vide : une IP nue n'est pas un nom DNS), alphabet
// validé par la même discipline que les règles perso.
func threatHostOf(line string) string {
	s := strings.ToLower(strings.TrimSpace(line))
	// Préfixe de schéma ? Retirer jusqu'au « // » (http://, https://, hxxp://
	// défiguré par certains éditeurs de flux).
	if i := strings.Index(s, "://"); i >= 0 {
		s = s[i+3:]
	}
	// Chemin, requête, fragment : tout ce qui suit le premier « / », « ? »
	// ou « # » n'est pas l'hôte.
	if i := strings.IndexAny(s, "/?#"); i >= 0 {
		s = s[:i]
	}
	// userinfo « user:pass@ » : l'hôte est après le dernier « @ ».
	if i := strings.LastIndex(s, "@"); i >= 0 {
		s = s[i+1:]
	}
	// Port éventuel.
	if i := strings.LastIndex(s, ":"); i >= 0 {
		// IPv6 entre crochets — ignoré de toute façon ci-dessous, couper proprement.
		if host, _, err := net.SplitHostPort(s); err == nil {
			s = host
		}
	}
	s = strings.Trim(s, ".[]")
	if s == "" {
		return ""
	}
	// IP nue (v4 ou v6) : PAS un nom DNS — hors périmètre du filtrage de noms.
	if net.ParseIP(s) != nil {
		return ""
	}
	if !validThreatDomain(s) {
		return ""
	}
	return s
}

// validThreatDomain — même alphabet que validDnsRuleDomain du modèle, sans
// la limite de longueur de règle (les hôtes DNS vont jusqu'à 253 — la même
// borne s'applique ici). Local : le modèle garde ses bornes produit, le
// flux a les siennes, les deux refusent l'exotique d'unanimité.
func validThreatDomain(d string) bool {
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
	if d[0] == '.' || d[len(d)-1] == '.' || strings.Contains(d, "..") {
		return false
	}
	return true
}

// SetThreatSet — publie un set neuf construit des hôtes fournis (le
// balayage N°343 collecte les flux puis appelle ceci UNE fois par passage).
// Le plafond MaxThreatDomains est appliqué dans l'ordre fourni ; retourne
// le compte publié. Un appel avec liste vide publie un set vide HONNÊTE —
// l'appelant (balayage) ne le fait que si les flux l'ont réellement dit.
func SetThreatSet(domains []string, at time.Time) int {
	set := make(map[string]struct{}, len(domains))
	for _, d := range domains {
		d = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(d), "."))
		if d == "" {
			continue
		}
		if len(set) >= MaxThreatDomains {
			break
		}
		set[d] = struct{}{}
	}
	st := &threatState{set: set, count: len(set), at: at}
	threatCurrent.Store(st)
	return st.count
}

// ThreatListed — l'hôte demandé est-il dans la liste des menaces ?
// Sémantique du domaine COMPLET de flux : égalité OU sous-domaine direct
// (même précision que DnsRuleMatches — « attaquant.github.io » ne bloque
// jamais « autre.github.io »). Chemin chaud : zéro verrou, zéro allocation.
func ThreatListed(domain string) bool {
	st := threatCurrent.Load()
	if st == nil || len(st.set) == 0 {
		return false
	}
	d := strings.TrimSuffix(domain, ".")
	if d == "" {
		return false
	}
	if _, ok := st.set[d]; ok {
		return true
	}
	// Sous-domaine : le set est petit, une coupe par point suffit (les
	// entrées sont des hôtes complets — chercher chaque parent du domaine).
	for i := 0; i < len(d); i++ {
		if d[i] != '.' {
			continue
		}
		if _, ok := st.set[d[i+1:]]; ok {
			return true
		}
	}
	return false
}

// ThreatStats — le compte publié et l'instant de publication (console :
// « X domaines de menaces actifs », 0 et instant zéro tant que le premier
// passage du balayage n'a pas réussi — jamais de chiffre fabriqué).
func ThreatStats() (count int, at time.Time) {
	st := threatCurrent.Load()
	if st == nil {
		return 0, time.Time{}
	}
	return st.count, st.at
}
