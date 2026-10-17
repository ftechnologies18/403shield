// wglan.go — N°315 — Accès Pro / LAN étendu (design D-B1, briques 1 et 3).
//
// Le « remote » N°312 supervisait le ROUTEUR seul (Winbox, API, SSH, web —
// 10.8.0.0/24 + 10.8.2.0/24, fail-closed : aucune sortie Internet). La
// promesse P-A de N°289 était plus large : « un peer WireGuard donne au
// gérant l'accès à SON réseau — routeur, caméras, NAS ». Deux commandes
// comblent l'écart, sur le CANONIQUE canal agent (D1 : zéro cred, zéro port
// public, CGNAT-proof, ≤ 45 s) :
//
//   - wg_lan_detect (brique 1, pattern ppp_provision N°310) : LECTURE PURE.
//     Le script détecte l'interface LAN (bridge active portant une adresse,
//     sinon ether active — même heuristique éprouvée que ppp_provision) et
//     dérive le /24 de son adresse locale. AUCUNE modification de config :
//     le rapport (Command.Result) porte lan=<cidr>&iface=<nom>. La VALIDATION
//     (RFC1918, /24, hors espace tunnel 10.8.0.0/16) vit côté cloud
//     (ValidWgLanCIDR) et côté VM (wg-peer.sh set-lan) — le script rapporte
//     la vérité locale, trois frontières la filtrent.
//
//   - wg_lan (brique 3, pattern pooldoctor mikcloud-pool-nat) : pose, pour
//     CHAQUE peer Pro du compte, une règle filter forward (src=<peer>/32
//     dst=<lan> action=accept) + une règle nat srcnat (src=<peer>/32
//     dst=<lan> action=masquerade), toutes marquées mikcloud-wg-lan,
//     remove-then-add idempotent. Le masquerade est LA robustesse D-B1 : les
//     hôtes LAN (caméras, NAS) voient le ROUTEUR comme source — ils n'ont
//     pas besoin de route de retour vers 10.8.2.x pour répondre. Le périmètre
//     est SCOPÉ aux seuls peers Pro listés dans le payload (jamais le /24
//     remote entier : la règle reste un geste produit, pas une porte).
//
// Le chainage ROUTAGE (brique 2 — AllowedIPs du peer routeur côté wg0.conf)
// vit sur la VM (wg-peer.sh set-lan v5 via wg-mini v5) : ce fichier ne fait
// QUE le côté routeur.
package agent

import (
	"strings"

	"mikcloud/hotspot-api/internal/model"
)

// buildWgLanDetect — wg_lan_detect : détection du sous-réseau LAN du routeur
// (LECTURE PURE — aucune écriture). Miroir exact de l'étape 1 de
// buildPppProvision (heuristique bridge-puis-ether éprouvée N°310) ; le /24
// est dérivé de la PREMIÈRE adresse de l'interface détectée. Rapport : ok
// porte lan=<cidr>&iface=<nom> (le cloud valide ensuite), error porte la
// cause (aucune interface candidate). Un LAN détecté hors RFC1918 ou dans
// l'espace tunnel est RAPPORTÉ tel quel : c'est au cloud de le refuser avec
// un message honnête (le script n'a pas la table de validation — vérité
// locale brute, filtrage aux bords).
func (b Builder) buildWgLanDetect(cmd model.Command) string {
	p := "l" + idSafe(cmd.ID) // préfixe des variables locales (unicité inter-commandes)
	okVar := "ok" + idSafe(cmd.ID)

	var sb strings.Builder
	sb.WriteString(header(cmd))
	sb.WriteString(":local " + okVar + " true\n")
	sb.WriteString(":local " + p + `iface ""` + "\n")
	sb.WriteString(":local " + p + `lan ""` + "\n")
	sb.WriteString(":local " + p + `why ""` + "\n")

	// 1. Interface LAN — même heuristique que ppp_provision N°310 (vérité
	// locale : bridge active portant une adresse, sinon ether active).
	sb.WriteString(`:foreach i in=[/interface find where running and type=bridge] do={
  :local qn [:tostr [/interface get $i name]]
  :if ($` + p + `iface = "" and [:len [/ip address find where interface=$qn]] > 0) do={ :set ` + p + `iface $qn }
}
:if ($` + p + `iface = "") do={
  :foreach i in=[/interface find where running and type=ether] do={
    :local qn [:tostr [/interface get $i name]]
    :if ($` + p + `iface = "" and [:len [/ip address find where interface=$qn]] > 0) do={ :set ` + p + `iface $qn }
  }
}
:if ($` + p + `iface = "") do={ :set ` + okVar + ` false; :set ` + p + `why "aucune interface LAN candidate (bridge/ether active portant une adresse)" }
`)

	// 2. /24 dérivé de la première adresse de l'interface (ex. «192.168.88.1/24»
	// → «192.168.88.0/24») : on coupe avant le 3e point, on colle «.0/24».
	sb.WriteString(`:if ($` + okVar + ` and $` + p + `iface != "") do={
  :local qaddr ""
  :do { :set qaddr [:tostr [/ip address get [find interface=$` + p + `iface] address]] } on-error={ :set qaddr "" }
  :if ($qaddr = "") do={
    :set ` + okVar + ` false; :set ` + p + `why ("interface " . $` + p + `iface . " sans adresse")
  } else={
    :local qdots 0
    :local qi 0
    :while ($qi < [:len $qaddr]) do={
      :if ([:pick $qaddr $qi ($qi + 1)] = ".") do={
        :set qdots ($qdots + 1)
        :if ($qdots = 3) do={ :set ` + p + `lan ([:pick $qaddr 0 $qi] . ".0/24") }
      }
      :set qi ($qi + 1)
    }
    :if ($` + p + `lan = "") do={ :set ` + okVar + ` false; :set ` + p + `why "adresse LAN illisible" }
  }
}
`)

	// 3. Rapport dynamique (pattern buildWgSetup/ppp_provision : les valeurs
	// sont lues côté routeur, le fetch les porte) — ok porte le LAN + l'iface,
	// ko porte la cause. AUCUNE écriture n'a eu lieu.
	fetchOK := `/tool fetch url="` + strings.TrimRight(b.BaseURL, "/") + `/agent/result?token=` + urlEscape(b.Token) +
		`" http-method=post http-data=("cmd=` + cmd.ID +
		`&status=ok&lan=". $` + p + `lan ."&iface=". $` + p + `iface) output=none`
	fetchKO := b.reportLine(cmd.ID, false, map[string]string{"message": "detection LAN impossible"})
	sb.WriteString(":if ($" + okVar + ") do={\n  " + fetchOK + "\n} else={\n  " + fetchKO + "\n}\n")
	return sb.String()
}

// buildWgLan — wg_lan : règles marquées mikcloud-wg-lan sur le routeur.
// Payload : {lan: "192.168.88.0/24", peers: "10.8.2.5,10.8.2.9"} — la liste
// des peers Pro du compte (validation ValidWgSupervisionIP par item, borne
// MaxWgLanPeers). Toute valeur avariée → script KO honnête (rapport error),
// JAMAIS de règle embarquant un motif inattendu (défense aux deux bords :
// le handler a déjà validé, le builder re-sanitise).
//
// Pose idempotente remove-then-add par marqueur : re-filer la commande
// reconverge (ajout d'un peer Pro → la nouvelle liste remplace l'ancienne,
// jamais de doublon). Rapport : compte de règles marquées présentes après
// pose (vérité routeur — 2 par peer) + echo lan/peers.
func (b Builder) buildWgLan(cmd model.Command) string {
	p := "w" + idSafe(cmd.ID)
	okVar := "ok" + idSafe(cmd.ID)

	lan := strings.TrimSpace(plStr(cmd.Payload, "lan"))
	peersRaw := strings.TrimSpace(plStr(cmd.Payload, "peers"))

	// Validation locale (défense en profondeur — le handler a validé avant).
	// Valeur avariée → KO honnête, aucune règle posée.
	valid := ValidWgLanCIDR(lan)
	peers := []string{}
	if valid {
		for _, it := range strings.Split(peersRaw, ",") {
			it = strings.TrimSpace(it)
			if it == "" {
				continue
			}
			if !ValidWgSupervisionIP(it) || len(peers) >= MaxWgLanPeers {
				valid = false
				break
			}
			peers = append(peers, it)
		}
		if len(peers) == 0 {
			valid = false
		}
	}

	var sb strings.Builder
	sb.WriteString(header(cmd))
	sb.WriteString(":local " + okVar + " true\n")
	if !valid {
		// Aucun geste : rapport d'erreur explicite (le cloud affichera la cause).
		sb.WriteString(":set " + okVar + " false\n")
		sb.WriteString(b.reportLine(cmd.ID, false, map[string]string{"message": "lan ou peers invalides (refus avant pose)"}))
		return sb.String()
	}

	// Remove-then-add par marqueur (pattern pooldoctor / buildWgSetup) : les
	// règles mikcloud-wg-lan précédentes disparaissent, la liste FRAÎCHE les
	// remplace — idempotent par construction.
	sb.WriteString(":do { /ip firewall filter remove [find comment=\"" + WgLanMarker + "\"] } on-error={}\n")
	sb.WriteString(":do { /ip firewall nat remove [find comment=\"" + WgLanMarker + "\"] } on-error={}\n")

	lanEsc := rosEscape(lan)
	for _, peer := range peers {
		peerEsc := rosEscape(peer)
		// Forward accept : le trafic DU peer Pro vers le LAN passe (les setups
		// hotspot finissent souvent forward en drop — sans cette règle le LAN
		// étendu serait silencieusement muet).
		sb.WriteString(":do { /ip firewall filter add chain=forward src-address=\"" + peerEsc + "/32\" dst-address=\"" + lanEsc + "\" action=accept comment=\"" + WgLanMarker + "\" } on-error={ :set " + okVar + " false }\n")
		// Srcnat masquerade : les hôtes LAN voient le routeur comme source —
		// réponse garantie sans route de retour (brique 3 de D-B1).
		sb.WriteString(":do { /ip firewall nat add chain=srcnat src-address=\"" + peerEsc + "/32\" dst-address=\"" + lanEsc + "\" action=masquerade comment=\"" + WgLanMarker + "\" } on-error={ :set " + okVar + " false }\n")
	}

	// Rapport : compte de règles marquées présentes (2 par peer attendu) —
	// vérité routeur, le cloud compare.
	sb.WriteString(":local " + p + "n 0\n")
	sb.WriteString(":do { :foreach " + p + "r in=[/ip firewall filter find where comment=\"" + WgLanMarker + "\"] do={ :set " + p + "n ($" + p + "n + 1) } } on-error={}\n")
	sb.WriteString(":do { :foreach " + p + "r in=[/ip firewall nat find where comment=\"" + WgLanMarker + "\"] do={ :set " + p + "n ($" + p + "n + 1) } } on-error={}\n")
	fetchOK := `/tool fetch url="` + strings.TrimRight(b.BaseURL, "/") + `/agent/result?token=` + urlEscape(b.Token) +
		`" http-method=post http-data=("cmd=` + cmd.ID +
		`&status=ok&rules=". $` + p + `n ."&lan=` + urlEscape(lan) + `&peers=` + urlEscape(strings.Join(peers, ",")) + `") output=none`
	fetchKO := b.reportLine(cmd.ID, false, map[string]string{"message": "regles LAN refusees par le routeur"})
	sb.WriteString(":if ($" + okVar + ") do={\n  " + fetchOK + "\n} else={\n  " + fetchKO + "\n}\n")
	return sb.String()
}

// WgLanPayloadFrom — payload canonique de wg_lan : lan (CIDR validé) + peers
// (liste d'IP tunnel des peers Pro, join virgule — le builder re-valide).
func WgLanPayloadFrom(lan string, peers []string) map[string]any {
	return map[string]any{
		"lan":   lan,
		"peers": strings.Join(peers, ","),
	}
}

// WgLanDetectPayloadFrom — payload canonique de wg_lan_detect (corps vide :
// auto-détection totale côté routeur, pattern ppp_provision).
func WgLanDetectPayloadFrom() map[string]any {
	return map[string]any{}
}
