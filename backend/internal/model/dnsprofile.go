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
	"time"
)

// Niveaux du bouclier DNS — miroir strict de SafeWiFi (N°80) : le client
// retrouve le MÊME vocabulaire sur les deux canaux (WiFi public = routeur ;
// appareil = profil DNS).
const (
	DnsLevelOff     = "off"     // aucun filtrage de catégorie (règles perso actives)
	DnsLevelThreats = "threats" // menaces : malwares/phishing (agrégat URLhaus/OpenPhish N°343)
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

// Rétention du journal de blocage (N°343 — purge périodique, miroir de la
// rétention UserLogs N°64/65 : une promesse de journalisation MINIMALE se
// tient par la purge, pas par l'intention).
//
//   - DnsEventRetentionDays : un blocage de plus de 30 jours n'intéresse
//     plus le rapport d'activité du parent (la console n'en montre que les
//     100 derniers) — la vie privée du foyer l'emporte sur l'archivistique.
//   - MaxDnsEventsPerProfile : borne haute par profil si un appareil infesté
//     bégaie des domaines bloqués (la dédup 10 min limite déjà le rythme :
//     144/jour/domaine — la borne attrape le cas « beaucoup de domaines
//     distincts », ~7 jours d'histoire au pire).
const (
	DnsEventRetentionDays  = 30
	MaxDnsEventsPerProfile = 1000
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
	return NormalizeDnsRulesWithMax(raw, MaxDnsRulesPerList)
}

// NormalizeDnsRulesWithMax — N°347 — NormalizeDnsRules avec borne PARAMÉTRÉE :
// l'abonnement TOURACO relève la limite à DnsQuotasTouraco.MaxRules (600) —
// le handler console résout la borne par e-mail (entitlement) avant
// d'appeler ; la validation de chaque domaine est strictement la même.
func NormalizeDnsRulesWithMax(raw string, max int) (string, bool) {
	if max < 1 {
		max = MaxDnsRulesPerList
	}
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
	if len(out) > max {
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

// PurgeDnsEvents — N°343 — tient la promesse de journalisation minimale :
// retire les événements de blocage plus vieux que DnsEventRetentionDays et
// borne chaque profil à ses MaxDnsEventsPerProfile plus RÉCENTS (les
// requêtes autorisées n'étant jamais consignées, le journal ne peut croître
// que par les blocages — la dédup 10 min du résolveur ralentit déjà le
// rythme, cette purge ferme le cas « appareil infesté pendant des mois »).
// Appelée par le balayage horaire de rétention (N°64) sous verrou, avant
// Save — la suppression se propage à PostgreSQL par syncTable, exactement
// comme la suppression d'un profil. Retour : le nombre d'événements purgés
// (tracé par l'appelant si non nul — preuve d'audit).
func PurgeDnsEvents(db *DB, now time.Time) int {
	// N°347 — rétention et borne PAR PROPRIÉTAIRE : un abonné TOURACO
	// actif conserve 90 jours / 3000 événements par profil, un compte
	// gratuit 30 j / 1000 (bornes historiques — INTACTES). Le droit se
	// calcule à CHAQUE passage sur les commandes provisionnées non
	// échues : un terme franchi retombe immédiatement au tier gratuit,
	// aucune recopie, aucune colonne à migrer. Un événement dont le
	// profil a disparu (cas défensif : la cascade de suppression les
	// emporte normalement) suit le tier gratuit.
	subbed := DnsActiveSubscribers(db)
	cutoff := map[string]string{}
	capOf := map[string]int{}
	for i := range db.DnsProfiles {
		q := DnsQuotasFree
		if subbed[strings.ToLower(db.DnsProfiles[i].OwnerEmail)] {
			q = DnsQuotasTouraco
		}
		cutoff[db.DnsProfiles[i].ID] = now.AddDate(0, 0, -q.RetentionDays).Format(time.RFC3339)
		capOf[db.DnsProfiles[i].ID] = q.MaxEvents
	}
	freeCutoff := now.AddDate(0, 0, -DnsQuotasFree.RetentionDays).Format(time.RFC3339)
	cutoffOf := func(pid string) string {
		if c, ok := cutoff[pid]; ok {
			return c
		}
		return freeCutoff
	}
	capOfPid := func(pid string) int {
		if c, ok := capOf[pid]; ok && c > 0 {
			return c
		}
		return DnsQuotasFree.MaxEvents
	}
	// Les événements sont en ordre d'insertion (plus récents en QUEUE) : la
	// borne par profil se compte en REMONTANT depuis la fin, puis le filtre
	// final parcourt dans l'ordre pour reconstruire la tranche conservée.
	counts := map[string]int{}
	keepFromEnd := map[int]bool{}
	for i := len(db.DnsEvents) - 1; i >= 0; i-- {
		pid := db.DnsEvents[i].ProfileID
		if counts[pid] < capOfPid(pid) {
			counts[pid]++
			keepFromEnd[i] = true // cet indice est dans la fenêtre conservée
		}
	}
	kept := db.DnsEvents[:0]
	purged := 0
	for i := range db.DnsEvents {
		e := db.DnsEvents[i]
		if !keepFromEnd[i] || e.CreatedAt < cutoffOf(e.ProfileID) {
			purged++
			continue
		}
		kept = append(kept, e)
	}
	db.DnsEvents = kept
	return purged
}
