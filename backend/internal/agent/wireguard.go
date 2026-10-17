// N°285 — renfort WireGuard des routeurs agents (opt-in, par routeur).
//
// Le mode agent reste LE SOCLE (check-in HTTPS 100 % sortant, TLS strict,
// anti-orphan) — le tunnel WireGuard ajouté ici n'est JAMAIS sur le chemin
// critique du check-in : si le tunnel meurt, le routeur reste géré au pas
// du scheduler (doctrine agent_migrate N°230). WireGuard apporte un
// deuxième chemin routeur ↔ VM : chiffré, sans aucun port public côté
// routeur, franchit le CGNAT (le routeur initie le tunnel), et ouvre la
// porte au pilotage direct (API RouterOS 10.8.0.N:8728 à travers wg0).
//
// Cycle de vie (3 commandes, pattern remove-then-add idempotent) :
//   - wg_keygen   : le routeur génère SA paire de clés (interface
//     mikcloud-wg, marqueur comment="mikcloud-wg") et rapporte sa clé
//     publique — la clé privée ne quitte JAMAIS l'appareil ;
//   - wg_setup    : reçoit les valeurs du peer serveur (clé publique
//     serveur, PSK, adresse tunnel 10.8.0.N, endpoint) posées côté VM
//     par ops-wg/wg-peer.sh et collées dans la console — la PSK transite
//     sur le canal agent TLS strict (même surface que le token agent) ;
//   - wg_teardown : démontage propre (peer + adresse + interface).
//
// RouterOS ≥ 7.15 requis (paquet wireguard) — un parc antérieur rapporte
// une erreur claire et le cloud reste en mode agent pur (aucune régression).
package agent

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"mikcloud/hotspot-api/internal/model"
)

// WgIfaceName — nom de l'interface WireGuard créée sur le routeur.
const WgIfaceName = "mikcloud-wg"

// WgMarker — commentaire RouterOS de TOUS les objets posés par MikCloud
// (interface, peer, adresse) : l'idempotence et le ménage s'appuient dessus
// (pattern walled-garden N°29 : seules les règles marquées nous appartiennent).
const WgMarker = "mikcloud-wg"

// WgListenPort — port d'écoute WireGuard du routeur (sortant uniquement :
// le tunnel est initié par le routeur vers l'endpoint serveur, le port local
// n'est jamais exposé publiquement — CGNAT de toute façon).
const WgListenPort = 13231

// WgServerTunnelIP — adresse du serveur dans le tunnel (wg0 10.8.0.1/24,
// posée par ops-wg N°284). Socle PERMANENT de l'allowed-address du peer
// serveur : le tunnel reste d'abord un chemin de gestion vers l'hôte
// MikCloud. N°312 : la liste s'ÉLARGIT par compte avec les IP des peers
// « remote » du gérant (supervision B2B — cf. WgAllowedSourcesLocked côté
// api) ; sans peer remote, le comportement N°285 est identique au byte près.
// N°313 : les peers remote frais vivent sur le SEGMENT 10.8.2.0/24 (pool
// multi-segments D-T5) — le socle de gestion reste 10.8.0.1, inchangé.
const WgServerTunnelIP = "10.8.0.1"

// WgDefaultAllowedSources — la valeur de repli (et le socle) de la clé
// « allowedSources » du payload wg_setup : le chemin de gestion seul.
const WgDefaultAllowedSources = WgServerTunnelIP + "/32"

// WgKeepaliveSec — PersistentKeepalive du peer routeur : les routeurs clients
// sont derrière le NAT de l'opérateur (pattern N°284, 25 s recommandé).
const WgKeepaliveSec = 25

// ---------------------------------------------------------------------------
// Validations (defénse en profondeur — le handler re-valide, le builder
// re-sanitise : aucune valeur ne franchit les deux frontières non vérifiée)
// ---------------------------------------------------------------------------

var wgKeyRe = regexp.MustCompile(`^[A-Za-z0-9+/]{43}=$`)
var wgIPv4Re = regexp.MustCompile(`^10\.8\.0\.(\d{1,3})$`)
var wgPeerNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)
var wgHostRe = regexp.MustCompile(`^[A-Za-z0-9.-]{1,253}$`)

// N°313 — items de la liste allowedSources du peer serveur : /32 du segment
// GESTION (10.8.0.x — socle + peers remote posés avant la v4) OU du segment
// REMOTE (10.8.2.x — peers remote frais, wg-peer.sh v4). Le segment B2C
// (10.8.1.x) est REFUSÉ : un peer full-tunnel vendu ne supervise rien, il
// n'a rien à faire dans l'allowed-address d'un routeur.
var wgAllowedItemRe = regexp.MustCompile(`^10\.8\.[02]\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])/32$`)

// ValidWgKey — clé publique WireGuard (44 caractères base64 std, terminé « = »).
// Valide indifféremment une clé publique et une PresharedKey (même format).
func ValidWgKey(s string) bool { return wgKeyRe.MatchString(s) }

// ValidWgIPv4 — adresse tunnel d'un ROUTEUR : 10.8.0.N, N ∈ [2,254]
// (10.8.0.1 = le serveur, réservé). Les routeurs de gestion RESTENT sur le
// segment historique (wg-peer.sh v4 add-router, N°313).
func ValidWgIPv4(s string) bool {
	m := wgIPv4Re.FindStringSubmatch(s)
	if m == nil {
		return false
	}
	n, err := strconv.Atoi(m[1])
	return err == nil && n >= 2 && n <= 254
}

// ValidWgSupervisionIP — N°313 — adresse tunnel d'un peer « remote » (le
// gérant) : segment GESTION (10.8.0.x — peers posés avant la v4) ou segment
// REMOTE (10.8.2.x — peers frais, wg-peer.sh v4), N ∈ [2,254]. Le segment
// B2C (10.8.1.x) est REFUSÉ : les peers full-tunnel vendus ne figurent
// JAMAIS dans l'allowed-address du peer serveur d'un routeur (isolation
// produit — wgAllowedSourcesLocked filtre déjà par Kind, cette regex est la
// défense en profondeur du bord builder).
func ValidWgSupervisionIP(s string) bool {
	if s == "" {
		return false
	}
	m := strings.Split(s, ".")
	if len(m) != 4 {
		return false
	}
	if m[0] != "10" || m[1] != "8" || (m[2] != "0" && m[2] != "2") {
		return false
	}
	n, err := strconv.Atoi(m[3])
	return err == nil && n >= 2 && n <= 254
}

// ValidWgPeerName — nom du peer côté serveur (wg-peer.sh, [a-z0-9-], 1-32).
func ValidWgPeerName(s string) bool { return wgPeerNameRe.MatchString(s) }

// ValidWgHost — hôte d'endpoint (IPv4 ou nom d'hôte, sans espace ni guillemet).
func ValidWgHost(s string) bool { return wgHostRe.MatchString(s) }

// ValidWgPort — port d'endpoint (1-65535).
func ValidWgPort(p int) bool { return p >= 1 && p <= 65535 }

// wgLanRe — un sous-réseau LAN étendu : /24 STRICT, dernier octet 0, espace
// privé RFC1918 (10.x | 172.16-31.x | 192.168.x). N°315 (D-B1 brique 2).
var wgLanRe = regexp.MustCompile(`^(10\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])|172\.(1[6-9]|2\d|3[01])|192\.168)\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.0/24$`)

// ValidWgLanCIDR — N°315 — un sous-réseau LAN étendu au tunnel (caméras/NAS)
// : /24 privé RFC1918 STRICT (aucune espace, forme exacte — les trois
// frontières cloud/VM/backend valident la MÊME règle), HORS de l'espace du
// pool tunnel — tout 10.8.0.0/16 est REFUSÉ (les segments wg0 10.8.0/1/2
// sont réservés au tunnel lui-même : un LAN qui s'y chevaucherait casserait
// le cryptokey routing de wg0 et volerait les adresses du pool — fail-closed
// sur tout le /16, marge future comprise).
func ValidWgLanCIDR(s string) bool {
	if s == "" || !wgLanRe.MatchString(s) {
		return false
	}
	return !strings.HasPrefix(s, "10.8.")
}

// WgLanMarker — commentaire RouterOS des règles du LAN étendu (N°315) :
// filter forward + nat srcnat posées par la commande wg_lan — l'idempotence
// (remove-then-add) et le ménage s'appuient dessus (pattern mikcloud-wg /
// mikcloud-pool-nat).
const WgLanMarker = "mikcloud-wg-lan"

// MaxWgLanPeers — borne honnête du nombre de peers Pro scannés par la règle
// wg_lan (caméras/NAS) : un compte gérant a peu d'appareils Pro ; au-delà,
// l'application refuse proprement plutôt que de poser une table NAT délirante.
const MaxWgLanPeers = 8

// SanitizeWgAllowedSources — N°312 — valide/assainit la liste d'allowed-address
// du peer serveur (clé « allowedSources » du payload wg_setup) : items
// « 10.8.0.N/32 » (gestion + remote historiques) ou « 10.8.2.N/32 » (remote
// frais, N°313) séparés par des virgules. Toute valeur mal formée, liste
// vide ou trop longue (isolation : au plus 26 entrées — le socle + les
// MaxVpnPeersPerAccount peers remote, marge comprise) retombe sur le SOCLE
// seul (10.8.0.1/32) : le repli est TOUJOURS conservateur — jamais une porte
// plus ouverte que prévu (défense en profondeur, frontière cloud → routeur).
// Les adresses du segment B2C (10.8.1.x) sont refusées de la même façon :
// un peer full-tunnel vendu ne supervise rien.
func SanitizeWgAllowedSources(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return WgDefaultAllowedSources
	}
	items := strings.Split(raw, ",")
	if len(items) > 26 {
		return WgDefaultAllowedSources
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(items))
	for _, it := range items {
		it = strings.TrimSpace(it)
		if !wgAllowedItemRe.MatchString(it) || seen[it] {
			return WgDefaultAllowedSources
		}
		seen[it] = true
		out = append(out, it)
	}
	// Le socle (chemin de gestion) doit TOUJOURS figurer : sans lui le routeur
	// ne répond plus au ping tunnel ni à wg-test — on ne retire jamais la porte
	// de gestion en élargissant celle de supervision.
	if !seen[WgDefaultAllowedSources] {
		return WgDefaultAllowedSources
	}
	return strings.Join(out, ",")
}

// WgPeerNameSuggestion — nom de peer conseillé pour un routeur : dérivé du
// nom assaini (SanitizeName) en minuscules, tirets, charset wg-peer.sh ;
// préfixe « r » + suffixe d'ID en repli pour éviter les collisions entre
// routeurs homonymes de comptes différents (le pool de peers est GLOBAL
// à la VM, pas par compte).
func WgPeerNameSuggestion(name, routerID string) string {
	cand := strings.ToLower(SanitizeName(name))
	cand = strings.NewReplacer(" ", "-", "_", "-").Replace(cand)
	// SanitizeName garde [A-Za-z0-9._-] : retirer les points restants.
	cand = strings.ReplaceAll(cand, ".", "-")
	out := strings.Trim(cand, "-")
	if out == "" || !wgPeerNameRe.MatchString(out) {
		suffix := ""
		for i := len(routerID) - 1; i >= 0 && len(suffix) < 12; i-- {
			c := routerID[i]
			if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
				suffix = string(c) + suffix
			}
		}
		if suffix == "" {
			suffix = "peer"
		}
		out = "r-" + suffix
	}
	if len(out) > 32 {
		out = out[:32]
	}
	return out
}

// ---------------------------------------------------------------------------
// Builders — les trois commandes du renfort
// ---------------------------------------------------------------------------

// buildWgKeygen — crée (idempotent) l'interface mikcloud-wg et rapporte la
// clé publique générée par RouterOS. Un parc sans le paquet wireguard (ROS
// < 7.15) échoue au :do → rapport error clair « wireguard absent » : le
// cloud ne re-file PAS automatiquement (aucune boucle sur un routeur qui
// ne pourra jamais le faire — le gérant voit l'état « erreur »).
func (b Builder) buildWgKeygen(cmd model.Command) string {
	okVar := "ok" + idSafe(cmd.ID)
	p := "k" + idSafe(cmd.ID) // préfixe des variables locales (unicité inter-commandes d'un même import)
	var sb strings.Builder
	sb.WriteString(header(cmd))
	sb.WriteString(":local " + okVar + " true\n")
	sb.WriteString(":local " + p + "pub \"\"\n")
	sb.WriteString(":do {\n")
	sb.WriteString("  :if ([:len [/interface/wireguard find name=\"" + WgIfaceName + "\"]] = 0) do={\n")
	sb.WriteString("    /interface/wireguard add name=" + WgIfaceName + " listen-port=" + strconv.Itoa(WgListenPort) + " comment=\"" + WgMarker + "\"\n")
	sb.WriteString("  }\n")
	sb.WriteString("  :do { /interface/wireguard set " + WgIfaceName + " listen-port=" + strconv.Itoa(WgListenPort) + " } on-error={}\n")
	sb.WriteString("  :set " + p + "pub [/interface/wireguard get " + WgIfaceName + " public-key]\n")
	sb.WriteString("} on-error={ :set " + okVar + " false; :log warning \"403Shield: WireGuard indisponible sur ce routeur (RouterOS 7.15+ requis)\" }\n")
	// Rapport dynamique : la clé publique est lue côté routeur (vérité routeur).
	ok := `/tool fetch url="` + strings.TrimRight(b.BaseURL, "/") + `/agent/result?token=` + urlEscape(b.Token) +
		`" http-method=post http-data=("cmd=` + cmd.ID + `&status=ok&wgpub=". $` + p + `pub) output=none`
	ko := b.reportLine(cmd.ID, false, map[string]string{"message": "wireguard indisponible sur ce routeur (RouterOS 7.15+ requis)"})
	sb.WriteString(":if ($" + okVar + ") do={\n  " + ok + "\n} else={\n  " + ko + "\n}\n")
	return sb.String()
}

// buildWgSetup — configure le peer serveur + l'adresse tunnel (idempotent,
// remove-then-add par marqueur). Valeurs reçues : peerPub (clé publique
// SERVEUR), psk, address (10.8.0.N/32), endpointHost, endpointPort, et
// allowedSources (N°312 — liste allowed-address du peer serveur : socle
// 10.8.0.1/32 + IP des peers « remote » du compte ; absente = socle seul,
// rétro-compatible avec tout payload antérieur).
// Le rapport échoe le compte de peers marqués attendu (1) : vérité routeur.
func (b Builder) buildWgSetup(cmd model.Command) string {
	peerPub := rosEscape(strings.TrimSpace(plStr(cmd.Payload, "peerPub")))
	psk := rosEscape(strings.TrimSpace(plStr(cmd.Payload, "psk")))
	addr := strings.TrimSpace(plStr(cmd.Payload, "address"))
	epHost := strings.TrimSpace(plStr(cmd.Payload, "endpointHost"))
	epPort := int(plInt64(cmd.Payload, "endpointPort"))
	allowed := SanitizeWgAllowedSources(plStr(cmd.Payload, "allowedSources"))
	if epPort == 0 {
		epPort = 51820
	}
	okVar := "ok" + idSafe(cmd.ID)
	p := "s" + idSafe(cmd.ID)
	var sb strings.Builder
	sb.WriteString(header(cmd))
	sb.WriteString(":local " + okVar + " true\n")
	sb.WriteString(":do {\n")
	sb.WriteString("  :if ([:len [/interface/wireguard find name=\"" + WgIfaceName + "\"]] = 0) do={\n")
	sb.WriteString("    /interface/wireguard add name=" + WgIfaceName + " listen-port=" + strconv.Itoa(WgListenPort) + " comment=\"" + WgMarker + "\"\n")
	sb.WriteString("  }\n")
	// Peer serveur : remove-then-add par marqueur (idempotent — un re-file
	// zombie N°73 reconverge, jamais de doublon). N°312 — allowed-address
	// ÉLARGI par compte (société + supervision) : la valeur est déjà
	// assainie (items 10.8.0.N/32, virgules — aucun métacaractère RouterOS).
	sb.WriteString("  :do { /interface/wireguard peers remove [find interface=" + WgIfaceName + " comment=\"" + WgMarker + "\"] } on-error={}\n")
	sb.WriteString("  /interface/wireguard peers add interface=" + WgIfaceName + " name=\"" + WgMarker + "-srv\" public-key=\"" + peerPub + "\" preshared-key=\"" + psk + "\" endpoint-address=\"" + rosEscape(epHost) + "\" endpoint-port=" + strconv.Itoa(epPort) + " allowed-address=" + allowed + " persistent-keepalive=" + strconv.Itoa(WgKeepaliveSec) + " comment=\"" + WgMarker + "\"\n")
	// Adresse tunnel : remove-then-add par marqueur.
	sb.WriteString("  :do { /ip address remove [find interface=" + WgIfaceName + " comment=\"" + WgMarker + "\"] } on-error={}\n")
	sb.WriteString("  /ip address add interface=" + WgIfaceName + " address=\"" + rosEscape(addr) + "\" comment=\"" + WgMarker + "\"\n")
	sb.WriteString("} on-error={ :set " + okVar + " false }\n")
	// Rapport : le compte de peers marqués (vérité routeur — le cloud n'accepte
	// « active » que sur ce compte == 1) + l'adresse appliquée (echo).
	sb.WriteString(":local " + p + "n 0\n")
	sb.WriteString(":do { :foreach " + p + "p in=[/interface/wireguard peers find where interface=" + WgIfaceName + " comment=\"" + WgMarker + "\"] do={ :set " + p + "n ($" + p + "n + 1) } } on-error={}\n")
	ok := `/tool fetch url="` + strings.TrimRight(b.BaseURL, "/") + `/agent/result?token=` + urlEscape(b.Token) +
		`" http-method=post http-data=("cmd=` + cmd.ID + `&status=ok&peers=". $` + p + `n . "&addr=` + urlEscape(addr) + `") output=none`
	ko := b.reportLine(cmd.ID, false, map[string]string{"message": "configuration WireGuard refusee par le routeur"})
	sb.WriteString(":if ($" + okVar + ") do={\n  " + ok + "\n} else={\n  " + ko + "\n}\n")
	return sb.String()
}

// buildWgTeardown — démontage propre (best-effort chaque étape : un objet
// déjà absent ne doit pas empêcher le ménage du suivant), le rapport est ok
// dès que le script s'exécute (l'absence totale = état convergé).
func (b Builder) buildWgTeardown(cmd model.Command) string {
	okVar := "ok" + idSafe(cmd.ID)
	var sb strings.Builder
	sb.WriteString(header(cmd))
	sb.WriteString(":local " + okVar + " true\n")
	sb.WriteString(":do { /interface/wireguard peers remove [find interface=" + WgIfaceName + " comment=\"" + WgMarker + "\"] } on-error={}\n")
	sb.WriteString(":do { /ip address remove [find interface=" + WgIfaceName + " comment=\"" + WgMarker + "\"] } on-error={}\n")
	sb.WriteString(":do { /interface/wireguard remove [find name=\"" + WgIfaceName + "\"] } on-error={}\n")
	sb.WriteString(b.resultLines(cmd.ID, okVar, map[string]string{"removed": "1"}))
	return sb.String()
}

// WgSetupPayloadFrom — construit le payload canonique de wg_setup (le handler
// l'appelle après validation) : le builder ne lit QUE ces clés. N°312 —
// allowedSources : liste allowed-address du peer serveur côté routeur (socié
// 10.8.0.1/32 + IP des peers « remote » du compte, cf. wgAllowedSourcesLocked
// côté api) ; vide = socle seul (comportement N°285, rétro-compatible).
func WgSetupPayloadFrom(peerPub, psk, address, endpointHost string, endpointPort int, allowedSources string) map[string]any {
	return map[string]any{
		"peerPub":        peerPub,
		"psk":            psk,
		"address":        address,
		"endpointHost":   endpointHost,
		"endpointPort":   endpointPort,
		"allowedSources": allowedSources,
	}
}

// WgIPv4WithPrefix — adresse tunnel avec son préfixe /32 (forme RouterOS).
func WgIPv4WithPrefix(ipv4 string) string {
	if ipv4 == "" || strings.Contains(ipv4, "/") {
		return ipv4
	}
	return fmt.Sprintf("%s/32", ipv4)
}
