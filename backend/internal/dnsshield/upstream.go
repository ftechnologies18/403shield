// upstream.go — N°339 — FORWARD UPSTREAM du bouclier DNS : transmettre le
// message brut à un résolveur récursif public, récupérer la réponse TELLE
// QUELLE. UDP seulement en phase 1 (le contrat DoH client ↔ nous est HTTP ;
// l'amont 53/UDP vers l'anycast public est le chemin le plus sobre —
// latence ms, 0 FCFA d'infrastructure, miroir de la doctrine SafeWiFi
// N°80 : les résolveurs publics anycast sont le MVP honnête).
//
// INJECTION : Forward est une VARIABLE de package (pattern wgMiniCallFn /
// sendAccountEmail — discipline maison de test) : la CI ne fait AUCUN
// réseau réel ; le handler de test la remplace.
//
// Fail-open : toute erreur amont remonte à l'appelant qui répond 502 DoH —
// le client retente sur son DNS système : jamais de réponse fabriquée.
package dnsshield

import (
	"fmt"
	"net"
	"os"
	"strings"
	"time"
)

// upstreamTimeout — borné serré : un DoH client attend typiquement ≤ 5 s ;
// au-delà de 2 s l'amont est jugé lent et l'erreur remonte honnêtement.
const upstreamTimeout = 2 * time.Second

// upstreamResolvers — les résolveurs anycast publics par défaut (l'env
// DNS_SHIELD_UPSTREAM, liste « host:port » séparée par virgules, peut les
// remplacer — ex. un Unbound local sur la VM quand les volumes grandissent).
func upstreamResolvers() []string {
	if env := strings.TrimSpace(os.Getenv("DNS_SHIELD_UPSTREAM")); env != "" {
		out := []string{}
		for _, s := range strings.Split(env, ",") {
			if s = strings.TrimSpace(s); s != "" {
				if !strings.Contains(s, ":") {
					s += ":53"
				}
				out = append(out, s)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return []string{"1.1.1.1:53", "8.8.8.8:53", "9.9.9.9:53"}
}

// Forward — transmet la requête brute, retourne la réponse brute.
// Point d'indirection : les tests stubbent cette variable.
var Forward = forwardUDP

// forwardUDP — un échange UDP par requête (pas de pool en phase 1 : le
// socket est créé/détruit par query — sobre, sans état, suffisant MVP ;
// le passage à un pool de sockets sera mesuré avant d'être écrit).
func forwardUDP(query []byte) ([]byte, error) {
	resolvers := upstreamResolvers()
	var lastErr error
	for _, addr := range resolvers {
		conn, err := net.DialTimeout("udp", addr, upstreamTimeout)
		if err != nil {
			lastErr = fmt.Errorf("amont %s injoignable : %w", addr, err)
			continue
		}
		deadline := time.Now().Add(upstreamTimeout)
		_ = conn.SetDeadline(deadline)
		if _, err := conn.Write(query); err != nil {
			conn.Close()
			lastErr = fmt.Errorf("émission vers %s impossible : %w", addr, err)
			continue
		}
		buf := make([]byte, 65535)
		n, err := conn.Read(buf)
		conn.Close()
		if err != nil {
			lastErr = fmt.Errorf("lecture %s : %w", addr, err)
			continue
		}
		if n < 12 {
			lastErr = fmt.Errorf("réponse amont %s trop courte (%d octets)", addr, n)
			continue
		}
		return buf[:n], nil
	}
	return nil, lastErr
}
