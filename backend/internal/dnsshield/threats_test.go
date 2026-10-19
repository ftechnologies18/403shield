// threats_test.go — N°343 — tests de l'agrégat de menaces : parsing des
// flux (URL complète, hôte nu, port, userinfo, IP ignorées, casse,
// commentaires, doublons), sémantique du domaine COMPLET (attaquant.github.io
// ≠ autre.github.io), plafond mémoire, et l'état honnête de ThreatStats.
package dnsshield

import (
	"strings"
	"testing"
	"time"
)

// resetThreats — chaque test repart d'un état explicite (la discipline du
// package : le set est un état de package partagé, les tests le posent
// AVANT d'asserter — jamais de dépendance à l'ordre d'exécution).
func resetThreats(t *testing.T, domains ...string) {
	t.Helper()
	SetThreatSet(domains, time.Now().UTC())
	t.Cleanup(func() { SetThreatSet(nil, time.Time{}) })
}

func TestParseThreatFeedHosts(t *testing.T) {
	feed := strings.Join([]string{
		"# commentaire URLhaus",
		"https://malware.example/payload.exe",
		"http://Phish.Example:8080/login",
		"phish.example",                  // hôte nu (certaines lignes OpenPhish)
		"https://malware.example/autre",  // doublon → dédup
		"http://user:pass@gwd.example/x", // userinfo
		"https://192.0.2.1/srv.exe",      // IP nue → ignorée
		"2001:db8::1",                    // IP v6 nue → ignorée
		"hxxp://defig.example/pane",      // schéma défiguré → toléré
		"",                               // ligne vide → ignorée
	}, "\n")
	got := ParseThreatFeed(strings.NewReader(feed))
	want := []string{"malware.example", "phish.example", "gwd.example", "defig.example"}
	if len(got) != len(want) {
		t.Fatalf("attendu %d hôtes, obtenu %d : %v", len(want), len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("hôte %d : attendu %s, obtenu %s", i, want[i], got[i])
		}
	}
}

func TestParseThreatFeedRejectsExotic(t *testing.T) {
	// Caractères hors alphabet (soulignement, majuscule déjà baissée, unicode)
	// : une ligne invalide est IGNORÉE, jamais un crash du balayage.
	feed := "under_score.example\nexemple-invalide!.net\nbon.example\n"
	got := ParseThreatFeed(strings.NewReader(feed))
	if len(got) != 1 || got[0] != "bon.example" {
		t.Fatalf("attendu [bon.example], obtenu %v", got)
	}
}

func TestThreatListedFullDomainSemantics(t *testing.T) {
	resetThreats(t, "attaquant.github.io", "phish.example")
	cases := []struct {
		domain string
		want   bool
		why    string
	}{
		{"attaquant.github.io", true, "égalité exacte"},
		{"www.attaquant.github.io", true, "sous-domaine direct"},
		{"a.b.attaquant.github.io", true, "sous-domaine profond"},
		{"attaquant.github.io.", true, "FQDN point final toléré"},
		{"AUTRE.github.io", false, "frère jamais bloqué — précision hébergeur partagé"},
		{"github.io", false, "le domaine enregistrable n'est jamais dérivé"},
		{"phish.example", true, "second hôte listé"},
		{"inconnu.example", false, "non listé"},
		{"", false, "vide"},
	}
	for _, c := range cases {
		if got := ThreatListed(c.domain); got != c.want {
			t.Errorf("%s : attendu %v (%s), obtenu %v", c.domain, c.want, c.why, got)
		}
	}
}

func TestThreatListedEmptyState(t *testing.T) {
	// État de démarrage honnête : set vide (jamais publié) → rien de listé.
	SetThreatSet(nil, time.Time{})
	defer SetThreatSet(nil, time.Time{})
	if ThreatListed("phish.example") {
		t.Fatal("set vide : rien ne doit être listé")
	}
	if n, _ := ThreatStats(); n != 0 {
		t.Fatalf("set vide : compte attendu 0, obtenu %d", n)
	}
}

func TestSetThreatSetCap(t *testing.T) {
	defer SetThreatSet(nil, time.Time{})
	big := make([]string, MaxThreatDomains+50)
	for i := range big {
		big[i] = "h" + itoaThreat(i) + ".example"
	}
	n := SetThreatSet(big, time.Now().UTC())
	if n != MaxThreatDomains {
		t.Fatalf("plafond : attendu %d, obtenu %d", MaxThreatDomains, n)
	}
	if _, at := ThreatStats(); at.IsZero() {
		t.Fatal("l'instant de publication doit être posé")
	}
}

func TestSetThreatSetNormalizes(t *testing.T) {
	defer SetThreatSet(nil, time.Time{})
	n := SetThreatSet([]string{"  Phish.EXAMPLE.  ", "", "phish.example"}, time.Now().UTC())
	if n != 1 {
		t.Fatalf("normalisation + dédup : attendu 1, obtenu %d", n)
	}
	if !ThreatListed("phish.example") {
		t.Fatal("l'hôte normalisé doit être listé")
	}
}

// itoaThreat — petit itoa local (le package reste sans dépendance).
func itoaThreat(n int) string {
	if n == 0 {
		return "0"
	}
	b := [12]byte{}
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
