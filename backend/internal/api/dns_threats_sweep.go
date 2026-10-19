// dns_threats_sweep.go — N°343 — BALAYAGE PÉRIODIQUE DES LISTES DE MENACES
// du bouclier DNS : reconstruire l'agrégat URLhaus/OpenPhish au démarrage
// puis toutes les 6 h (les flux gratuits sont publiés au mieux quelques
// fois par jour — 6 h suivent leur rythme sans les marteler ; URLhaus
// demande explicitement un espacement poli des téléchargements).
//
// MÉCANIQUE (patron des balayages maison — retention N°64, vpnquota N°311) :
//  1. TÉLÉCHARGER chaque flux HORS verrou (le set de menaces ne vit PAS
//     dans le store : aucune contention avec les requêtes DNS — l'état est
//     un agrégat en mémoire, rebuildable, jamais persisté) ;
//  2. AGRÉGER les hôtes (dnsshield.ParseThreatFeed, dédup inter-flux) ;
//  3. PUBLIER par substitution atomique (dnsshield.SetThreatSet).
//
// FAIL-OPEN À GÉOMÉTRIE HONNÊTE (la promesse threats.go : « un flux
// injoignable ne vide JAMAIS le set ») :
//   - tous les flux OK      → remplacement frais (les délistages — faux
//     positifs corrigés — s'appliquent : c'est le cas courant) ;
//   - ÉCHEC PARTIEL         → UNION du frais avec le dernier agrégat publié
//     (la couverture ne régresse jamais parce qu'un éditeur a été indisponible
//     un cycle ; le délistage attendra le prochain passage complet — pour une
//     liste de phishing, un faux négatif de 6 h coûte plus cher qu'un faux
//     positif provisoire, et l'allowlist perso dépasse toujours tout) ;
//   - tous en échec         → l'ancien set reste servi tel quel, échec tracé.
//
// AUCUN réseau en CI : dnsThreatFetchFn est une variable de package
// (pattern wgMiniListFn / dnsshield.Forward — discipline maison
// d'indirection) ; les tests la remplacent.
package api

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"mikcloud/hotspot-api/internal/dnsshield"
)

// dnsThreatsSweepInterval — cadence du balayage : 6 h (rythme des flux
// gratuits + politesse envers les éditeurs ; la fraîcheur d'une liste de
// phishing se joue au jour, pas à la minute).
const dnsThreatsSweepInterval = 6 * time.Hour

// dnsThreatsDefaultFeeds — les flux publics par défaut (l'env
// DNS_SHIELD_THREAT_FEEDS, URLs séparées par virgules, peut les remplacer —
// ex. l'édition payante temps réel d'OpenPhish si l'exploitant l'achète).
const dnsThreatsDefaultFeeds = "https://urlhaus.abuse.ch/downloads/text/,https://openphish.com/feed.txt"

// dnsThreatFetchTimeout / dnsThreatFetchLimit — bornes d'un téléchargement :
// les flux font quelques Mo ; 30 s et 64 Mo laissent la place aux mauvais
// jours sans accepter l'infini.
const (
	dnsThreatFetchTimeout = 30 * time.Second
	dnsThreatFetchLimit   = 64 << 20
)

// dnsThreatUserAgent — identité honnête exigée par les éditeurs de flux
// (abuse.ch demande un UA distinguable — jamais un UA de navigateur maquillé).
const dnsThreatUserAgent = "403shield-dns/1.0 (+https://403shield.ftci.fr; contact: freelancetechnologies.ci@gmail.com)"

// dnsThreatFetchFn — le téléchargeur (injectable, discipline maison).
var dnsThreatFetchFn = dnsThreatFetchHTTP

// dnsThreatLastMu / dnsThreatLast — mémoire du dernier agrégat publié (pour
// l'UNION en cas d'échec partiel — la couverture ne régresse jamais).
var (
	dnsThreatLastMu sync.Mutex
	dnsThreatLast   []string
)

// dnsThreatFeeds — la liste des flux (env ou défauts).
func dnsThreatFeeds() []string {
	env := strings.TrimSpace(os.Getenv("DNS_SHIELD_THREAT_FEEDS"))
	if env == "" {
		env = dnsThreatsDefaultFeeds
	}
	out := []string{}
	for _, s := range strings.Split(env, ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// dnsThreatFetchHTTP — un GET borné par flux.
func dnsThreatFetchHTTP(url string) ([]byte, error) {
	client := &http.Client{Timeout: dnsThreatFetchTimeout}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", dnsThreatUserAgent)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, io.ErrUnexpectedEOF
	}
	return io.ReadAll(io.LimitReader(resp.Body, dnsThreatFetchLimit))
}

// RunDnsThreatsSweepForever — boucle (goroutine de main.go) : rattrapage au
// démarrage puis passage toutes les 6 h ; panique récupérée (N°74 — la
// goroutine ne meurt jamais en silence).
func (a *API) RunDnsThreatsSweepForever() {
	sweep := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("bouclier DNS menaces : panique récupérée (reprise au passage suivant) : %v\n%s", r, debug.Stack())
			}
		}()
		a.RunDnsThreatsSweep()
	}
	sweep()
	for range time.Tick(dnsThreatsSweepInterval) {
		sweep()
	}
}

// RunDnsThreatsSweep — un passage : télécharge, agrège, publie. Ne touche
// JAMAIS le store (aucun verrou, aucune écriture — l'état vit dans le
// package dnsshield).
func (a *API) RunDnsThreatsSweep() {
	started := time.Now()
	feeds := dnsThreatFeeds()
	if len(feeds) == 0 {
		return
	}
	seen := map[string]bool{}
	merged := []string{}
	failed := []string{}
	for _, u := range feeds {
		body, err := dnsThreatFetchFn(u)
		if err != nil {
			failed = append(failed, u)
			log.Printf("bouclier DNS menaces : flux injoignable (%s) : %v", u, err)
			continue
		}
		for _, h := range dnsshield.ParseThreatFeed(bytes.NewReader(body)) {
			if !seen[h] {
				seen[h] = true
				merged = append(merged, h)
			}
		}
	}
	if len(failed) == len(feeds) {
		// Tous en échec : l'ancien set reste servi (fail-open total).
		log.Printf("bouclier DNS menaces : aucun flux disponible — l'agrégat précédent reste servi")
		return
	}

	dnsThreatLastMu.Lock()
	if len(failed) > 0 && len(dnsThreatLast) > 0 {
		// Échec partiel : UNION avec le dernier publié (la couverture ne
		// régresse jamais — délistages reportés au prochain passage complet).
		for _, h := range dnsThreatLast {
			if !seen[h] {
				seen[h] = true
				merged = append(merged, h)
			}
		}
	}
	published := append([]string(nil), merged...)
	dnsThreatLast = published
	dnsThreatLastMu.Unlock()

	n := dnsshield.SetThreatSet(published, time.Now().UTC())
	if len(failed) == 0 {
		log.Printf("bouclier DNS menaces : %d domaines publiés (%d flux, %s)",
			n, len(feeds), time.Since(started).Round(time.Millisecond))
	} else {
		log.Printf("bouclier DNS menaces : %d domaines publiés (union — %d/%d flux ok, %s)",
			n, len(feeds)-len(failed), len(feeds), time.Since(started).Round(time.Millisecond))
	}
}
