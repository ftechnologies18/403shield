// Tests N°285 — renfort WireGuard : validations + forme des scripts .rsc.
// La forme est CONTRACTUELLE (le routeur exécute ce qui est généré) : chaque
// assertion est un incident évité (injection, guillemets, valeurs non
// échappées, rapport au mauvais endpoint). N°312 — allowedSources : la
// liste ÉLARGIE par compte (supervision remote) et son repli conservateur.
package agent

import (
	"strings"
	"testing"

	"mikcloud/hotspot-api/internal/model"
)

const wgTestKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

func TestValidWgKey(t *testing.T) {
	good := []string{
		wgTestKey,
		"6Ke9fJ1aGVwTx1sJlP5YhUw0t6B7R3QaQZ8mOa9V2Xk=",
		"abcdefghijklmnopqrstuvwxyz01234567890123456=",
	}
	for _, s := range good {
		if !ValidWgKey(s) {
			t.Errorf("ValidWgKey(%q) = false, attendu true", s)
		}
	}
	bad := []string{
		"",
		"court=",
		"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",   // 44 sans '='
		"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", // 45
		"AAAA!AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
		"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=A", // 45
	}
	for _, s := range bad {
		if ValidWgKey(s) {
			t.Errorf("ValidWgKey(%q) = true, attendu false", s)
		}
	}
}

func TestValidWgIPv4(t *testing.T) {
	for _, s := range []string{"10.8.0.2", "10.8.0.254", "10.8.0.100"} {
		if !ValidWgIPv4(s) {
			t.Errorf("ValidWgIPv4(%q) = false, attendu true", s)
		}
	}
	for _, s := range []string{
		"", "10.8.0.1", "10.8.0.255", "10.8.0.0", "10.8.0.999",
		"10.8.1.5", "10.8.0.2/32", "192.168.1.5", "10.8.0.abc", "10.8.0.",
	} {
		if ValidWgIPv4(s) {
			t.Errorf("ValidWgIPv4(%q) = true, attendu false", s)
		}
	}
}

func TestValidWgPeerName(t *testing.T) {
	for _, s := range []string{"a", "cyber-espace-1", "r-0123456789ab", "x2345678901234567890123456789012"} {
		if !ValidWgPeerName(s) {
			t.Errorf("ValidWgPeerName(%q) = false, attendu true", s)
		}
	}
	for _, s := range []string{"", "-abc", "Achat", "up_per", "32chars3256748392012345678901234567890", "péage"} {
		if ValidWgPeerName(s) {
			t.Errorf("ValidWgPeerName(%q) = true, attendu false", s)
		}
	}
}

func TestValidWgHost(t *testing.T) {
	for _, s := range []string{"203.0.113.10", "api.mikcloud.ftci.fr", "a.b"} {
		if !ValidWgHost(s) {
			t.Errorf("ValidWgHost(%q) = false, attendu true", s)
		}
	}
	for _, s := range []string{"", "deux mots", "injection\"; do bad", "host\nname", strings.Repeat("a", 254)} {
		if ValidWgHost(s) {
			t.Errorf("ValidWgHost(%q) = true, attendu false", s)
		}
	}
}

func TestWgPeerNameSuggestion(t *testing.T) {
	cases := []struct {
		name, id, want string
	}{
		{"Cyber Espace", "r-abcd1234", "cyber-espace"},
		{"ProMax_2", "r-xyz", "promax-2"},
		{"**", "r-9876fedc5432", "r-9876fedc5432"}, // repli : suffixe d'ID
		{"Château d'eau", "r-1", "ch-teau-d-eau"},  // accents → tirets (SanitizeName)
	}
	for _, c := range cases {
		got := WgPeerNameSuggestion(c.name, c.id)
		if got != c.want {
			t.Errorf("WgPeerNameSuggestion(%q, %q) = %q, attendu %q", c.name, c.id, got, c.want)
		}
		if !ValidWgPeerName(got) {
			t.Errorf("suggestion %q invalide pour wg-peer.sh", got)
		}
	}
}

func TestScriptForWgKinds(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok-token"}
	cmds := []string{model.CmdWgKeygen, model.CmdWgSetup, model.CmdWgTeardown}
	for _, kind := range cmds {
		cmd := model.Command{ID: "cmd-ab1", Kind: kind, Payload: map[string]any{
			"peerPub": wgTestKey, "psk": wgTestKey, "address": "10.8.0.7/32",
			"endpointHost": "203.0.113.10", "endpointPort": 51820,
		}}
		s, err := b.ScriptFor(cmd)
		if err != nil {
			t.Fatalf("ScriptFor(%s) : %v", kind, err)
		}
		if !strings.HasPrefix(s, "# mikcloud cmd cmd-ab1 "+kind) {
			t.Errorf("header manquant pour %s", kind)
		}
		if !strings.Contains(s, "/agent/result?token=tok-token") {
			t.Errorf("rapport result manquant pour %s", kind)
		}
	}
}

func TestBuildWgKeygenShape(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok"}
	s := b.buildWgKeygen(model.Command{ID: "c1", Kind: model.CmdWgKeygen})
	for _, want := range []string{
		`/interface/wireguard find name="mikcloud-wg"`,
		"/interface/wireguard add name=mikcloud-wg listen-port=13231",
		`comment="mikcloud-wg"`,
		"public-key",
		"&status=ok&wgpub=",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("buildWgKeygen : %q absent", want)
		}
	}
}

func TestBuildWgSetupShape(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok"}
	cmd := model.Command{ID: "c2", Kind: model.CmdWgSetup, Payload: WgSetupPayloadFrom(
		wgTestKey, wgTestKey, "10.8.0.9/32", "203.0.113.10", 51820, "")}
	s := b.buildWgSetup(cmd)
	for _, want := range []string{
		`public-key="` + wgTestKey + `"`,
		`preshared-key="` + wgTestKey + `"`,
		`endpoint-address="203.0.113.10"`,
		"endpoint-port=51820",
		"allowed-address=10.8.0.1/32",
		"persistent-keepalive=25",
		`address="10.8.0.9/32"`,
		`comment="mikcloud-wg"`,
		"&status=ok&peers=",
		// N°344 — pare-feu du pilotage direct : address-list (socle par
		// défaut) + règle input marquée + écho fw dans le rapport.
		"/ip firewall address-list add list=mikcloud-wg-src address=10.8.0.1/32",
		`/ip firewall filter add chain=input action=accept in-interface=mikcloud-wg src-address-list=mikcloud-wg-src place-before=0 comment="mikcloud-wg-in"`,
		`&fw=". $`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("buildWgSetup : %q absent", want)
		}
	}
	// Anti-injection : un guillemet dans un payload ne doit pas survivre
	// (rosEscape transforme « " » en « \" » — jamais de rupture de citation).
	cmd2 := model.Command{ID: "c3", Kind: model.CmdWgSetup, Payload: WgSetupPayloadFrom(
		wgTestKey, wgTestKey, "10.8.0.9/32", `evil"$(bad)`, 51820, "")}
	s2 := b.buildWgSetup(cmd2)
	if strings.Contains(s2, `endpoint-address="evil"`) {
		t.Error("buildWgSetup : injection possible via endpointHost non échappé")
	}
}

// TestBuildWgSetupAllowedSources — N°312 — l'élargissement par compte :
// socle + IP des peers remote, séparées par virgules, SANS guillemets ni
// échappement (la validation garantit l'alphabet 10.8.0.N/32 et, depuis
// N°313, 10.8.2.N/32 — peers remote frais du segment dédié).
func TestBuildWgSetupAllowedSources(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok"}
	cmd := model.Command{ID: "c5", Kind: model.CmdWgSetup, Payload: WgSetupPayloadFrom(
		wgTestKey, wgTestKey, "10.8.0.9/32", "203.0.113.10", 51820,
		"10.8.0.1/32,10.8.0.7/32,10.8.0.12/32")}
	s := b.buildWgSetup(cmd)
	if !strings.Contains(s, "allowed-address=10.8.0.1/32,10.8.0.7/32,10.8.0.12/32") {
		t.Error("buildWgSetup : allowed-address élargi absent/mal formé")
	}
	// N°313 — peers remote frais (segment 10.8.2.0/24) mêlés aux
	// historiques : la liste traverse telle quelle.
	mix := model.Command{ID: "c7", Kind: model.CmdWgSetup, Payload: WgSetupPayloadFrom(
		wgTestKey, wgTestKey, "10.8.0.9/32", "203.0.113.10", 51820,
		"10.8.0.1/32,10.8.2.7/32")}
	if got := b.buildWgSetup(mix); !strings.Contains(got, "allowed-address=10.8.0.1/32,10.8.2.7/32") {
		t.Errorf("buildWgSetup : allowed-address multi-segments absent/mal formé\n%s", got)
	}
	// Payload ANTÉRIEUR (aucune clé allowedSources) : socle seul — le
	// comportement N°285 reste identifiable au byte près.
	old := model.Command{ID: "c6", Kind: model.CmdWgSetup, Payload: map[string]any{
		"peerPub": wgTestKey, "psk": wgTestKey, "address": "10.8.0.9/32",
		"endpointHost": "203.0.113.10", "endpointPort": 51820,
	}}
	if got := b.buildWgSetup(old); !strings.Contains(got, "allowed-address=10.8.0.1/32 ") {
		t.Error("buildWgSetup : payload antérieur sans allowedSources doit retomber sur le socle")
	}
}

// TestBuildWgSetupFirewall — N°344 — le pare-feu du pilotage direct suit la
// liste PAR COMPTE : chaque item de l'allowed-address devient UNE entrée de
// l'address-list mikcloud-wg-src (socle VM + peers remote du compte —
// l'isolation inter-comptes du cryptokey routing, ceinture ET bretelles
// côté pare-feu routeur). Un item mal formé ne peut JAMAIS y figurer (la
// liste est passée par SanitizeWgAllowedSources AVANT la boucle).
func TestBuildWgSetupFirewall(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok"}
	cmd := model.Command{ID: "c8", Kind: model.CmdWgSetup, Payload: WgSetupPayloadFrom(
		wgTestKey, wgTestKey, "10.8.0.9/32", "203.0.113.10", 51820,
		"10.8.0.1/32,10.8.2.5/32,10.8.2.7/32")}
	s := b.buildWgSetup(cmd)
	for _, want := range []string{
		"/ip firewall address-list add list=mikcloud-wg-src address=10.8.0.1/32 comment=mikcloud-wg-src",
		"/ip firewall address-list add list=mikcloud-wg-src address=10.8.2.5/32 comment=mikcloud-wg-src",
		"/ip firewall address-list add list=mikcloud-wg-src address=10.8.2.7/32 comment=mikcloud-wg-src",
		"/ip firewall address-list remove [find list=mikcloud-wg-src]",
		`/ip firewall filter remove [find comment="mikcloud-wg-in"]`,
		`src-address-list=mikcloud-wg-src place-before=0 comment="mikcloud-wg-in"`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("buildWgSetup pare-feu : %q absent\n%s", want, s)
		}
	}
	// Le ménage précède la pose (remove-then-add : idempotent au re-file).
	if strings.Index(s, "/ip firewall address-list remove") > strings.Index(s, "/ip firewall address-list add") {
		t.Error("buildWgSetup : le remove de l'address-list doit précéder les add")
	}
}

// TestSanitizeWgAllowedSources — le repli est TOUJOURS conservateur : toute
// liste mal formée retombe sur le socle seul (jamais une porte plus ouverte
// que prévu — frontière cloud → routeur).
func TestSanitizeWgAllowedSources(t *testing.T) {
	ok := map[string]string{
		"":                            "10.8.0.1/32",
		"10.8.0.1/32":                 "10.8.0.1/32",
		"10.8.0.1/32,10.8.0.7/32":     "10.8.0.1/32,10.8.0.7/32",
		" 10.8.0.1/32 , 10.8.0.7/32 ": "10.8.0.1/32,10.8.0.7/32", // espaces tolérés
		// N°313 — segment remote frais : accepté, mêlé aux historiques.
		"10.8.0.1/32,10.8.2.7/32":             "10.8.0.1/32,10.8.2.7/32",
		"10.8.0.1/32,10.8.2.7/32,10.8.0.9/32": "10.8.0.1/32,10.8.2.7/32,10.8.0.9/32",
	}
	for in, want := range ok {
		if got := SanitizeWgAllowedSources(in); got != want {
			t.Errorf("SanitizeWgAllowedSources(%q) = %q, attendu %q", in, got, want)
		}
	}
	// Socle ABSENT de la liste : repli (on ne referme jamais la porte de gestion).
	if got := SanitizeWgAllowedSources("10.8.0.7/32"); got != "10.8.0.1/32" {
		t.Errorf("socle absent : %q, attendu le repli 10.8.0.1/32", got)
	}
	// Items mal formés / hors du sous-réseau tunnel / dupliqués : repli.
	for _, bad := range []string{
		"10.8.0.1/32,192.168.88.0/24",                      // hors tunnel : refus net
		"10.8.0.1/32,10.8.0.7",                             // préfixe manquant
		"10.8.0.1/32,10.8.0.999/32",                        // N hors bornes (regex)
		"10.8.0.1/32,10.8.0.7/32,10.8.0.7/32",              // doublon
		"10.8.0.1/32,; drop all",                           // injection
		"10.8.0.0/24,10.8.0.1/32",                          // jamais de /24 élargi
		"10.8.0.1/32,10.8.1.7/32",                          // N°313 : segment B2C — REFUSÉ (un peer vendu ne supervise rien)
		"10.8.0.1/32,10.8.2.999/32",                        // segment remote, N hors bornes
		strings.Repeat("10.8.0.1/32,", 40) + "10.8.0.1/32", // trop longue
	} {
		if got := SanitizeWgAllowedSources(bad); got != "10.8.0.1/32" {
			t.Errorf("SanitizeWgAllowedSources(%q) = %q, attendu le repli", bad, got)
		}
	}
}

// TestValidWgSupervisionIP — N°313 — IP de peer « remote » : segments gestion
// (10.8.0.x, historique) et remote (10.8.2.x, frais) admis, N ∈ [2,254] ;
// segment B2C (10.8.1.x) et tout le reste refusés.
func TestValidWgSupervisionIP(t *testing.T) {
	for _, s := range []string{"10.8.0.2", "10.8.0.254", "10.8.2.7", "10.8.2.254"} {
		if !ValidWgSupervisionIP(s) {
			t.Errorf("ValidWgSupervisionIP(%q) = faux, attendu vrai", s)
		}
	}
	for _, s := range []string{
		"", "10.8.0.1", "10.8.0.255", "10.8.2.1", "10.8.2.255", "10.8.2.0",
		"10.8.1.7", "10.8.1.254", "10.8.3.7", "10.9.0.7", "192.168.1.5",
		"10.8.0.7/32", "10.8.2.7/32", "10.8.02.7", "10.8.2.999",
	} {
		if ValidWgSupervisionIP(s) {
			t.Errorf("ValidWgSupervisionIP(%q) = vrai, attendu faux", s)
		}
	}
}

func TestBuildWgTeardownShape(t *testing.T) {
	b := Builder{BaseURL: "https://api.mikcloud.ftci.fr", Token: "tok"}
	s := b.buildWgTeardown(model.Command{ID: "c4", Kind: model.CmdWgTeardown})
	for _, want := range []string{
		`/interface/wireguard peers remove [find interface=mikcloud-wg`,
		`/ip address remove [find interface=mikcloud-wg`,
		// N°344 — le démontage emporte AUSSI le pare-feu du pilotage direct
		// (règle marquée + address-list du compte) : aucun objet ne survit.
		`/ip firewall filter remove [find comment="mikcloud-wg-in"]`,
		`/ip firewall address-list remove [find list=mikcloud-wg-src]`,
		`/interface/wireguard remove [find name="mikcloud-wg"]`,
		"&removed=1",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("buildWgTeardown : %q absent", want)
		}
	}
}

func TestWgIPv4WithPrefix(t *testing.T) {
	if got := WgIPv4WithPrefix("10.8.0.9"); got != "10.8.0.9/32" {
		t.Errorf("WgIPv4WithPrefix simple = %q", got)
	}
	if got := WgIPv4WithPrefix("10.8.0.9/32"); got != "10.8.0.9/32" {
		t.Errorf("WgIPv4WithPrefix déjà préfixé = %q", got)
	}
	if got := WgIPv4WithPrefix(""); got != "" {
		t.Errorf("WgIPv4WithPrefix vide = %q", got)
	}
}
