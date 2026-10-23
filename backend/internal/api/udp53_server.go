// udp53_server.go — N°346 — SERVEUR DNS CLASSIQUE UDP/53 + TCP/53 —
// « TOUTE LA MAISON » : box FAI, Starlink, routeurs perso.
//
// POURQUOI UDP/53 : après l'appareil (DoH N°339) et le téléphone (DoT
// N°345), reste le PARC QUI NE S'INSTALLE PAS — TV, consoles, objets
// connectés, invités. Ces machines parlent LE DNS CLASSIQUE (RFC 1035,
// UDP/53) configuré sur la BOX. L'utilisateur pointe les serveurs DNS
// de sa box vers ce résolveur : chaque requête du logement arrive depuis
// son IP PUBLIQUE, la LIAISON (dns_home_bindings) route vers le profil.
//
// ROUTAGE PAR IP SOURCE (la clé de voûte) : le DNS classique n'a NI SNI
// (DoT) NI URL (DoH) — l'IP source est la seule information d'achemi-
// nement. La liaison est revendiquée depuis la console (le client
// navigue depuis chez lui : l'IP de sa requête HTTP EST celle de sa
// box) ou révélée par la SONDE :
//
//	IP 41.207.x.x liée → profil « Famille »  →  toute la maison filtrée
//	IP non liée        → REFUSED              →  JAMAIS un open resolver
//	probe-<token>.<zone> (toute IP)          →  sonde : révèle l'IP du
//	                                            logement + détecte le
//	                                            détournement du port 53
//
// LA SONDE (probe-<token>) : le client génère un jeton éphémère (15 min)
// dans la console et lance UNE commande sur un appareil du logement
// (nslookup/dig vers le résolveur). La requête porte un nom unique : si
// elle ARRIVE, la ligne est propre et l'IP source EST l'IP de la box
// (même depuis un téléphone en 4G, la commande tourne chez elle) ; si
// elle n'arrive JAMAIS, le FAI détourne probablement le port 53 (proxy
// transparent) — DoH/DoT restent alors la voie, la console le dit tel
// quel (honnêteté produit, jamais de promesse en avance).
//
// ANTI-AMPLIFICATION (la discipline de ce jalon) : un résolveur DNS
// public qui répond à tout le monde est un AMPLIFICATEUR DDoS. Ici :
// IP sans liaison → REFUSED (réponse de la taille de la question) ;
// les réponses UDP sont bornées (512 sans EDNS, taille EDNS annoncée,
// plafond 4096 — RFC 2181 §9 : au-delà, TC=1 et le client retente en
// TCP, notre serveur TCP/53 l'attend) ; limiteur par IP source (miroir
// DoH/DoT) ; flot en vol borné (256) — la perte est le comportement
// UDP normal sous stress.
//
// DISCIPLINES MAISON (miroir strict DoH N°339/DoT N°345) :
//   - FAIL-OPEN : message incompréhensible → forward upstream tel quel ;
//     amont mort → silence (UDP) / fermeture (TCP) : la box retombe sur
//     le DNS du FAI configuré en secondaire (« un filtre en panne ne
//     coupe pas Internet, il s'efface ») ;
//   - ANTI-ÉNUMÉRATION : sonde inconnue/expirée → REFUSED, exactement
//     comme une IP non liée (rien ne distingue les deux réponses) ;
//   - JOURNAL MINIMAL : seuls les BLOCAGES/couve-feux sont consignés
//     (dnsLogEvent + dédup 10 min, la même fonction que DoH/DoT). Les
//     requêtes autorisées ne sont JAMAIS écrites — la liaison ne porte
//     qu'un compteur agrégé et un dernier-apercu (flush différé ≤ 60 s :
//     jamais une écriture par requête).
//
// DISPONIBILITÉ DU BOOT : le port 53 requiert CAP_NET_BIND_SERVICE (le
// drop-in ops-dns-dot.yml N°345 le pose déjà) et peut être occupé (le
// piège Ubuntu : systemd-resolved écoute 127.0.0.53:53 par défaut — le
// geste ops-dns-udp53.yml l'ôte) → désactivation FRANCHEMENT journalisée,
// JAMAIS fatale : le backend (DoH, DoT, consoles) démarre toujours.
// udp53Enabled publie l'état RÉEL à la console (doctrine « aucun faux
// chiffre »).
//
// STDLIB PURE : aucune dépendance, miroir des autres serveurs du bouclier.
package api

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
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

// Bornes du serveur maison (défense en profondeur, miroir dot_server.go).
const (
	udp53MaxInflight = 256              // requêtes UDP en vol (au-delà : perte, comportement UDP normal)
	udp53TCPMaxConns = 512              // connexions TCP simultanées
	udp53TCPIdle     = 10 * time.Second // silences TCP (un client DNS garde peu)
	udp53TCPMaxLife  = 1 * time.Hour    // recyclage des connexions TCP
	udp53MaxUdpSize  = 4096             // plafond ABSOLU d'une réponse UDP (EDNS compris)
	udp53FlushEvery  = 60 * time.Second // granularité du flush des compteurs de liaison
)

// udp53QtypeA — type DNS A (miroir de dnsshield.qtypeA, privé — même
// valeur RFC 1035).
const udp53QtypeA = 1

// udp53Enabled — état RÉEL publié à la console (posé quand l'écoute UDP
// ET TCP est effective — pas avant).
var udp53Enabled atomic.Bool

// udp53ServeWG — requêtes en vol (UDP) + connexions TCP en service : le
// DRAIN à l'arrêt garantit qu'aucune goroutine ne survit à la fermeture
// des sockets — un arrêt propre (comme le harnais de test) attend la fin
// des traitements engagés avant de rendre la main.
var udp53ServeWG sync.WaitGroup

// udp53Drain — attend la fin des traitements en vol (bornée : un amont
// mort rend la main au plus tard après ses 2 s de délai).
func udp53Drain() {
	done := make(chan struct{})
	go func() {
		udp53ServeWG.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(8 * time.Second):
	}
}

// udp53Conns — jauge TCP simultanée (garde-fou DoS).
var udp53Conns atomic.Int32

// dnsUdp53Addr — adresse d'écoute (env DNS_UDP53_ADDR, défaut :53 —
// le port privilégié EST la porte naturelle : sans les capabilities le
// bind échoue et le serveur se désactive franchement).
func dnsUdp53Addr() string {
	if a := strings.TrimSpace(os.Getenv("DNS_UDP53_ADDR")); a != "" {
		return a
	}
	return ":53"
}

// ---------------------------------------------------------------------------
// L'IP du résolveur (ce que la box configurera)
// ---------------------------------------------------------------------------

// L'IP publique de la VM vit dans le geste ops (DNS_UDP53_RESOLVER_IP —
// le workflow connaît l'IP et la pose dans mikcloud.env). À défaut, un
// réchauffage ASYNCHRONE résout la zone DNS-only (l'enregistrement A
// dns.403shield.ftci.fr pointe déjà la VM — N°345) : dnsUdp53ResolverIP
// ne bloque JAMAIS un handler (lecture instantanée env/cache, la
// résolution vit dans sa goroutine).
var (
	udp53ResolverMu    sync.Mutex
	udp53ResolverCache string
	udp53ResolverAt    time.Time
)

func dnsUdp53ResolverIP() string {
	if v := strings.TrimSpace(os.Getenv("DNS_UDP53_RESOLVER_IP")); v != "" {
		return v
	}
	udp53ResolverMu.Lock()
	defer udp53ResolverMu.Unlock()
	return udp53ResolverCache
}

// warmUdp53ResolverIP — résout la zone DNS-only et réchauffe le cache
// (succès : 1 h ; échec : 5 min de repos avant réessai). Goroutine : un
// échec réseau au boot ne retarde personne.
func warmUdp53ResolverIP() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	var r net.Resolver
	addrs, err := r.LookupIPAddr(ctx, dnsDotZone())
	udp53ResolverMu.Lock()
	udp53ResolverAt = time.Now()
	if err == nil {
		for _, a := range addrs {
			if v4 := a.IP.To4(); v4 != nil {
				udp53ResolverCache = v4.String()
				log.Printf("N°346 UDP53 : IP du résolveur détectée (%s → %s)", dnsDotZone(), udp53ResolverCache)
				udp53ResolverMu.Unlock()
				return
			}
		}
	}
	udp53ResolverMu.Unlock()
	log.Printf("N°346 UDP53 : IP du résolveur inconnue (DNS_UDP53_RESOLVER_IP absent, %s non résolu : %v) — la console affichera l'état réel dès détection", dnsDotZone(), err)
}

// ---------------------------------------------------------------------------
// Sonde probe-<token> (détection ligne + détournement FAI du port 53)
// ---------------------------------------------------------------------------

const (
	udp53ProbePrefix  = "probe-"
	udp53ProbeTokenLn = 12 // hex — 48 bits d'aléa, éphémère : suffisant
	udp53ProbeTTL     = 15 * time.Minute
	udp53ProbeCap     = 2048 // jetons vivants (les expirés partent au fil de l'eau)
)

// udp53ProbeEntry — un jeton de sonde en vol (mémoire seule : la sonde
// est un DIAGNOSTIC éphémère, rien à persister — doctrine « rebuildable »).
type udp53ProbeEntry struct {
	expiresAt time.Time
	ip        string // rempli à la PREMIÈRE arrivée : c'est elle, la révélation
	at        time.Time
}

var (
	udp53ProbeMu   sync.Mutex
	udp53ProbeLive = map[string]*udp53ProbeEntry{}
)

// udp53ProbeNewToken — crée un jeton, l'enregistre (cap : les plus
// anciens partent d'abord) et le retourne.
func udp53ProbeNewToken() string {
	b := make([]byte, udp53ProbeTokenLn/2)
	if _, err := rand.Read(b); err != nil {
		return "" // panne machine : pas de sonde plutôt qu'une sonde prévisible
	}
	token := hex.EncodeToString(b)
	now := time.Now()
	udp53ProbeMu.Lock()
	if len(udp53ProbeLive) >= udp53ProbeCap {
		oldest := ""
		var oldestAt time.Time
		for k, e := range udp53ProbeLive {
			if oldest == "" || e.expiresAt.Before(oldestAt) {
				oldest, oldestAt = k, e.expiresAt
			}
		}
		delete(udp53ProbeLive, oldest)
	}
	udp53ProbeLive[token] = &udp53ProbeEntry{expiresAt: now.Add(udp53ProbeTTL)}
	udp53ProbeMu.Unlock()
	return token
}

// udp53ProbeToken — le nom demandé est-il une sonde ? Retourne le jeton.
// Format exact : probe-<12 hex>.<zone> (un seul label devant la zone).
func udp53ProbeToken(name string) (string, bool) {
	zone := dnsDotZone()
	if !strings.HasSuffix(name, "."+zone) {
		return "", false
	}
	label := strings.TrimSuffix(name, "."+zone)
	if !strings.HasPrefix(label, udp53ProbePrefix) {
		return "", false
	}
	token := strings.TrimPrefix(label, udp53ProbePrefix)
	if len(token) != udp53ProbeTokenLn {
		return "", false
	}
	for i := 0; i < len(token); i++ {
		c := token[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') {
			continue
		}
		return "", false
	}
	return token, true
}

// udp53ProbeAnswer — LA réponse de la sonde : enregistre l'IP source
// (la révélation — même si la console a été ouverte en 4G, la commande
// tourne CHEZ le client), puis répond. A → l'IP du résolveur (la
// réponse EST l'adresse à configurer sur la box, TTL 30 : un nslookup
// propre à lire) ; autre type → NOERROR vide (l'arrivée est prouvée,
// le type ne concerne personne). Jeton inconnu/expiré → REFUSED :
// strictement la réponse d'une IP non liée, aucune différence observable.
func (a *API) udp53ProbeAnswer(token string, q dnsshield.Question, srcIP string) []byte {
	now := time.Now()
	udp53ProbeMu.Lock()
	e := udp53ProbeLive[token]
	if e == nil || now.After(e.expiresAt) {
		if e != nil {
			delete(udp53ProbeLive, token)
		}
		udp53ProbeMu.Unlock()
		return dnsshield.BuildRefused(q)
	}
	if e.ip == "" {
		e.ip, e.at = srcIP, now
	}
	udp53ProbeMu.Unlock()
	if q.Qtype == udp53QtypeA {
		if ip := dnsUdp53ResolverIP(); ip != "" {
			if parsed := net.ParseIP(ip); parsed != nil {
				return dnsshield.BuildAnswerA(q, parsed, 30)
			}
		}
	}
	return dnsshield.BuildNoError(q)
}

// ---------------------------------------------------------------------------
// Compteurs différés des liaisons (jamais une écriture par requête)
// ---------------------------------------------------------------------------

// udp53StatPending — compteur en vol d'UNE liaison : la maison interroge
// à la dizaine de requêtes par seconde en pointe — le store ne verra
// qu'un report par minute (granularité documentée ≤ 60 s).
type udp53StatPending struct {
	last time.Time
	n    int
}

var (
	udp53StatsMu sync.Mutex
	udp53Stats   = map[string]*udp53StatPending{}
	udp53FlushMu sync.Mutex // sérialise les flush (ticker + console)
)

// udp53Touch — note une requête servie à une IP LIÉE (hors verrou store :
// le chemin chaud ne touche que cette petite map).
func (a *API) udp53Touch(ip string) {
	now := time.Now()
	udp53StatsMu.Lock()
	if p := udp53Stats[ip]; p != nil {
		p.n++
		p.last = now
	} else {
		udp53Stats[ip] = &udp53StatPending{last: now, n: 1}
	}
	udp53StatsMu.Unlock()
}

// udp53FlushStats — reporte les compteurs différés dans les liaisons
// (appelé par le ticker 60 s ET par la lecture console — l'affichage est
// frais au moment où le parent regarde). Les IP sans liaison (supprimée
// entre-temps) sont ignorées : le compteur meurt avec le snapshot.
func (a *API) udp53FlushStats() int {
	udp53FlushMu.Lock()
	defer udp53FlushMu.Unlock()
	udp53StatsMu.Lock()
	if len(udp53Stats) == 0 {
		udp53StatsMu.Unlock()
		return 0
	}
	snap := udp53Stats
	udp53Stats = map[string]*udp53StatPending{}
	udp53StatsMu.Unlock()

	a.store.Lock()
	db := a.store.Data()
	n := 0
	for ip, p := range snap {
		b := model.FindDnsHomeBindingByIP(db, ip)
		if b == nil {
			continue // liaison supprimée entre-temps : le compteur s'efface
		}
		b.LastQueryAt = p.last.UTC().Format(time.RFC3339)
		b.QueryCount += p.n
		b.UpdatedAt = model.NowISO()
		n++
	}
	if n > 0 {
		a.store.Save()
	}
	a.store.Unlock()
	return n
}

// udp53FlushLoop — le report périodique (goroutine du serveur).
func (a *API) udp53FlushLoop() {
	t := time.NewTicker(udp53FlushEvery)
	defer t.Stop()
	for range t.C {
		a.udp53FlushStats()
	}
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

// ServeUDP53 — point d'entrée (main.go : go engine.ServeUDP53()).
// BLOQUANT. UDP et TCP doivent TOUS DEUX s'attacher (le client retente
// en TCP après une troncature TC=1 — un demi-serveur est un piège) ;
// l'échec de l'un ferme l'autre et désactive, franchement journalisé.
func (a *API) ServeUDP53() {
	addr := dnsUdp53Addr()
	pc, err := net.ListenPacket("udp", addr)
	if err != nil {
		log.Printf("N°346 UDP53 : écoute UDP %s impossible (%v) — bouclier limité à DoH/DoT (ports < 1024 : AmbientCapabilities requise ; port 53 souvent occupé par systemd-resolved, cf. ops-dns-udp53.yml)", addr, err)
		return
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		pc.Close()
		log.Printf("N°346 UDP53 : écoute TCP %s impossible (%v) — serveur maison désactivé (UDP fermé avec, un demi-serveur est un piège)", addr, err)
		return
	}
	udp53Enabled.Store(true)
	// Le réchauffage de l'IP du résolveur ne vaut que sans l'env
	// DNS_UDP53_RESOLVER_IP (le geste ops la pose : la résolution
	// DNS-only de secours ne doit pas tourner pour rien).
	if strings.TrimSpace(os.Getenv("DNS_UDP53_RESOLVER_IP")) == "" {
		go warmUdp53ResolverIP()
	}
	go a.udp53FlushLoop()
	go a.udp53AcceptTCP(ln)
	log.Printf("N°346 UDP53 : en écoute sur %s (UDP+TCP — toute la maison : liaisons IP→profil, sonde %s<token>.%s)", addr, udp53ProbePrefix, dnsDotZone())
	a.udp53ReadLoop(pc)
}

// udp53ReadLoop — la boucle UDP : lecture → limite en vol → une goroutine
// par paquet (le forward amont dure jusqu'à 2 s, la boucle n'attend pas).
func (a *API) udp53ReadLoop(pc net.PacketConn) {
	sem := make(chan struct{}, udp53MaxInflight)
	buf := make([]byte, udp53MaxUdpSize)
	for {
		n, addr, err := pc.ReadFrom(buf)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				continue
			}
			return // socket fermé (arrêt du service)
		}
		if n < 12 {
			continue // jamais un message DNS : perte silencieuse
		}
		msg := make([]byte, n)
		copy(msg, buf[:n])
		select {
		case sem <- struct{}{}:
		default:
			continue // flot en vol plein : perte (UDP normal, le client retente)
		}
		udp53ServeWG.Add(1)
		go func() {
			defer udp53ServeWG.Done()
			defer func() { <-sem }()
			a.udp53ServePacket(pc, addr, msg)
		}()
	}
}

// udp53ServePacket — UNE requête UDP : limiteur → décision → réponse
// bornée (RFC 2181).
func (a *API) udp53ServePacket(pc net.PacketConn, addr net.Addr, msg []byte) {
	ip := udp53SourceIP(addr)
	if ip == "" {
		return
	}
	if ok, _ := a.udp53Query.allow(ip); !ok {
		if q, err := dnsshield.ParseQuery(msg); err == nil {
			_, _ = pc.WriteTo(dnsshield.BuildRefused(q), addr)
		}
		return
	}
	resp := a.udp53Dispatch(ip, msg)
	if len(resp) == 0 {
		return // amont mort : silence honnête, la box retombe sur le DNS secondaire
	}
	_, _ = pc.WriteTo(udp53CapResponse(msg, resp), addr)
}

// udp53AcceptTCP — boucle TCP (le chemin de reprise des troncatures).
func (a *API) udp53AcceptTCP(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				continue
			}
			return // listener fermé (arrêt du service)
		}
		udp53ServeWG.Add(1)
		go func() {
			defer udp53ServeWG.Done()
			a.udp53TCPConn(conn)
		}()
	}
}

// udp53TCPConn — UNE connexion TCP : cadrage 2 octets (RFC 1035 §4.2.2),
// mêmes limites que DoT (jauge, vie max, silence).
func (a *API) udp53TCPConn(c net.Conn) {
	defer c.Close()
	if n := udp53Conns.Add(1); n > udp53TCPMaxConns {
		udp53Conns.Add(-1)
		dotLogThrottle("udp53flood", "N°346 UDP53 : > %d connexions TCP simultanées — flot coupé", udp53TCPMaxConns)
		return
	}
	defer udp53Conns.Add(-1)
	ip := udp53SourceIP(c.RemoteAddr())
	if ip == "" {
		return
	}
	start := time.Now()
	for {
		if time.Since(start) > udp53TCPMaxLife {
			return
		}
		_ = c.SetReadDeadline(time.Now().Add(udp53TCPIdle))
		msg, ok := readDnsTCPFrame(c)
		if !ok || len(msg) < 12 {
			return
		}
		if ok2, _ := a.udp53Query.allow(ip); !ok2 {
			if q, err := dnsshield.ParseQuery(msg); err == nil {
				_ = writeDnsTCPFrame(c, dnsshield.BuildRefused(q))
			}
			return
		}
		resp := a.udp53Dispatch(ip, msg)
		if len(resp) == 0 {
			return // amont mort : fermeture (miroir DoT)
		}
		if !writeDnsTCPFrame(c, resp) {
			return
		}
	}
}

// udp53Dispatch — LA décision, miroir exact de dotAnswer/handleDnsQuery
// (mêmes verrous d'ordre : sonde → liaison → allow → couvre-feu →
// bloquer → niveau). Retour vide = ne pas répondre (fail-open amont).
func (a *API) udp53Dispatch(srcIP string, msg []byte) []byte {
	q, perr := dnsshield.ParseQuery(msg)
	if perr != nil {
		// Fail-open : message incompréhensible → forward tel quel.
		if resp, err := dnsshield.Forward(msg); err == nil {
			return resp
		}
		return nil
	}
	// 1. La SONDE passe AVANT la liaison : elle révèle l'IP du logement
	//    à un client qui n'a encore RIEN lié — c'est son rôle.
	if token, ok := udp53ProbeToken(q.Name); ok {
		return a.udp53ProbeAnswer(token, q, srcIP)
	}
	// 2. Liaison IP → profil. Anti-open-resolver : pas de liaison →
	//    REFUSED (la réponse fait la taille de la question : jamais un
	//    amplificateur public).
	profile := a.udp53ProfileForIP(srcIP)
	if profile == nil {
		return dnsshield.BuildRefused(q)
	}
	a.udp53Touch(srcIP)
	// 3. Le moteur (l'ordre figé N°339, identique sur les trois canaux).
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
		dotLogThrottle("udp53upstream", "N°346 UDP53 : amont mort — silence (la box retombe sur le DNS secondaire)")
		return nil
	}
}

// udp53ProfileForIP — la liaison + son profil, copie sous verrou (miroir
// du résolveur DoH : une chaîne copiée ne peut pas être invalidée par une
// réallocation du registre). Profil inconnu/inactif (supprimé, bloqué) →
// nil → REFUSED : la maison retombe honnêtement sur le DNS du FAI.
func (a *API) udp53ProfileForIP(ip string) *model.DnsProfile {
	a.store.Lock()
	db := a.store.Data()
	b := model.FindDnsHomeBindingByIP(db, ip)
	if b == nil {
		a.store.Unlock()
		return nil
	}
	p := model.FindDnsProfileByID(db, b.ProfileID)
	if p == nil || p.Status != model.DnsProfileActive {
		a.store.Unlock()
		return nil
	}
	cp := *p
	a.store.Unlock()
	return &cp
}

// udp53SourceIP — l'IP source d'une adresse UDP/TCP (forme canonique —
// les liaisons stockent la même via NormalizeDnsHomeIP).
func udp53SourceIP(addr net.Addr) string {
	switch a := addr.(type) {
	case *net.UDPAddr:
		return a.IP.String()
	case *net.TCPAddr:
		return a.IP.String()
	}
	if host, _, err := net.SplitHostPort(addr.String()); err == nil {
		return host
	}
	return ""
}

// ---------------------------------------------------------------------------
// Cadrage TCP + bornage UDP (RFC 1035 §4.2.2, RFC 2181 §9)
// ---------------------------------------------------------------------------

// readDnsTCPFrame — un message : 2 octets de longueur + le corps (miroir
// readDotFrame, sans TLS). Tout écart ferme la connexion.
func readDnsTCPFrame(c net.Conn) ([]byte, bool) {
	var hdr [2]byte
	if _, err := io.ReadFull(c, hdr[:]); err != nil {
		return nil, false
	}
	n := int(binary.BigEndian.Uint16(hdr[:]))
	if n < 12 {
		return nil, false
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(c, buf); err != nil {
		return nil, false
	}
	return buf, true
}

// writeDnsTCPFrame — répond en cadrant le message.
func writeDnsTCPFrame(c net.Conn, msg []byte) bool {
	if len(msg) > 0xFFFF {
		return false
	}
	var hdr [2]byte
	binary.BigEndian.PutUint16(hdr[:], uint16(len(msg)))
	if _, err := c.Write(hdr[:]); err != nil {
		return false
	}
	_, err := c.Write(msg)
	return err == nil
}

// udp53CapResponse — borne la réponse pour l'UDP : sans EDNS la limite
// est 512 ; avec EDNS, la taille annoncée par le client (plafonnée à
// udp53MaxUdpSize) ; au-delà → TC=1, le client retente en TCP (RFC 2181
// §9 — notre serveur TCP/53 l'attend).
func udp53CapResponse(query, resp []byte) []byte {
	if len(resp) <= 512 {
		return resp
	}
	limit := 512
	if s := int(ednsUDPSize(query)); s > 512 {
		limit = s
		if limit > udp53MaxUdpSize {
			limit = udp53MaxUdpSize
		}
	}
	if len(resp) <= limit {
		return resp
	}
	return udp53Truncated(query, resp)
}

// udp53Truncated — la réponse tronquée : en-tête de la réponse (QR/rcode
// conservés) + TC=1 + compteurs vidés + la question rééchée depuis la
// REQUÊTE (identique octet pour octet — la compression n'existe pas dans
// une question, RFC 1035 §4.1.2).
func udp53Truncated(query, resp []byte) []byte {
	qEnd := dnsQuestionEnd(query)
	if qEnd == 0 || len(resp) < 12 {
		return nil // requête incohérente : perte honnête plutôt qu'un paquet faux
	}
	out := make([]byte, 12, qEnd)
	copy(out, resp[:12])
	out[2] |= 0x02            // TC=1
	for i := 6; i < 12; i++ { // ANCOUNT/NSCOUNT/ARCOUNT = 0
		out[i] = 0
	}
	out = append(out, query[12:qEnd]...)
	return out
}

// dnsQuestionEnd — offset juste après la section question (0 = illisible).
func dnsQuestionEnd(msg []byte) int {
	if len(msg) < 12 {
		return 0
	}
	off := 12
	for {
		if off >= len(msg) {
			return 0
		}
		l := int(msg[off])
		off++
		if l == 0 {
			break
		}
		if l > 63 || off+l > len(msg) {
			return 0
		}
		off += l
	}
	if off+4 > len(msg) {
		return 0
	}
	return off + 4
}

// ednsUDPSize — la taille UDP annoncée par l'EDNS0 du client (OPT type
// 41 : le champ class EST la taille, RFC 6891 §6.1.2). 0 si pas d'EDNS
// ou illisible (conservateur : 512). Tolérante : pointeurs de compression
// acceptés dans les noms d'enregistrements additionnels, tout écart
// renonce (la requête a de toute façon été servie par le chemin normal).
func ednsUDPSize(msg []byte) uint16 {
	if len(msg) < 12 {
		return 0
	}
	if binary.BigEndian.Uint16(msg[2:4])&0x8000 != 0 {
		return 0 // une réponse n'annonce rien (nous bornons des réponses À des requêtes)
	}
	if binary.BigEndian.Uint16(msg[6:8]) != 0 || binary.BigEndian.Uint16(msg[8:10]) != 0 {
		return 0 // une question propre : sections réponse/autorité vides
	}
	arcount := int(binary.BigEndian.Uint16(msg[10:12]))
	if arcount == 0 {
		return 0
	}
	off := dnsQuestionEnd(msg)
	if off == 0 {
		return 0
	}
	for i := 0; i < arcount; i++ {
		for { // nom : labels ou pointeur (non suivi — seule la taille compte)
			if off >= len(msg) {
				return 0
			}
			b := msg[off]
			if b&0xC0 == 0xC0 {
				off += 2
				break
			}
			off++
			if b == 0 {
				break
			}
			if int(b) > 63 || off+int(b) > len(msg) {
				return 0
			}
			off += int(b)
		}
		if off+10 > len(msg) {
			return 0
		}
		rtype := binary.BigEndian.Uint16(msg[off : off+2])
		rclass := binary.BigEndian.Uint16(msg[off+2 : off+4])
		rdlen := int(binary.BigEndian.Uint16(msg[off+8 : off+10]))
		off += 10 + rdlen
		if off > len(msg) {
			return 0
		}
		if rtype == 41 {
			return rclass
		}
	}
	return 0
}
