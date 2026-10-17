// wglan_test.go — N°315 — tests des commandes Accès Pro / LAN étendu
// (wg_lan_detect + wg_lan, design D-B1 briques 1 et 3). La forme des scripts
// RouterOS est CONTRACTUELLE (le routeur exécute ce qui est généré) :
// lecture pure pour la détection, règles marquées mikcloud-wg-lan scopées
// aux peers Pro pour l'application, KO honnête sur valeur avariée (aucune
// règle embarquant un motif inattendu — anti-injection aux deux bords).
package agent

import (
	"strings"
	"testing"

	"mikcloud/hotspot-api/internal/model"
)

// TestValidWgLanCIDR — la règle des sous-réseaux LAN étendus : /24 STRICT,
// dernier octet 0, RFC1918, et TOUT 10.8.0.0/16 REFUSÉ (espace du pool
// tunnel — un chevauchement casserait le cryptokey routing de wg0).
func TestValidWgLanCIDR(t *testing.T) {
	good := []string{
		"192.168.88.0/24", "192.168.0.0/24", "192.168.200.0/24",
		"10.10.0.0/24", "10.50.7.0/24", "10.200.0.0/24",
		"172.16.0.0/24", "172.20.5.0/24", "172.31.255.0/24",
	}
	for _, s := range good {
		if !ValidWgLanCIDR(s) {
			t.Errorf("ValidWgLanCIDR(%q) = false, attendu true", s)
		}
	}
	bad := []string{
		"", "192.168.88.0", "192.168.88.1/24", "192.168.88.0/16", "192.168.88.0/23",
		// Espace tunnel : segments v4 + marge future — TOUT 10.8.x.x refusé.
		"10.8.0.0/24", "10.8.1.0/24", "10.8.2.0/24", "10.8.9.0/24", "10.8.200.0/24",
		// Public / loopback / multicast / hors RFC1918.
		"8.8.8.0/24", "1.1.1.0/24", "100.64.0.0/24", "172.32.0.0/24", "172.15.0.0/24",
		"192.169.0.0/24", "0.0.0.0/24", "255.255.255.0/24",
		// Injections et malformations.
		"192.168.88.0/24; drop all", "192.168.88.0/24\n", " 192.168.88.0/24 ",
		"192.168.088.0/24", "300.168.88.0/24", "192.168.999.0/24",
	}
	for _, s := range bad {
		if ValidWgLanCIDR(s) {
			t.Errorf("ValidWgLanCIDR(%q) = true, attendu false", s)
		}
	}
}

// TestBuildWgLanDetectShape — la détection est une LECTURE PURE : aucun
// /ip firewall, aucun /ip address add, aucune écriture — seulement la
// lecture d'interface (pattern ppp_provision) et le fetch de rapport.
func TestBuildWgLanDetectShape(t *testing.T) {
	b := Builder{BaseURL: "https://cloud.example", Token: "tk"}
	s := b.buildWgLanDetect(model.Command{ID: "c1", Kind: model.CmdWgLanDetect})

	// Détection bridge-puis-ether (heuristique ppp_provision N°310).
	if !strings.Contains(s, "type=bridge") || !strings.Contains(s, "type=ether") {
		t.Fatalf("heuristique bridge/ether absente du script de détection :\n%s", s)
	}
	// LECTURE PURE : aucune écriture de config.
	for _, forbidden := range []string{"/ip firewall filter add", "/ip firewall nat add", "/ip address add", "/interface/wireguard peers add"} {
		if strings.Contains(s, forbidden) {
			t.Fatalf("écriture inattendue dans une détection LECTURE PURE (%q) :\n%s", forbidden, s)
		}
	}
	// Rapport dynamique : le fetch porte cmd + lan + iface (pattern ppp_provision).
	if !strings.Contains(s, "cmd=c1&status=ok&lan=") || !strings.Contains(s, "&iface=") {
		t.Fatalf("rapport lan/iface absent du fetch :\n%s", s)
	}
	// Le /24 est dérivé CÔTÉ ROUTEUR (découpe avant le 3e point + «.0/24»).
	if !strings.Contains(s, `".0/24"`) {
		t.Fatalf("dérivation du /24 absente :\n%s", s)
	}
}

// TestBuildWgLanShape — les règles marquées mikcloud-wg-lan : remove-then-add
// idempotent par marqueur, UNE règle forward + UNE règle srcnat PAR peer Pro,
// périmètre SCOPÉ aux peers listés (jamais le /24 remote entier), rapport au
// compte de règles.
func TestBuildWgLanShape(t *testing.T) {
	b := Builder{BaseURL: "https://cloud.example", Token: "tk"}
	cmd := model.Command{ID: "c2", Kind: model.CmdWgLan,
		Payload: WgLanPayloadFrom("192.168.88.0/24", []string{"10.8.2.5", "10.8.2.9"})}
	s := b.buildWgLan(cmd)

	// Remove-then-add par marqueur (idempotence pattern pooldoctor/wg_setup).
	if !strings.Contains(s, `/ip firewall filter remove [find comment="`+WgLanMarker+`"]`) {
		t.Fatalf("retrait filter marqué absent :\n%s", s)
	}
	if !strings.Contains(s, `/ip firewall nat remove [find comment="`+WgLanMarker+`"]`) {
		t.Fatalf("retrait nat marqué absent :\n%s", s)
	}
	// Une règle forward + une srcnat PAR peer, scopées /32.
	if got := strings.Count(s, "chain=forward"); got != 2 {
		t.Fatalf("règles forward attendues : 2 (une par peer), eu %d", got)
	}
	if got := strings.Count(s, "chain=srcnat"); got != 2 {
		t.Fatalf("règles srcnat attendues : 2 (une par peer), eu %d", got)
	}
	for _, peer := range []string{"10.8.2.5", "10.8.2.9"} {
		if !strings.Contains(s, `src-address="`+peer+`/32" dst-address="192.168.88.0/24"`) {
			t.Fatalf("règle scopée manquante pour le peer %s :\n%s", peer, s)
		}
	}
	// JAMAIS le /24 remote entier comme source (périmètre produit, pas porte).
	if strings.Contains(s, `src-address="10.8.2.0/24"`) {
		t.Fatalf("périmètre /24 remote entier interdit (scopage peers Pro attendu) :\n%s", s)
	}
	// Masquerade (brique 3 : les hôtes LAN répondent au routeur).
	if !strings.Contains(s, "action=masquerade") {
		t.Fatalf("action=masquerade absente :\n%s", s)
	}
	// Rapport : compte de règles marquées (vérité routeur) — le cidr et la
	// liste de peers partent ÉCHAPPÉS en http-data (urlEscape, «/» → %2F).
	if !strings.Contains(s, "&status=ok&rules=") || !strings.Contains(s, "&lan=192.168.88.0%2F24") {
		t.Fatalf("rapport règles/lan absent :\n%s", s)
	}
	if !strings.Contains(s, "&peers=10.8.2.5%2C10.8.2.9") {
		t.Fatalf("rapport peers absent :\n%s", s)
	}
}

// TestBuildWgLanRefusesInvalid — défense aux deux bords : LAN ou peers
// avariés → script KO honnête, AUCUNE règle posée, aucune valeur hostile
// embarquée (anti-injection).
func TestBuildWgLanRefusesInvalid(t *testing.T) {
	b := Builder{BaseURL: "https://cloud.example", Token: "tk"}
	cases := []model.Command{
		{ID: "c3", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("10.8.2.0/24", []string{"10.8.2.5"})},                                                                                                         // espace tunnel
		{ID: "c4", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("192.168.88.0/24; drop all", []string{"10.8.2.5"})},                                                                                           // injection
		{ID: "c5", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("192.168.88.0/24", []string{"10.8.1.7"})},                                                                                                     // peer B2C
		{ID: "c6", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("192.168.88.0/24", []string{})},                                                                                                               // zéro peer
		{ID: "c7", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("192.168.88.0/24", []string{"10.8.2.5", "10.8.2.6", "10.8.2.7", "10.8.2.8", "10.8.2.9", "10.8.2.10", "10.8.2.11", "10.8.2.12", "10.8.2.13"})}, // > MaxWgLanPeers
	}
	for _, cmd := range cases {
		s := b.buildWgLan(cmd)
		if strings.Contains(s, "/ip firewall filter add") || strings.Contains(s, "/ip firewall nat add") {
			t.Fatalf("règle posée malgré un payload avarié (cmd %s) :\n%s", cmd.ID, s)
		}
		if !strings.Contains(s, "status=error") && !strings.Contains(s, "lan ou peers invalides") {
			t.Fatalf("rapport KO honnête attendu (cmd %s) :\n%s", cmd.ID, s)
		}
	}
	// L'injection ne doit JAMAIS transiter dans le script, même en KO.
	evil := b.buildWgLan(model.Command{ID: "c8", Kind: model.CmdWgLan, Payload: WgLanPayloadFrom("192.168.88.0/24; drop all", []string{"10.8.2.5"})})
	if strings.Contains(evil, "drop all") {
		t.Fatalf("motif hostile embarqué dans le script KO :\n%s", evil)
	}
}
