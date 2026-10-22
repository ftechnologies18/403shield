// handlers_dnsshield_apple.go — N°345 — GÉNÉRATEUR .mobileconfig (iOS/
// macOS) + bloc setup de la console : la face « installation en 1 geste »
// du bouclier DNS.
//
// POURQUOI UN PROFIL APPLE : iOS et macOS n'ont PAS de case « URL DoH »
// dans les Réglages — le mécanisme natif grand public est le PROFIL DE
// CONFIGURATION DNS (charge com.apple.dnsSettings.managed, pattern
// NextDNS/AdGuard : l'appareil télécharge le .mobileconfig depuis la
// console, Réglages → Général → VPN et gestion d'appareil → Installer).
// Le profil est générÉ PAR LE BACKEND (pas la console) pour une seule
// raison : Safari doit le télécharger comme FICHIER (Content-Type
// application/x-apple-aspen-config) — et l'URL dérivée de la requête est
// celle du RÉSOLVEUR, pas celle de la console.
//
// DEUX VARIANTES sur la même route publique :
//
//	GET /dns-cfg/{publicId}          → DoH (défaut — partout, dès N°339)
//	GET /dns-cfg/{publicId}/dot      → DoT (ServerName <id>.<zone>, N°345)
//
// Le publicId est l'identifiant d'acheminement N°339 (pattern NextDNS :
// présent DANS l'URL du profil, aucun secret supplémentaire) : la route
// est publique, bornée par le même limiteur que le résolveur DoH, et
// l'anti-énumération est le 404 uniforme (profil inconnu/inactif —
// miroir exact du résolveur).
//
// PROFIL NON SIGNÉ (honnêteté documentée) : un profil signé exigerait un
// certificat de signature dédié ; Apple affiche « Non signé » à
// l'installation et installe quand même — les guides de la console /dns
// le disent tel quel (aucune promesse mensongère). Les UUID sont
// régénérés à CHAQUE téléchargement : réinstaller un profil reste propre
// (iOS remplace par identifiant PayloadIdentifier, pas par UUID).
package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"mikcloud/hotspot-api/internal/model"
)

// dnsApplePayloadDesc — description lue par l'utilisateur à
// l'installation (et dans Réglages) : dire ce que le profil fait VRAIMENT.
const dnsApplePayloadDesc = "Bouclier DNS 403Shield — filtre les menaces et contenus selon le niveau de votre profil (403shield.ftci.fr). Retirable à tout moment dans Réglages."

// handleDnsAppleConfig — GET /dns-cfg/{publicId}[/{proto}] : le profil
// de configuration Apple du profil DNS (DoH par défaut, /dot en variante).
func (a *API) handleDnsAppleConfig(w http.ResponseWriter, r *http.Request) {
	if ok, retry := a.dnsQuery.allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", itoa(retryAfter(retry)))
		writeErr(w, http.StatusTooManyRequests, "Trop de demandes — réessayez plus tard")
		return
	}
	publicID := strings.TrimSpace(r.PathValue("publicId"))
	proto := strings.ToLower(strings.TrimSpace(r.PathValue("proto")))
	if proto == "" {
		proto = "doh"
	}
	if proto != "doh" && proto != "dot" {
		writeErr(w, http.StatusBadRequest, "Variante inconnue (doh ou dot)")
		return
	}

	// Anti-énumération : profil inconnu/inactif → 404 uniforme (miroir du
	// résolveur DoH — jamais révéler qu'un profil a existé).
	a.store.Lock()
	db := a.store.Data()
	p := model.FindDnsProfileByPublicID(db, publicID)
	if p == nil || p.Status != model.DnsProfileActive {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Profil DNS inconnu")
		return
	}
	// Copie AVANT déverrouillage (miroir du résolveur DoH) : le nom traverse
	// l'XML du profil — une chaîne copiée ne peut pas être invalidée par une
	// réallocation du registre sous le verrou.
	name := p.Name
	a.store.Unlock()

	base := agentBaseURL(r)
	zone := dnsDotZone()
	dns := map[string]string{
		"protocol": "HTTPS",
		"urlKey":   "ServerURL",
		"urlValue": base + "/dns-query/" + publicID,
	}
	if proto == "dot" {
		dns = map[string]string{
			"protocol": "TLS",
			"urlKey":   "ServerName",
			"urlValue": publicID + "." + zone,
		}
	}

	w.Header().Set("Content-Type", "application/x-apple-aspen-config")
	w.Header().Set("Content-Disposition", `attachment; filename="403shield-dns-`+publicID+`.mobileconfig"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(dnsAppleMobileConfig(name, publicID, proto, dns)))
}

// dnsAppleMobileConfig — assemble le plist XML (échappement strict : le
// nom du profil est une chaîne utilisateur, elle traverse le XML
// échappée — jamais de construction par concaténation naïve).
func dnsAppleMobileConfig(profileName, publicID, proto string, dns map[string]string) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	b.WriteString(`<plist version="1.0">` + "\n<dict>\n")
	b.WriteString("\t<key>PayloadContent</key>\n\t<array>\n\t\t<dict>\n")
	writePlistKV(&b, "\t\t\t", "PayloadType", "com.apple.dnsSettings.managed")
	writePlistKV(&b, "\t\t\t", "PayloadVersion", "1")
	writePlistKV(&b, "\t\t\t", "PayloadIdentifier", "fr.ftci.403shield.dns."+publicID+"."+proto)
	writePlistKV(&b, "\t\t\t", "PayloadUUID", dnsCfgUUID())
	writePlistKV(&b, "\t\t\t", "PayloadDisplayName", "403Shield DNS — "+profileName)
	writePlistKV(&b, "\t\t\t", "PayloadDescription", dnsApplePayloadDesc)
	writePlistKV(&b, "\t\t\t", "PayloadOrganization", "FTech CI")
	b.WriteString("\t\t\t<key>DNSSettings</key>\n\t\t\t<dict>\n")
	writePlistKV(&b, "\t\t\t\t", "DNSProtocol", dns["protocol"])
	writePlistKV(&b, "\t\t\t\t", dns["urlKey"], dns["urlValue"])
	b.WriteString("\t\t\t</dict>\n")
	b.WriteString("\t\t\t<key>ProhibitDisablement</key>\n\t\t\t<false/>\n")
	b.WriteString("\t\t</dict>\n\t</array>\n")
	writePlistKV(&b, "\t", "PayloadDisplayName", "403Shield DNS — "+profileName)
	writePlistKV(&b, "\t", "PayloadDescription", dnsApplePayloadDesc)
	writePlistKV(&b, "\t", "PayloadIdentifier", "fr.ftci.403shield.dns."+publicID)
	writePlistKV(&b, "\t", "PayloadOrganization", "FTech CI")
	b.WriteString("\t<key>PayloadRemovalDisallowed</key>\n\t<false/>\n")
	writePlistKV(&b, "\t", "PayloadType", "Configuration")
	writePlistKV(&b, "\t", "PayloadUUID", dnsCfgUUID())
	writePlistKV(&b, "\t", "PayloadVersion", "1")
	b.WriteString("</dict>\n</plist>\n")
	return b.String()
}

// writePlistKV — une paire clé/valeur plist (<key> + <string>).
func writePlistKV(b *strings.Builder, indent, key, value string) {
	b.WriteString(indent + "<key>" + xmlEscapePlist(key) + "</key>\n")
	b.WriteString(indent + "<string>" + xmlEscapePlist(value) + "</string>\n")
}

// xmlEscapePlist — les cinq entités XML (le nom du profil est une chaîne
// utilisateur : « & », « < », guillemets… traversent échappés).
var xmlPlistEscaper = strings.NewReplacer(
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	`"`, "&#34;",
	"'", "&#39;",
)

func xmlEscapePlist(s string) string { return xmlPlistEscaper.Replace(s) }

// dnsCfgUUID — UUID v4 (crypto/rand) pour PayloadUUID : régénéré à chaque
// téléchargement (une réinstallation reste une installation propre).
func dnsCfgUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "00000000-0000-4000-8000-000000000000" // panne machine : UUID fixe inoffensif
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}
