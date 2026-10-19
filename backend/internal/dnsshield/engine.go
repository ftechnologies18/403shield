// engine.go — N°339 — MOTEUR DE DÉCISION du bouclier DNS : pour une
// question et un profil, décider — autoriser (forward), bloquer
// (sinkhole/NXDOMAIN) ou couvre-feu (REFUSED). PUR : aucune I/O, aucune
// horloge propre (l'instant est un PARAMÈTRE — testable à la seconde près).
//
// ORDRE DE DÉCISION (le cadrage produit, figé ici) :
//  1. RÈGLE AUTORISER → ALLOW : l'allowlist dépasse TOUT — catégories ET
//     couvre-feu (l'exception « devoirs » : un site éducatif reste
//     joignable pendant la nuit, si le parent le veut) ;
//  2. COUVRE-FEU ACTIF → CURFEW (REFUSED) : la nuit, Internet dort ;
//  3. RÈGLE BLOQUER ou CATÉGORIE DU NIVEAU → BLOCK ;
//  4. sinon ALLOW.
//
// CATÉGORIES : le niveau « family » bloque menaces + adulte + jeux d'argent
// (graines CI-DESSOUS — domaines réels, célèbres, vérifiables publiquement) ;
// le niveau « threats » (malwares/phishing) consulte l'agrégat URLhaus/
// OpenPhish du N°343 (threats.go — set atomique reconstruit des flux au
// démarrage puis toutes les 6 h, fail-open : un flux injoignable ne vide
// JAMAIS la liste précédente). Les deux niveaux partagent le MÊME agrégat :
// family = threats + catégories, exactement le vocabulaire SafeWiFi N°80.
//
// Le couvre-feu réutilise FamilyGuardConfig.ActiveAt TEL QUEL (N°82) :
// même spec, même sémantique des jours de DÉBUT de fenêtre, même décision
// UTC (== Africa/Abidjan GMT — justification N°82 inchangée).
package dnsshield

import (
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// Verdict — la décision du moteur.
type Verdict int

const (
	VerdictAllow  Verdict = iota // forward upstream
	VerdictBlock                 // sinkhole A/:: ou NXDOMAIN
	VerdictCurfew                // REFUSED
)

// categoryAdult — graines « adulte » du niveau family : des noms réels et
// stables des plus grands sites du segment, vérifiables publiquement. Une
// liste de DÉPART honnête — le parent complète avec SES règles ; les
// listes exhaustives sont l'affaire du N°340 (agrégation automatique).
var categoryAdult = []string{
	"pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com",
	"redtube.com", "youporn.com", "tube8.com", "brazzers.com",
	"onlyfans.com", "stripchat.com", "chaturbate.com", "livejasmin.com",
}

// categoryGambling — graines « jeux d'argent » du niveau family (même
// discipline : célèbres, réels, vérifiables).
var categoryGambling = []string{
	"betclic.com", "unibet.fr", "winamax.fr", "parions-sport.fdj.fr",
	"1xbet.com", "bet365.com", "pokerstars.com", "stake.com",
}

func init() {
	// Défense d'hygiène : la liste ci-dessus est écrite à la main — la
	// normalisation ici garantit minuscules/trim même en cas de coquille
	// (le moteur matche en minuscules, la règle reste lisible en source).
	for i := range categoryAdult {
		categoryAdult[i] = strings.ToLower(strings.TrimSpace(categoryAdult[i]))
	}
	for i := range categoryGambling {
		categoryGambling[i] = strings.ToLower(strings.TrimSpace(categoryGambling[i]))
	}
}

// Decide — la décision pour une question (nom minuscule attendu —
// ParseQuery normalise déjà) à l'instant t.
func Decide(p *model.DnsProfile, qname string, now time.Time) Verdict {
	qname = strings.ToLower(strings.TrimSuffix(qname, "."))

	// 1. Allowlist : dépasse tout (l'exception « devoirs »).
	for _, r := range model.DnsRulesList(p.AllowRules) {
		if model.DnsRuleMatches(r, qname) {
			return VerdictAllow
		}
	}

	// 2. Couvre-feu (FamilyGuard N°82, réutilisé tel quel).
	if p.CurfewSpec != "" {
		if cfg, ok := model.ParseFamilyGuardSpec(p.CurfewSpec); ok && cfg.ActiveAt(now) {
			return VerdictCurfew
		}
	}

	// 3. Règle bloquer perso.
	for _, r := range model.DnsRulesList(p.BlockRules) {
		if model.DnsRuleMatches(r, qname) {
			return VerdictBlock
		}
	}

	// 4. Catégories du niveau. L'agrégat de menaces est partagé par les
	// deux niveaux de filtrage (family = threats + adulte + jeux
	// d'argent — vocabulaire SafeWiFi N°80) ; il est consulté APRÈS les
	// règles perso : l'exception « devoirs » de l'allowlist dépasse
	// toujours TOUT (ordre figé en tête de fichier).
	if p.Level == model.DnsLevelThreats || p.Level == model.DnsLevelFamily {
		if ThreatListed(qname) {
			return VerdictBlock
		}
	}
	if p.Level == model.DnsLevelFamily {
		for _, r := range categoryAdult {
			if model.DnsRuleMatches(r, qname) {
				return VerdictBlock
			}
		}
		for _, r := range categoryGambling {
			if model.DnsRuleMatches(r, qname) {
				return VerdictBlock
			}
		}
	}

	return VerdictAllow
}
