// dns_threats_test.go — N°343 — tests du balayage des listes de menaces et
// du champ honnête « threats » de la console : AUCUN réseau réel
// (dnsThreatFetchFn stubbé, discipline maison des indirections — miroir
// dnsForwardStub), fail-open à géométrie honnête (échec partiel = UNION,
// échec total = l'ancien reste servi), et le compte servi au résolveur
// exposé tel quel à /me.
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/dnsshield"
)

// dnsThreatReset — repart d'un état de package propre (set + mémoire du
// dernier agrégat), restaure à la fin : les tests ne dépendent jamais de
// l'ordre d'exécution.
func dnsThreatReset(t *testing.T) {
	t.Helper()
	dnsshield.SetThreatSet(nil, time.Time{})
	old := dnsThreatFetchFn
	dnsThreatLastMu.Lock()
	oldLast := dnsThreatLast
	dnsThreatLast = nil
	dnsThreatLastMu.Unlock()
	t.Cleanup(func() {
		dnsshield.SetThreatSet(nil, time.Time{})
		dnsThreatFetchFn = old
		dnsThreatLastMu.Lock()
		dnsThreatLast = oldLast
		dnsThreatLastMu.Unlock()
	})
}

// dnsThreatStub — le téléchargeur de test : flux → corps, absent → erreur.
func dnsThreatStub(t *testing.T, feeds map[string]string) {
	t.Helper()
	dnsThreatFetchFn = func(url string) ([]byte, error) {
		if body, ok := feeds[url]; ok {
			return []byte(body), nil
		}
		return nil, errors.New("flux injoignable (test)")
	}
}

func TestDnsThreatsSweepFullOK(t *testing.T) {
	a, _ := newTunnelTest(t)
	dnsThreatReset(t)
	dnsThreatStub(t, map[string]string{
		"https://urlhaus.abuse.ch/downloads/text/": "https://malware.example/a\nhttps://malware.example/b\n",
		"https://openphish.com/feed.txt":           "https://phish.example/login\n",
	})
	a.RunDnsThreatsSweep()
	n, at := dnsshield.ThreatStats()
	if n != 2 {
		t.Fatalf("attendu 2 domaines (dédup inter-lignes), obtenu %d", n)
	}
	if at.IsZero() {
		t.Fatal("l'instant de publication doit être posé")
	}
	if !dnsshield.ThreatListed("malware.example") || !dnsshield.ThreatListed("phish.example") {
		t.Fatal("les deux hôtes doivent être listés")
	}
}

func TestDnsThreatsSweepPartialFailUnions(t *testing.T) {
	a, _ := newTunnelTest(t)
	dnsThreatReset(t)
	urlhaus := "https://urlhaus.abuse.ch/downloads/text/"
	openphish := "https://openphish.com/feed.txt"
	// 1er passage : les deux flux OK.
	dnsThreatStub(t, map[string]string{
		urlhaus:   "https://malware.example/a\n",
		openphish: "https://phish.example/x\n",
	})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 2 {
		t.Fatalf("1er passage : attendu 2, obtenu %d", n)
	}
	// 2e passage : URLhaus tombe, OpenPhish sert un hôte NEUF — l'UNION
	// conserve la couverture du cycle précédent (elle ne régresse jamais).
	dnsThreatStub(t, map[string]string{
		openphish: "https://phish-2.example/y\n",
	})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 3 {
		t.Fatalf("2e passage (échec partiel) : attendu 3 (union), obtenu %d", n)
	}
	for _, d := range []string{"malware.example", "phish.example", "phish-2.example"} {
		if !dnsshield.ThreatListed(d) {
			t.Fatalf("%s doit rester listé (union — la couverture ne régresse jamais)", d)
		}
	}
	// 3e passage : les deux reviennent — remplacement FRAIS (les délistages
	// s'appliquent : phish.example disparaît honnêtement).
	dnsThreatStub(t, map[string]string{
		urlhaus:   "https://malware.example/a\n",
		openphish: "https://phish-2.example/y\n",
	})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 2 {
		t.Fatalf("3e passage (retour à la normale) : attendu 2 (frais), obtenu %d", n)
	}
	if dnsshield.ThreatListed("phish.example") {
		t.Fatal("délisté par les flux complets : ne doit plus être listé")
	}
}

func TestDnsThreatsSweepAllFailKeepsOld(t *testing.T) {
	a, _ := newTunnelTest(t)
	dnsThreatReset(t)
	urlhaus := "https://urlhaus.abuse.ch/downloads/text/"
	openphish := "https://openphish.com/feed.txt"
	dnsThreatStub(t, map[string]string{
		urlhaus:   "https://malware.example/a\n",
		openphish: "https://phish.example/x\n",
	})
	a.RunDnsThreatsSweep()
	// Tous les flux tombent : l'ancien set reste servi TEL QUEL.
	dnsThreatStub(t, map[string]string{})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 2 {
		t.Fatalf("échec total : l'ancien set doit rester servi (2), obtenu %d", n)
	}
	if !dnsshield.ThreatListed("malware.example") {
		t.Fatal("fail-open total : la couverture précédente doit tenir")
	}
}

func TestDnsThreatsSweepEnvFeeds(t *testing.T) {
	a, _ := newTunnelTest(t)
	dnsThreatReset(t)
	t.Setenv("DNS_SHIELD_THREAT_FEEDS", "https://interne.example/feed.txt")
	dnsThreatStub(t, map[string]string{
		"https://interne.example/feed.txt": "https://prive.example/a\n",
	})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 1 {
		t.Fatalf("env override : attendu 1, obtenu %d", n)
	}
	if !dnsshield.ThreatListed("prive.example") {
		t.Fatal("le flux de l'env doit être servi")
	}
}

func TestDnsShieldMeExposesThreats(t *testing.T) {
	a, st := newTunnelTest(t)
	dnsThreatReset(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	// Le compte servi au résolveur est exposé TEL QUEL — ici 0 (aucun
	// passage réussi) : jamais de chiffre fabriqué.
	rec := httptest.NewRecorder()
	a.handleDnsShieldMe(rec, dnsReq(http.MethodGet, "/api/dnsshield/me", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("JSON illisible : %v", err)
	}
	threats, ok := out["threats"].(map[string]any)
	if !ok {
		t.Fatalf("champ threats attendu : %s", rec.Body.String())
	}
	if threats["domains"].(float64) != 0 {
		t.Fatalf("aucun passage : domains attendu 0, obtenu %v", threats["domains"])
	}
	// Après un passage réussi, le compte réel remonte.
	a2, st2 := newTunnelTest(t)
	dnsThreatStub(t, map[string]string{
		"https://urlhaus.abuse.ch/downloads/text/": "https://malware.example/a\n",
		"https://openphish.com/feed.txt":           "https://phish.example/x\n",
	})
	a2.RunDnsThreatsSweep()
	st2.Lock()
	dnsSeed(st2.Data())
	st2.Unlock()
	rec2 := httptest.NewRecorder()
	a2.handleDnsShieldMe(rec2, dnsReq(http.MethodGet, "/api/dnsshield/me", ""))
	if rec2.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec2.Code)
	}
	var out2 map[string]any
	_ = json.Unmarshal(rec2.Body.Bytes(), &out2)
	threats2, _ := out2["threats"].(map[string]any)
	if threats2 == nil || threats2["domains"].(float64) != 2 {
		t.Fatalf("après passage : domains attendu 2, obtenu %v — %s", threats2, rec2.Body.String())
	}
	if _, ok := threats2["updatedAt"].(string); !ok {
		t.Fatal("updatedAt (RFC3339) attendu dans threats")
	}
}

func TestDnsThreatsFeedLineGarbageTolerated(t *testing.T) {
	// Une ligne avariée (binaire, vide, hors alphabet) n'abîme JAMAIS le
	// passage : l'agrégat prend ce qui est bon et continue.
	a, _ := newTunnelTest(t)
	dnsThreatReset(t)
	dnsThreatStub(t, map[string]string{
		"https://urlhaus.abuse.ch/downloads/text/": "\x00\x01 garbage\n\n###\n",
		"https://openphish.com/feed.txt":           "https://phish.example/x\n",
	})
	a.RunDnsThreatsSweep()
	if n, _ := dnsshield.ThreatStats(); n != 1 {
		t.Fatalf("attendu 1 hôte valide, obtenu %d", n)
	}
	if !strings.Contains("phish.example", "phish") {
		t.Fatal("sanity")
	}
}
