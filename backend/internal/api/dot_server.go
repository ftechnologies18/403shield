// dot_server.go — N°345 — SERVEUR DoT (DNS-over-TLS, RFC 7858) :853 —
// l'onboarding ANDROID du bouclier DNS.
//
// POURQUOI DoT : Android « DNS privé » (Réglages → Réseau → DNS privé)
// n'accepte QU'UN NOM D'HÔTE — jamais une URL, jamais un port : Android
// exige DoT sur 853 (RFC 7858). Le DoH de N°339 couvre navigateurs et
// Apple ; ce serveur couvre le reste du parc Android (4G/5G comme WiFi).
//
// ROUTAGE PAR SNI (la clé de voûte) : un nom d'hôte ne transporte pas
// d'identifiant de profil — alors le profil DEVIENT le nom d'hôte. Chaque
// profil répond sur « <publicId>.<zone> » (publicId 16 hex, déjà secret
// faible d'acheminement N°339) :
//
//	SNI abcd1234abcd1234.dns.403shield.ftci.fr → profil abcd1234abcd1234
//	SNI dns.403shield.ftci.fr (hôte nu)        → SONDE : REFUSED à toute
//	                                              question (cible de santé
//	                                              publique — jamais un
//	                                              filtrage actif)
//	SNI hors contrat                            → connexion fermée
//
// Le certificat est un JOKER (*.dns.403shield.ftci.fr + hôte nu, Let's
// Encrypt DNS-01 via le geste ops-dns-dot.yml) : le même couple
// fullchain/privkey sert TOUTES les poignées de main — le SNI ne
// sélectionne que le ROUTAGE, jamais le certificat.
//
// DISCIPLINES MAISON (miroir strict du DoH N°339/343) :
//   - FAIL-OPEN : message incompréhensible → forward upstream tel quel ;
//     amont mort → FERMETURE de la connexion (l'appareil retombe sur son
//     DNS système — « un filtre en panne ne coupe pas Internet, il
//     s'efface ») ;
//   - ANTI-ÉNUMÉRATION : profil inconnu/bloqué → connexion fermée (le
//     miroir exact du 404 DoH — jamais de réponse fabriquée) ;
//   - JOURNAL MINIMAL : seuls les BLOCAGES/couve-feux sont consignés
//     (dnsLogEvent + dédup 10 min — la même fonction que le DoH) ;
//   - STDLIB PURE : crypto/tls + encoding/binary, aucune dépendance.
//
// DISPONIBILITÉ DU BOOT : certificats absents, port injoignable (caps,
// pare-feu) → le serveur se DÉSACTIVE avec un log franc — JAMAIS fatal :
// le backend (DoH, consoles, agents) démarre toujours. dotEnabled publie
// l'état RÉEL à la console (/api/dnsshield/me → dot.available — doctrine
// « aucun faux chiffre »).
//
// RECHARGEMENT À CHAUD : acme.sh renouvelle le joker tous les ~60 j ;
// le serveur re-stat les fichiers (≤ 1 sonde/minute) à chaque poignée de
// main et recharge sur changement de mtime — le renouvellement se pose
// SANS redémarrage ni intervention.
package api

import (
	"crypto/tls"
	"encoding/binary"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"mikcloud/hotspot-api/internal/dnsshield"
	"mikcloud/hotspot-api/internal/model"
)

// DnsDotDefaultZone — zone SNI du bouclier DNS (surchargeable par
// DNS_DOT_ZONE pour un déploiement dédié). Le joker TLS et l'enregistre-
// ment DNS *.zone vivent du même nom (geste ops-dns-dot.yml).
const DnsDotDefaultZone = "dns.403shield.ftci.fr"

// Bornes du serveur DoT (défense en profondeur, miroir des disciplines
// HTTP : bornes lisses pour un foyer, dures pour un flot hostile).
const (
	dotHandshakeTimeout = 15 * time.Second // poignée de main lente = scan, on coupe
	dotIdleTimeout      = 2 * time.Minute  // silences entre questions (Android garde la connexion ouverte)
	dotConnMaxLife      = 1 * time.Hour    // recyclage : le client reprend (poignée de main TLS ~ms)
	dotMaxConns         = 512              // goroutines simultanées (au-delà : fermeture immédiate)
	dotLogEvery         = 1 * time.Minute  // throttle des logs de rejet (un scan n'inonde pas le journal)
)

// dotEnabled — état RÉEL publié à la console (posé quand l'écoute est
// effective — pas avant).
var dotEnabled atomic.Bool

// dnsDotZone — zone SNI effective (env DNS_DOT_ZONE, minuscules, sinon
// défaut). Lue au boot par ServeDoT et à la volée par la console : la
// zone ne change pas sans redémarrage.
func dnsDotZone() string {
	z := strings.ToLower(strings.TrimSpace(os.Getenv("DNS_DOT_ZONE")))
	if z != "" {
		return z
	}
	return DnsDotDefaultZone
}

// dotLogThrottle — log de rejet borné : au plus une ligne/minute par
// MOTIF (SNI hors contrat, amont mort…). Un scan de port ou un flux
// d'appareils égarés ne doit pas noyer le journal service.
var (
	dotLogMu   sync.Mutex
	dotLogLast = map[string]time.Time{}
)

func dotLogThrottle(key, format string, args ...any) {
	dotLogMu.Lock()
	if time.Since(dotLogLast[key]) < dotLogEvery {
		dotLogMu.Unlock()
		return
	}
	dotLogLast[key] = time.Now()
	dotLogMu.Unlock()
	log.Printf(format, args...)
}

// ---------------------------------------------------------------------------
// Certificat joker + rechargement à chaud
// ---------------------------------------------------------------------------

// dotCertStore — le couple fullchain/privkey servi à TOUTES les poignées
// de main (le SNI ne sélectionne que le routage). Pointeur atomique en
// lecture (chemin chaud : zéro verrou), verrou court uniquement au
// rechargement.
type dotCertStore struct {
	certFile, keyFile string
	cert              atomic.Pointer[tls.Certificate]
	certMod, keyMod   int64 // mtodes chargés (0 = inconnu)
	mu                sync.Mutex
	lastProbe         atomic.Int64 // unix secondes de la dernière sonde mtime
}

// loadDotCert — charge le couple (une fois, au boot). L'échec FRANC
// désactive le serveur (log + return) : mieux vaut pas de DoT qu'un DoT
// servi avec une clé avariée.
func loadDotCert(certFile, keyFile string) (*dotCertStore, error) {
	c, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, err
	}
	s := &dotCertStore{certFile: certFile, keyFile: keyFile}
	s.cert.Store(&c)
	s.certMod = dotModTime(certFile)
	s.keyMod = dotModTime(keyFile)
	return s, nil
}

// dotModTime — mtime d'un fichier (0 si injoignable).
func dotModTime(path string) int64 {
	if fi, err := os.Stat(path); err == nil {
		return fi.ModTime().UnixNano()
	}
	return 0
}

// get — callback GetCertificate : sert TOUJOURS le joker (le SNI n'est
// pas un choix de certificat) et profite de l'occasion pour sonder les
// fichiers (≤ 1 sonde/minute — le coût d'un stat est nul devant une
// poignée de main TLS).
func (s *dotCertStore) get(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	s.maybeReload()
	if c := s.cert.Load(); c != nil {
		return c, nil
	}
	return nil, errString("certificat DoT absent")
}

// maybeReload — stat des mtimes ; changement → rechargement. En échec de
// rechargement (fichier à moitié posé par le renouvellement, par exemple),
// l'ANCIEN certificat continue d'être servi : la panne de renouvellement
// ne doit pas tuer le service (il sera de toute façon visible à
// l'expiration).
func (s *dotCertStore) maybeReload() {
	now := time.Now().Unix()
	last := s.lastProbe.Load()
	if last != 0 && now-last < 60 {
		return // une sonde par minute suffit
	}
	if !s.lastProbe.CompareAndSwap(last, now) {
		return // une autre poignée de main sonde déjà
	}
	cm, km := dotModTime(s.certFile), dotModTime(s.keyFile)
	if cm == s.certMod && km == s.keyMod {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := tls.LoadX509KeyPair(s.certFile, s.keyFile)
	if err != nil {
		log.Printf("N°345 DoT : rechargement du certificat impossible (%v) — l'ancien continue d'être servi", err)
		return
	}
	s.cert.Store(&c)
	s.certMod, s.keyMod = cm, km
	log.Printf("N°345 DoT : certificat rechargé (%s)", s.certFile)
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

// dotConns — jauge de connexions simultanées (garde-fou DoS : chaque
// connexion = une goroutine + un état TLS).
var dotConns atomic.Int32

// ServeDoT — point d'entrée (main.go : go engine.ServeDoT()). BLOQUANT.
// Toute condition absente → log franc + retour : le DoH reste seul canal,
// le backend démarre toujours.
func (a *API) ServeDoT() {
	addr := strings.TrimSpace(os.Getenv("DNS_DOT_ADDR"))
	if addr == "" {
		addr = ":853"
	}
	certFile := strings.TrimSpace(os.Getenv("DNS_TLS_CERTFILE"))
	keyFile := strings.TrimSpace(os.Getenv("DNS_TLS_KEYFILE"))
	zone := dnsDotZone()
	if certFile == "" || keyFile == "" {
		log.Printf("N°345 DoT : désactivé (DNS_TLS_CERTFILE/KEYFILE absents de l'environnement) — le bouclier DNS reste servi en DoH")
		return
	}
	certs, err := loadDotCert(certFile, keyFile)
	if err != nil {
		log.Printf("N°345 DoT : désactivé (certificat illisible : %v) — le bouclier DNS reste servi en DoH", err)
		return
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Printf("N°345 DoT : écoute %s impossible (%v) — le bouclier DNS reste servi en DoH (ports < 1024 : AmbientCapabilities requise, cf. ops-dns-dot.yml)", addr, err)
		return
	}
	cfg := &tls.Config{
		GetCertificate: certs.get,
		MinVersion:     tls.VersionTLS12,
	}
	dotEnabled.Store(true)
	log.Printf("N°345 DoT : en écoute sur %s (zone SNI %s — Android « DNS privé » : <id>.%s)", addr, zone, zone)
	a.dotAccept(tls.NewListener(ln, cfg), zone, certs)
}

// dotAccept — boucle d'acceptation ; l'erreur de listener (arrêt) sort
// proprement, les erreurs temporaires continuent.
func (a *API) dotAccept(ln net.Listener, zone string, certs *dotCertStore) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				continue
			}
			return // listener fermé (arrêt du service)
		}
		go a.dotConn(conn, zone, certs)
	}
}

// dotConn — UNE connexion TLS = UNE goroutine. Poignée de main bornée →
// routage SNI → boucle de questions RFC 7858 (préfixe 2 octets).
func (a *API) dotConn(raw net.Conn, zone string, certs *dotCertStore) {
	defer raw.Close()
	if n := dotConns.Add(1); n > dotMaxConns {
		dotConns.Add(-1)
		dotLogThrottle("flood", "N°345 DoT : > %d connexions simultanées — flot coupé", dotMaxConns)
		return
	}
	defer dotConns.Add(-1)

	_ = certs // le certificat est déjà engagé par le listener (GetCertificate)
	_ = raw.SetDeadline(time.Now().Add(dotHandshakeTimeout))
	tc, ok := raw.(*tls.Conn)
	if !ok {
		return // tls.NewListener garantit le type ; garde défensive
	}
	if err := tc.Handshake(); err != nil {
		return // sonde/scan : silencieux (pas de log par poignée de main morte)
	}

	// ── Routage SNI → profil ─────────────────────────────────────────────
	sni := strings.ToLower(strings.TrimSpace(tc.ConnectionState().ServerName))
	var publicID string
	bare := sni == zone
	if !bare {
		if !strings.HasSuffix(sni, "."+zone) {
			dotLogThrottle("sni", "N°345 DoT : SNI hors contrat (zone %s) — connexion fermée", zone)
			return
		}
		label := strings.TrimSuffix(sni, "."+zone)
		if !validDnsPublicID(label) {
			dotLogThrottle("sni", "N°345 DoT : SNI malformé (zone %s) — connexion fermée", zone)
			return
		}
		publicID = label
	}
	var profile *model.DnsProfile
	if publicID != "" {
		a.store.Lock()
		db := a.store.Data()
		if p := model.FindDnsProfileByPublicID(db, publicID); p != nil && p.Status == model.DnsProfileActive {
			cp := *p
			profile = &cp
		}
		a.store.Unlock()
		if profile == nil {
			// Anti-énumération : le miroir exact du 404 DoH — l'appareil
			// retombe sur son DNS système, jamais de réponse fabriquée.
			dotLogThrottle("unknown", "N°345 DoT : profil inconnu/inactif via SNI — connexion fermée")
			return
		}
	}
	ip := ""
	if host, _, err := net.SplitHostPort(raw.RemoteAddr().String()); err == nil {
		ip = host
	}

	// ── Boucle de questions (RFC 7858 : préfixe de longueur 2 octets) ────
	start := time.Now()
	for {
		if time.Since(start) > dotConnMaxLife {
			return // recyclage : le client reprend (poignée de main ~ms)
		}
		_ = tc.SetReadDeadline(time.Now().Add(dotIdleTimeout))
		msg, ok := readDotFrame(tc)
		if !ok {
			return
		}
		if ip != "" {
			if allow, _ := a.dotQuery.allow(ip); !allow {
				// Flot coupé : REFUSED honnête (le client ralentit) puis fermeture.
				if q, err := dnsshield.ParseQuery(msg); err == nil {
					_ = writeDotFrame(tc, dnsshield.BuildRefused(q))
				}
				return
			}
		}
		resp := a.dotAnswer(profile, msg, bare)
		if len(resp) == 0 {
			return // amont mort : fermeture → DNS système (doctrine fail-open)
		}
		if !writeDotFrame(tc, resp) {
			return
		}
	}
}

// dotAnswer — LA décision, miroir exact de handleDnsQuery (mêmes verrous
// d'ordre : allow → couvre-feu → bloquer → niveau). bare=true : sonde de
// santé publique (hôte nu) → REFUSED à toute question lisible : la cible
// prouve le service SANS jamais filtrer. Retour vide = fermer.
func (a *API) dotAnswer(profile *model.DnsProfile, msg []byte, bare bool) []byte {
	q, perr := dnsshield.ParseQuery(msg)
	if perr != nil {
		// Fail-open : message incompréhensible → forward tel quel.
		if resp, err := dnsshield.Forward(msg); err == nil {
			return resp
		}
		return nil
	}
	if bare {
		return dnsshield.BuildRefused(q)
	}
	switch dnsshield.Decide(profile, q.Name, time.Now().UTC()) {
	case dnsshield.VerdictBlock:
		a.dnsLogEvent(profile.ID, q.Name, model.DnsEventBlocked)
		return dnsshield.BuildBlocked(q)
	case dnsshield.VerdictCurfew:
		a.dnsLogEvent(profile.ID, q.Name, model.DnsEventCurfew)
		return dnsshield.BuildRefused(q)
	default:
		if resp, err := dnsshield.Forward(msg); err == nil {
			return resp
		}
		// Amont mort : fermeture honnête — l'appareil retombe sur son DNS
		// système (jamais de réponse fabriquée).
		dotLogThrottle("upstream", "N°345 DoT : amont mort — connexion fermée (l'appareil retombe sur son DNS système)")
		return nil
	}
}

// readDotFrame — un message : 2 octets de longueur (big-endian) + le
// corps. Tout écart (EOF, corps < 12 octets = jamais un message DNS,
// lecture partielle) ferme la connexion.
func readDotFrame(tc *tls.Conn) ([]byte, bool) {
	var hdr [2]byte
	if _, err := io.ReadFull(tc, hdr[:]); err != nil {
		return nil, false
	}
	n := int(binary.BigEndian.Uint16(hdr[:]))
	if n < 12 {
		return nil, false
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(tc, buf); err != nil {
		return nil, false
	}
	return buf, true
}

// writeDotFrame — répond en cadrant le message (RFC 7858 §4.2.1).
func writeDotFrame(tc *tls.Conn, msg []byte) bool {
	if len(msg) > 0xFFFF {
		return false // un message DNS ne dépasse jamais 64 KiB
	}
	var hdr [2]byte
	binary.BigEndian.PutUint16(hdr[:], uint16(len(msg)))
	if _, err := tc.Write(hdr[:]); err != nil {
		return false
	}
	_, err := tc.Write(msg)
	return err == nil
}

// validDnsPublicID — 16 hex minuscules (le format exact forgé par
// NewDnsProfilePublicID — l'acheminement DoT n'accepte rien d'autre).
func validDnsPublicID(s string) bool {
	if len(s) != 16 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') {
			continue
		}
		return false
	}
	return true
}
