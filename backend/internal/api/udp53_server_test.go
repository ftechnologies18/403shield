// udp53_server_test.go — N°346 — tests du résolveur maison UDP/53 + TCP/53
// et des handlers console (liaisons + sonde). RÉSEAU RÉEL sur 127.0.0.1
// uniquement : le harnais pose TCP :0 puis UDP sur LE MÊME port (les deux
// espaces sont indépendants — miroir de la prod :53/udp+:53/tcp). Les
// sources non liées sont jouées depuis 127.0.0.2 (tout le /8 de boucle
// est routable sous Linux) ; l'amont est stubbé (dnsshield.Forward —
// discipline maison des indirections, AUCUN réseau réel au-delà de la
// boucle). La zone SNI vient de l'env DNS_DOT_ZONE (jamais la vraie).
package api

import (
	"encoding/binary"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/dnsshield"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// ---------------------------------------------------------------------------
// Harnais UDP53
// ---------------------------------------------------------------------------

// udp53TestZone — zone des tests (env, jamais la vraie production).
const udp53TestZone = "maison.example"

// udp53TestResolver — l'IP du résolveur des tests (TEST-NET-3, RFC 5737 —
// l'env évite toute résolution réseau réelle).
const udp53TestResolver = "203.0.113.53"

// udp53TestEnv — pose l'environnement du jalon maison (zone + IP
// résolveur) ET réinitialise les états package-level (compteurs différés,
// sondes vivantes) : chaque test est hermétique, aucune pollution croisée.
func udp53TestEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DNS_DOT_ZONE", udp53TestZone)
	t.Setenv("DNS_UDP53_RESOLVER_IP", udp53TestResolver)
	udp53StatsMu.Lock()
	udp53Stats = map[string]*udp53StatPending{}
	udp53StatsMu.Unlock()
	udp53ProbeMu.Lock()
	udp53ProbeLive = map[string]*udp53ProbeEntry{}
	udp53ProbeMu.Unlock()
}

// startUdp53Test — dresse le serveur maison : TCP 127.0.0.1:0 puis UDP
// sur LE MÊME port, boucles en arrière-plan. La fermeture DRAINE les
// requêtes en vol (udp53ServeWG) : aucune goroutine ne survit au test —
// l'échange de stub dnsshield.Forward du test SUIVANT ne peut jamais
// croiser une lecture en vol (discipline -race).
func startUdp53Test(t *testing.T, a *API) (string, func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("écoute TCP de test : %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	pc, err := net.ListenPacket("udp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		_ = ln.Close()
		t.Fatalf("écoute UDP de test : %v", err)
	}
	go a.udp53AcceptTCP(ln)
	go a.udp53ReadLoop(pc)
	addr := ln.Addr().String()
	return addr, func() {
		_ = ln.Close()
		_ = pc.Close()
		udp53Drain()
	}
}

// udp53RoundTrip — UNE requête UDP depuis l'IP source donnée ("" =
// 127.0.0.1 ; "127.0.0.2" = source non liée de test). nil = silence
// (fail-open amont) ou perte.
func udp53RoundTrip(t *testing.T, addr, srcIP string, msg []byte) []byte {
	t.Helper()
	var d net.Dialer
	if srcIP != "" {
		d.LocalAddr = &net.UDPAddr{IP: net.ParseIP(srcIP)}
	}
	conn, err := d.Dial("udp", addr)
	if err != nil {
		t.Fatalf("connexion UDP (%s) : %v", srcIP, err)
	}
	defer conn.Close()
	if _, err := conn.Write(msg); err != nil {
		t.Fatalf("émission UDP : %v", err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	buf := make([]byte, 65535)
	n, err := conn.Read(buf)
	if err != nil {
		return nil // silence : timeout (fail-open) ou perte
	}
	return buf[:n]
}

// udp53TCPRoundTrip — UNE requête TCP (cadrage 2 octets, RFC 1035 §4.2.2).
func udp53TCPRoundTrip(t *testing.T, addr string, msg []byte) []byte {
	t.Helper()
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatalf("connexion TCP : %v", err)
	}
	defer conn.Close()
	var hdr [2]byte
	binary.BigEndian.PutUint16(hdr[:], uint16(len(msg)))
	if _, err := conn.Write(hdr[:]); err != nil {
		t.Fatalf("émission TCP : %v", err)
	}
	if _, err := conn.Write(msg); err != nil {
		t.Fatalf("émission TCP : %v", err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var rhdr [2]byte
	if _, err := readFullTCP(conn, rhdr[:]); err != nil {
		return nil
	}
	n := int(binary.BigEndian.Uint16(rhdr[:]))
	buf := make([]byte, n)
	if _, err := readFullTCP(conn, buf); err != nil {
		return nil
	}
	return buf
}

// readFullTCP — lecture intégrale sans io (miroir readFull DoT).
func readFullTCP(conn net.Conn, buf []byte) (int, error) {
	total := 0
	for total < len(buf) {
		n, err := conn.Read(buf[total:])
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// udp53Seed — un client + un profil actif (règle « jeux.example ») + la
// liaison de l'IP donnée vers CE profil.
func udp53Seed(st *store.Store, ip string) {
	st.Data().TunnelClients = append(st.Data().TunnelClients, model.TunnelClient{
		ID: "tc-dns", Email: "parent@example.com", Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-udp", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Maison de test", Level: model.DnsLevelFamily,
		BlockRules: "jeux.example", AllowRules: "",
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
		ID: "dh-1", ProfileID: "dp-udp", OwnerEmail: "parent@example.com",
		IP: ip, Label: "Maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

// dnsQueryMsgEDNS — une requête wire AVEC EDNS0 (OPT type 41, taille
// annoncée) — pour le test du bornage RFC 2181.
func dnsQueryMsgEDNS(id uint16, name string, qtype uint16, udpsize uint16) []byte {
	out := dnsQueryMsg(id, name, qtype)
	// ARCOUNT=1
	binary.BigEndian.PutUint16(out[10:12], 1)
	// OPT : nom racine (0), type 41, class=taille, ttl 0, rdlen 0.
	out = append(out, 0x00)
	out = binary.BigEndian.AppendUint16(out, 41)
	out = binary.BigEndian.AppendUint16(out, udpsize)
	out = binary.BigEndian.AppendUint32(out, 0)
	out = binary.BigEndian.AppendUint16(out, 0)
	return out
}

// udp53Rcode / udp53ANCount — lectures d'en-tête (miroir dotRcode).
func udp53Rcode(msg []byte) int        { return int(msg[3] & 0x0F) }
func udp53ANCount(msg []byte) int      { return int(binary.BigEndian.Uint16(msg[6:8])) }
func udp53IsTruncated(msg []byte) bool { return msg[2]&0x02 != 0 }

// ---------------------------------------------------------------------------
// Tests — le résolveur maison (routage par IP source)
// ---------------------------------------------------------------------------

// TestUDP53BlockedDomain — IP LIÉE + règle bloquée → sinkhole 0.0.0.0
// (miroir exact DoH/DoT : le même moteur, le même ordre de décision).
func TestUDP53BlockedDomain(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	resp := udp53RoundTrip(t, addr, "", dnsQueryMsg(0x61, "www.jeux.example", 1))
	if resp == nil {
		t.Fatal("aucune réponse UDP (la maison liée devait être servie)")
	}
	if udp53Rcode(resp) != 0 || udp53ANCount(resp) != 1 {
		t.Fatalf("attendu sinkhole NOERROR/AN=1, obtenu rcode=%d AN=%d", udp53Rcode(resp), udp53ANCount(resp))
	}
	if string(resp[len(resp)-4:]) != "\x00\x00\x00\x00" {
		t.Fatalf("attendu RDATA 0.0.0.0 en queue, obtenu % x", resp[len(resp)-4:])
	}
	// Journal minimal : le blocage est consigné (après flush immédiat).
	st.Lock()
	events := len(st.Data().DnsEvents)
	st.Unlock()
	if events != 1 {
		t.Fatalf("1 blocage attendu au journal, obtenu %d", events)
	}
}

// TestUDP53AllowedForwards — IP liée + question autorisée → l'amont
// stubbé répond tel quel (fail-open du chemin normal). Le stub est posé
// AVANT le serveur et restauré APRÈS son drain (LIFO des defers) : jamais
// de lecture en vol pendant l'échange (discipline -race).
func TestUDP53AllowedForwards(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		out := make([]byte, len(q))
		copy(out, q)
		out[2] |= 0x80
		return out, nil
	}
	addr, stop := startUdp53Test(t, a)
	defer stop()

	msg := dnsQueryMsg(0x62, "iana.org", 1)
	resp := udp53RoundTrip(t, addr, "", msg)
	if resp == nil {
		t.Fatal("aucune réponse UDP")
	}
	if len(resp) != len(msg) || resp[1] != 0x62 || resp[2]&0x80 == 0 {
		t.Fatalf("réponse amont attendue telle quelle, obtenu %d octets (id=% x)", len(resp), resp[:2])
	}
}

// TestUDP53UnboundRefused — ANTI-OPEN-RESOLVER : source sans liaison →
// REFUSED (jamais une résolution pour des tiers, jamais un amplificateur).
func TestUDP53UnboundRefused(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1") // seule 127.0.0.1 est liée
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	resp := udp53RoundTrip(t, addr, "127.0.0.2", dnsQueryMsg(0x63, "example.com", 1))
	if resp == nil {
		t.Fatal("la source non liée devait recevoir REFUSED (pas un silence)")
	}
	if udp53Rcode(resp) != 5 {
		t.Fatalf("attendu REFUSED (5), obtenu rcode=%d", udp53Rcode(resp))
	}
	if udp53ANCount(resp) != 0 {
		t.Fatal("REFUSED ne porte JAMAIS de réponse")
	}
}

// TestUDP53InactiveProfileRefused — liaison vers un profil bloqué →
// REFUSED (la maison retombe honnêtement, jamais de réponse fabriquée).
func TestUDP53InactiveProfileRefused(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Data().DnsProfiles[0].Status = model.DnsProfileBlocked
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	resp := udp53RoundTrip(t, addr, "", dnsQueryMsg(0x64, "example.com", 1))
	if resp == nil {
		t.Fatal("attendu REFUSED (pas un silence)")
	}
	if udp53Rcode(resp) != 5 {
		t.Fatalf("attendu REFUSED (5), obtenu rcode=%d", udp53Rcode(resp))
	}
}

// TestUDP53AmontMortSilence — amont injoignable → silence UDP (la box
// retombe sur le DNS du FAI configuré en secondaire — fail-open).
func TestUDP53AmontMortSilence(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func([]byte) ([]byte, error) { return nil, errString("amont mort") }
	addr, stop := startUdp53Test(t, a)
	defer stop()

	if resp := udp53RoundTrip(t, addr, "", dnsQueryMsg(0x65, "iana.org", 1)); resp != nil {
		t.Fatalf("attendu le silence (fail-open amont), obtenu %d octets", len(resp))
	}
}

// ---------------------------------------------------------------------------
// Tests — la sonde probe-<token>
// ---------------------------------------------------------------------------

// TestUDP53Probe — la sonde répond AVANT la liaison (source non liée
// comprise — c'est son rôle) : A → l'IP du résolveur, l'arrivée est
// enregistrée avec l'IP source (la RÉVÉLATION).
func TestUDP53Probe(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	token := udp53ProbeNewToken()
	if token == "" {
		t.Fatal("jeton de sonde non généré")
	}
	name := "probe-" + token + "." + udp53TestZone
	// Depuis une IP NON LIÉE : la sonde passe avant la liaison.
	resp := udp53RoundTrip(t, addr, "127.0.0.2", dnsQueryMsg(0x66, name, 1))
	if resp == nil {
		t.Fatal("la sonde devait répondre (source non liée comprise)")
	}
	if udp53Rcode(resp) != 0 || udp53ANCount(resp) != 1 {
		t.Fatalf("attendu NOERROR/AN=1 (l'IP du résolveur), obtenu rcode=%d AN=%d", udp53Rcode(resp), udp53ANCount(resp))
	}
	want := net.ParseIP(udp53TestResolver).To4()
	if string(resp[len(resp)-4:]) != string(want) {
		t.Fatalf("attendu RDATA %s, obtenu % x", udp53TestResolver, resp[len(resp)-4:])
	}
	// L'arrivée est enregistrée avec l'IP source.
	udp53ProbeMu.Lock()
	e := udp53ProbeLive[token]
	udp53ProbeMu.Unlock()
	if e == nil || e.ip != "127.0.0.2" {
		t.Fatalf("la sonde devait révéler l'IP source 127.0.0.2, obtenu %+v", e)
	}
}

// TestUDP53ProbeUnknownRefused — jeton inconnu → REFUSED : strictement la
// réponse d'une IP non liée (anti-énumération, aucune différence observable).
func TestUDP53ProbeUnknownRefused(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	fake := "ffffffffffff"
	if _, ok := udp53ProbeToken("probe-" + fake + "." + udp53TestZone); !ok {
		t.Fatal("le nom de sonde bien formé devait être reconnu")
	}
	resp := udp53RoundTrip(t, addr, "127.0.0.2", dnsQueryMsg(0x67, "probe-"+fake+"."+udp53TestZone, 1))
	if resp == nil {
		t.Fatal("attendu REFUSED (pas un silence)")
	}
	if udp53Rcode(resp) != 5 {
		t.Fatalf("attendu REFUSED (5), obtenu rcode=%d", udp53Rcode(resp))
	}
}

// TestUDP53ProbeTokenFormat — le format de la sonde : un seul label
// « probe-<12 hex>.<zone> », tout le reste est une question normale.
func TestUDP53ProbeTokenFormat(t *testing.T) {
	udp53TestEnv(t)
	if _, ok := udp53ProbeToken("probe-abcdef012345." + udp53TestZone); !ok {
		t.Error("probe-<12 hex>.<zone> devait être reconnu")
	}
	if _, ok := udp53ProbeToken("probe-abc." + udp53TestZone); ok {
		t.Error("jeton trop court : refusé attendu")
	}
	if _, ok := udp53ProbeToken("probe-abcdef012345." + udp53TestZone + "."); ok {
		t.Error("point final : refusé attendu")
	}
	if _, ok := udp53ProbeToken("x.probe-abcdef012345." + udp53TestZone); ok {
		t.Error("deux labels : refusé attendu")
	}
	if _, ok := udp53ProbeToken("probe-abcdef012345.autre.example"); ok {
		t.Error("hors zone : refusé attendu")
	}
	if _, ok := udp53ProbeToken("abcdef012345." + udp53TestZone); ok {
		t.Error("sans préfixe : refusé attendu")
	}
}

// ---------------------------------------------------------------------------
// Tests — bornage UDP (RFC 2181 §9) et TCP
// ---------------------------------------------------------------------------

// TestUDP53Truncation — réponse amont de 600 octets à une question SANS
// EDNS → TC=1, ≤ 512 octets, question rééchée (le client retente en TCP).
func TestUDP53Truncation(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		out := make([]byte, 600)
		copy(out[:12], q[:12])
		out[2] |= 0x80
		return out, nil
	}
	addr, stop := startUdp53Test(t, a)
	defer stop()

	query := dnsQueryMsg(0x68, "iana.org", 1)
	resp := udp53RoundTrip(t, addr, "", query)
	if resp == nil {
		t.Fatal("attendu une réponse TRONQUÉE, pas un silence")
	}
	if len(resp) > 512 {
		t.Fatalf("la réponse sans EDNS devait être ≤ 512, obtenue %d", len(resp))
	}
	if !udp53IsTruncated(resp) {
		t.Fatal("le bit TC devait être posé (le client retente en TCP)")
	}
	if udp53ANCount(resp) != 0 {
		t.Fatal("une réponse tronquée ne porte pas de réponses")
	}
	qEnd := dnsQuestionEnd(query)
	if string(resp[12:]) != string(query[12:qEnd]) {
		t.Fatal("la question devait être rééchée depuis la requête")
	}
}

// TestUDP53EDNSLargeResponse — le client annonce 1232 (EDNS0) : la
// réponse de 1000 octets passe ENTIÈRE (≤ taille annoncée, ≤ plafond).
func TestUDP53EDNSLargeResponse(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		out := make([]byte, 1000)
		copy(out[:12], q[:12])
		out[2] |= 0x80
		return out, nil
	}
	addr, stop := startUdp53Test(t, a)
	defer stop()

	resp := udp53RoundTrip(t, addr, "", dnsQueryMsgEDNS(0x69, "iana.org", 1, 1232))
	if resp == nil {
		t.Fatal("aucune réponse UDP")
	}
	if len(resp) != 1000 {
		t.Fatalf("la réponse EDNS 1232 devait passer entière (1000), obtenue %d", len(resp))
	}
	if udp53IsTruncated(resp) {
		t.Fatal("TC ne devait PAS être posé")
	}
}

// TestUDP53TCPRoundTrip — le chemin TCP (reprise des troncatures) :
// cadrage 2 octets, même décision que l'UDP (règle bloquée → sinkhole).
func TestUDP53TCPRoundTrip(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	addr, stop := startUdp53Test(t, a)
	defer stop()

	resp := udp53TCPRoundTrip(t, addr, dnsQueryMsg(0x6a, "www.jeux.example", 1))
	if resp == nil {
		t.Fatal("aucune réponse TCP")
	}
	if udp53Rcode(resp) != 0 || udp53ANCount(resp) != 1 {
		t.Fatalf("attendu sinkhole NOERROR/AN=1, obtenu rcode=%d AN=%d", udp53Rcode(resp), udp53ANCount(resp))
	}
	if string(resp[len(resp)-4:]) != "\x00\x00\x00\x00" {
		t.Fatalf("attendu RDATA 0.0.0.0 en queue, obtenu % x", resp[len(resp)-4:])
	}
}

// ---------------------------------------------------------------------------
// Tests — compteurs différés des liaisons
// ---------------------------------------------------------------------------

// TestUDP53FlushStats — les touches sont reportées dans la liaison (≤ 60 s
// de granularité : JAMAIS une écriture par requête).
func TestUDP53FlushStats(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	udp53Seed(st, "127.0.0.1")
	st.Unlock()
	// Deux requêtes autorisées servies à l'IP liée (l'amont stubbé : le test
	// reste dans la boucle — stub AVANT serveur, restore APRÈS drain).
	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		out := make([]byte, len(q))
		copy(out, q)
		out[2] |= 0x80
		return out, nil
	}
	addr, stop := startUdp53Test(t, a)
	defer stop()

	for i := 0; i < 2; i++ {
		if resp := udp53RoundTrip(t, addr, "", dnsQueryMsg(uint16(0x70+i), "iana.org", 1)); resp == nil {
			t.Fatal("requête autorisée sans réponse")
		}
	}
	if n := a.udp53FlushStats(); n != 1 {
		t.Fatalf("1 liaison devait être reportée, obtenu %d", n)
	}
	st.Lock()
	b := model.FindDnsHomeBindingByIP(st.Data(), "127.0.0.1")
	count, last := b.QueryCount, b.LastQueryAt
	st.Unlock()
	if count != 2 {
		t.Fatalf("compteur attendu 2, obtenu %d", count)
	}
	if last == "" {
		t.Fatal("lastQueryAt devait être posé")
	}
}

// ---------------------------------------------------------------------------
// Tests — handlers console : liaisons
// ---------------------------------------------------------------------------

// dnsHomeReq — requête console authentifiée (segment {id}/{token} posés à
// la main pour les routes paramétrées).
func dnsHomeReq(method, target, body, idValue, tokenValue string) *http.Request {
	claims := &auth.Claims{Sub: "tc-dns", Role: "tunnel"}
	req := tunnelAuthReq(method, target, claims, body)
	if idValue != "" {
		req.SetPathValue("id", idValue)
	}
	if tokenValue != "" {
		req.SetPathValue("token", tokenValue)
	}
	return req
}

// TestDnsHomeClaimAndList — le parcours complet : liaison revendiquée avec
// IP explicite, liste avec jointure profil + IP de la requête.
func TestDnsHomeClaimAndList(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home",
		`{"profileId":"dp-1","label":"Maison","ip":"41.207.10.20"}`, "", ""))
	if rec.Code != http.StatusCreated {
		t.Fatalf("attendu 201, obtenu %d (%s)", rec.Code, rec.Body.String())
	}
	var row map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &row); err != nil {
		t.Fatalf("ligne illisible : %v", err)
	}
	if row["ip"] != "41.207.10.20" || row["profileName"] != "Famille" || row["label"] != "Maison" {
		t.Fatalf("ligne incohérente : %+v", row)
	}

	// La liste porte la liaison + l'IP de la requête + l'état réel du serveur.
	req := dnsHomeReq(http.MethodGet, "/api/dnsshield/home", "", "", "")
	req.Header.Set("X-Forwarded-For", "196.200.10.10")
	rec = httptest.NewRecorder()
	a.handleDnsHomeList(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("liste : attendu 200, obtenu %d", rec.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("liste illisible : %v", err)
	}
	if out["myIp"] != "196.200.10.10" {
		t.Fatalf("myIp attendu 196.200.10.10, obtenu %v", out["myIp"])
	}
	if out["resolverIp"] != udp53TestResolver {
		t.Fatalf("resolverIp attendu %s, obtenu %v", udp53TestResolver, out["resolverIp"])
	}
	if out["udp53Enabled"] != false {
		t.Fatal("udp53Enabled devait être l'état RÉEL (faux : serveur non démarré dans CE test)")
	}
	bindings, _ := out["bindings"].([]any)
	if len(bindings) != 1 {
		t.Fatalf("1 liaison attendue, obtenues %d", len(bindings))
	}
}

// TestDnsHomeClaimFromRequestIP — ip ABSENTE du corps → l'IP de la
// REQUÊTE (le client est chez lui : c'est celle de sa box).
func TestDnsHomeClaimFromRequestIP(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	req := dnsHomeReq(http.MethodPost, "/api/dnsshield/home", `{"profileId":"dp-1"}`, "", "")
	req.Header.Set("X-Forwarded-For", "41.207.10.99")
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("attendu 201, obtenu %d (%s)", rec.Code, rec.Body.String())
	}
	var row map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &row)
	if row["ip"] != "41.207.10.99" {
		t.Fatalf("l'IP de la requête devait être liée, obtenu %v", row["ip"])
	}
}

// TestDnsHomeClaimInvalidIP — IP privée/illéisible → 400 honnête (la
// console verrait un réseau interne : proxy mal configuré, pas une maison).
func TestDnsHomeClaimInvalidIP(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	for _, badIP := range []string{"192.168.1.1", "10.0.0.5", "127.0.0.1", "pas-un-ip"} {
		body := `{"profileId":"dp-1","ip":"` + badIP + `"}`
		rec := httptest.NewRecorder()
		a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home", body, "", ""))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("ip %q : attendu 400, obtenu %d", badIP, rec.Code)
		}
	}
}

// TestDnsHomeClaimForeignProfile — le profil d'un autre → 404 uniforme
// (anti-énumération, miroir des profils N°339).
func TestDnsHomeClaimForeignProfile(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().TunnelClients = append(st.Data().TunnelClients, model.TunnelClient{
		ID: "tc-x", Email: "autre@example.com", Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-x", PublicID: "1234abcd1234abcd", OwnerEmail: "autre@example.com",
		Name: "Leur profil", Level: model.DnsLevelOff,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home",
		`{"profileId":"dp-x","ip":"41.207.10.20"}`, "", ""))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("attendu 404 (profil d'autrui), obtenu %d", rec.Code)
	}
}

// TestDnsHomeClaimForeignIP — l'IP déjà liée à UN AUTRE compte → 409
// honnête (aucune divulgation d'identité).
func TestDnsHomeClaimForeignIP(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
		ID: "dh-x", ProfileID: "dp-1", OwnerEmail: "autre@example.com",
		IP: "41.207.10.20", Label: "Leur maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home",
		`{"profileId":"dp-1","ip":"41.207.10.20"}`, "", ""))
	if rec.Code != http.StatusConflict {
		t.Fatalf("attendu 409 (IP d'autrui), obtenu %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ip_bound") {
		t.Fatalf("code ip_bound attendu, obtenu %s", rec.Body.String())
	}
}

// TestDnsHomeClaimRebind — re-liér SA propre IP → changement de profil de
// la maison (200, pas d'erreur inutile, pas de nouvelle ligne).
func TestDnsHomeClaimRebind(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	for i, name := range []string{"Famille", "Ados"} {
		st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
			ID: "dp-" + strconv.Itoa(i+1), PublicID: "abcd1234abcd123" + strconv.Itoa(i),
			OwnerEmail: "parent@example.com", Name: name, Level: model.DnsLevelFamily,
			Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
		})
	}
	st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
		ID: "dh-1", ProfileID: "dp-1", OwnerEmail: "parent@example.com",
		IP: "41.207.10.20", Label: "Maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home",
		`{"profileId":"dp-2","ip":"41.207.10.20"}`, "", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("re-liaison : attendu 200, obtenu %d (%s)", rec.Code, rec.Body.String())
	}
	var row map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &row)
	if row["profileName"] != "Ados" {
		t.Fatalf("la maison devait passer au profil Ados, obtenu %v", row["profileName"])
	}
	st.Lock()
	n := len(st.Data().DnsHomeBindings)
	st.Unlock()
	if n != 1 {
		t.Fatalf("la re-liaison ne crée PAS de ligne : %d obtenues", n)
	}
}

// TestDnsHomeClaimQuota — la 6e liaison → 409 dns_home_full.
func TestDnsHomeClaimQuota(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	for i := 0; i < model.MaxDnsHomeBindingsPerEmail; i++ {
		st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
			ID: "dh-" + strconv.Itoa(i), ProfileID: "dp-1", OwnerEmail: "parent@example.com",
			IP: "41.207.10." + strconv.Itoa(30+i), Label: "Maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
		})
	}
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home",
		`{"profileId":"dp-1","ip":"41.207.10.99"}`, "", ""))
	if rec.Code != http.StatusConflict {
		t.Fatalf("attendu 409 (quota), obtenu %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "dns_home_full") {
		t.Fatalf("code dns_home_full attendu, obtenu %s", rec.Body.String())
	}
}

// TestDnsHomeDelete — suppression par le propriétaire, 404 pour autrui.
func TestDnsHomeDelete(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
		ID: "dh-1", ProfileID: "dp-1", OwnerEmail: "parent@example.com",
		IP: "41.207.10.20", Label: "Maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsHomeDelete(rec, dnsHomeReq(http.MethodDelete, "/api/dnsshield/home/dh-1", "", "dh-1", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	st.Lock()
	n := len(st.Data().DnsHomeBindings)
	st.Unlock()
	if n != 0 {
		t.Fatalf("liaison supprimée attendue, %d restantes", n)
	}
	rec = httptest.NewRecorder()
	a.handleDnsHomeDelete(rec, dnsHomeReq(http.MethodDelete, "/api/dnsshield/home/dh-1", "", "dh-1", ""))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("re-suppression : attendu 404, obtenu %d", rec.Code)
	}
}

// TestDnsProfileDeleteCascadesBindings — supprimer un profil emporte ses
// liaisons maison (jamais une maison pointant un profil disparu).
func TestDnsProfileDeleteCascadesBindings(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Famille", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsHomeBindings = append(st.Data().DnsHomeBindings, model.DnsHomeBinding{
		ID: "dh-1", ProfileID: "dp-1", OwnerEmail: "parent@example.com",
		IP: "41.207.10.20", Label: "Maison", CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileDelete(rec, dnsReq(http.MethodDelete, "/api/dnsshield/profiles/dp-1", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("suppression profil : attendu 200, obtenu %d", rec.Code)
	}
	st.Lock()
	n := len(st.Data().DnsHomeBindings)
	st.Unlock()
	if n != 0 {
		t.Fatalf("la liaison du profil supprimé devait partir avec lui, %d restantes", n)
	}
}

// ---------------------------------------------------------------------------
// Tests — handlers console : la sonde
// ---------------------------------------------------------------------------

// TestDnsHomeProbeLifecycle — création → pending → received (l'arrivée
// enregistrée par le serveur) → expirée (404).
func TestDnsHomeProbeLifecycle(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsHomeProbeCreate(rec, dnsHomeReq(http.MethodPost, "/api/dnsshield/home/probe", "{}", "", ""))
	if rec.Code != http.StatusCreated {
		t.Fatalf("création sonde : attendu 201, obtenu %d", rec.Code)
	}
	var probe map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &probe); err != nil {
		t.Fatalf("sonde illisible : %v", err)
	}
	token, _ := probe["token"].(string)
	if len(token) != udp53ProbeTokenLn {
		t.Fatalf("jeton 12 hex attendu, obtenu %q", token)
	}
	if probe["name"] != "probe-"+token+"."+udp53TestZone {
		t.Fatalf("nom de sonde incohérent : %v", probe["name"])
	}

	// Pending avant toute arrivée.
	rec = httptest.NewRecorder()
	a.handleDnsHomeProbeStatus(rec, dnsHomeReq(http.MethodGet, "/api/dnsshield/home/probe/"+token, "", "", token))
	if rec.Code != http.StatusOK {
		t.Fatalf("statut : attendu 200, obtenu %d", rec.Code)
	}
	var status map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &status)
	if status["status"] != "pending" {
		t.Fatalf("attendu pending, obtenu %v", status["status"])
	}

	// L'arrivée (le chemin RÉEL du serveur : udp53ProbeAnswer).
	q := dnsshield.Question{ID: 1, RD: true, Name: "probe-" + token + "." + udp53TestZone, Qtype: 1}
	if resp := a.udp53ProbeAnswer(token, q, "41.207.77.77"); udp53Rcode(resp) != 0 {
		t.Fatalf("la sonde devait répondre NOERROR, rcode=%d", udp53Rcode(resp))
	}

	rec = httptest.NewRecorder()
	a.handleDnsHomeProbeStatus(rec, dnsHomeReq(http.MethodGet, "/api/dnsshield/home/probe/"+token, "", "", token))
	if rec.Code != http.StatusOK {
		t.Fatalf("statut reçu : attendu 200, obtenu %d", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &status)
	if status["status"] != "received" || status["ip"] != "41.207.77.77" {
		t.Fatalf("attendu received/41.207.77.77, obtenu %+v", status)
	}
	if status["bound"] != false {
		t.Fatal("l'IP révélée n'est liée à personne dans CE test")
	}

	// Expiration : le jeton meurt, le statut devient 404 (inconnu ou expiré).
	udp53ProbeMu.Lock()
	if e := udp53ProbeLive[token]; e != nil {
		e.expiresAt = time.Now().Add(-time.Minute)
	}
	udp53ProbeMu.Unlock()
	rec = httptest.NewRecorder()
	a.handleDnsHomeProbeStatus(rec, dnsHomeReq(http.MethodGet, "/api/dnsshield/home/probe/"+token, "", "", token))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("sonde expirée : attendu 404, obtenu %d", rec.Code)
	}
}

// TestDnsShieldMeSetupUdp53 — /me expose les clés du jalon maison (état
// RÉEL du serveur UDP/53 + IP du résolveur + zone).
func TestDnsShieldMeSetupUdp53(t *testing.T) {
	udp53TestEnv(t)
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsShieldMe(rec, dnsReq(http.MethodGet, "/api/dnsshield/me", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("corps /me illisible : %v", err)
	}
	setup, _ := out["setup"].(map[string]any)
	if setup == nil {
		t.Fatal("bloc setup absent")
	}
	for _, key := range []string{"udp53Enabled", "resolverIp", "resolverHost"} {
		if _, ok := setup[key]; !ok {
			t.Errorf("setup.%s attendu (jalon maison N°346)", key)
		}
	}
	if setup["resolverIp"] != udp53TestResolver {
		t.Errorf("setup.resolverIp attendu %s, obtenu %v", udp53TestResolver, setup["resolverIp"])
	}
	if setup["resolverHost"] != udp53TestZone {
		t.Errorf("setup.resolverHost attendu %s, obtenu %v", udp53TestZone, setup["resolverHost"])
	}
}
