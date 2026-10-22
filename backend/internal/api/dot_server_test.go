// dot_server_test.go — N°345 — tests du serveur DoT :853 et du générateur
// .mobileconfig. RÉSEAU RÉEL sur 127.0.0.1 uniquement (poignée de main
// TLS + trames RFC 7858) avec un certificat joker AUTO-SIGNÉ forgé dans
// un répertoire temporaire — le client de test ne valide PAS la chaîne
// (InsecureSkipVerify : le but est le ROUTAGE SNI, pas la PKI) ; l'amont
// est stubbé (dnsshield.Forward — discipline maison des indirections).
package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/dnsshield"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// ---------------------------------------------------------------------------
// Harnais DoT
// ---------------------------------------------------------------------------

// dotTestZone — zone SNI des tests (jamais la vraie : un test n'écrit pas
// la production, même dans une constante).
const dotTestZone = "dotzone.example"

// genDotTestCert — forge un certificat joker auto-signé (*.zone + hôte nu)
// dans un répertoire temporaire, retourne (certFile, keyFile).
func genDotTestCert(t *testing.T) (string, string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("clé de test : %v", err)
	}
	tmpl := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "*." + dotTestZone},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"*." + dotTestZone, dotTestZone},
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("certificat de test : %v", err)
	}
	dir := t.TempDir()
	certFile := filepath.Join(dir, "fullchain.pem")
	keyFile := filepath.Join(dir, "privkey.pem")
	cf, _ := os.Create(certFile)
	_ = pem.Encode(cf, &pem.Block{Type: "CERTIFICATE", Bytes: der})
	_ = cf.Close()
	kb, _ := x509.MarshalECPrivateKey(key)
	kf, _ := os.Create(keyFile)
	_ = pem.Encode(kf, &pem.Block{Type: "EC PRIVATE KEY", Bytes: kb})
	_ = kf.Close()
	return certFile, keyFile
}

// startDotTest — dresse le serveur DoT de test : certificat temporaire,
// écoute 127.0.0.1:0, boucle d'acceptation en arrière-plan. Retourne
// l'adresse + le fonction de fermeture.
func startDotTest(t *testing.T, a *API) (string, func()) {
	t.Helper()
	certFile, keyFile := genDotTestCert(t)
	certs, err := loadDotCert(certFile, keyFile)
	if err != nil {
		t.Fatalf("chargement certificat de test : %v", err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("écoute de test : %v", err)
	}
	cfg := &tls.Config{GetCertificate: certs.get, MinVersion: tls.VersionTLS12}
	go a.dotAccept(tls.NewListener(ln, cfg), dotTestZone, certs)
	addr := ln.Addr().String()
	return addr, func() { _ = ln.Close() }
}

// dotClient — connexion TLS de test avec SNI choisi (chaîne NON validée :
// le routage SNI est l'objet du test, pas la PKI).
func dotClient(t *testing.T, addr, sni string) *tls.Conn {
	t.Helper()
	conn, err := tls.Dial("tcp", addr, &tls.Config{
		ServerName:         sni,
		InsecureSkipVerify: true, // certificat auto-signé de test — assumé
		MinVersion:         tls.VersionTLS12,
	})
	if err != nil {
		t.Fatalf("connexion DoT (%s) : %v", sni, err)
	}
	return conn
}

// dotRoundTrip — écrit une question, lit la réponse (RFC 7858). ok=false =
// connexion fermée sans réponse.
func dotRoundTrip(t *testing.T, conn *tls.Conn, msg []byte) ([]byte, bool) {
	t.Helper()
	if len(msg) > 0xFFFF {
		t.Fatal("question de test > 64 KiB")
	}
	var hdr [2]byte
	binary.BigEndian.PutUint16(hdr[:], uint16(len(msg)))
	if _, err := conn.Write(hdr[:]); err != nil {
		return nil, false
	}
	if _, err := conn.Write(msg); err != nil {
		return nil, false
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var rhdr [2]byte
	if _, err := readFull(conn, rhdr[:]); err != nil {
		return nil, false
	}
	n := int(binary.BigEndian.Uint16(rhdr[:]))
	buf := make([]byte, n)
	if _, err := readFull(conn, buf); err != nil {
		return nil, false
	}
	return buf, true
}

// readFull — io.ReadFull sans importer io (le fichier reste sobre).
func readFull(conn *tls.Conn, buf []byte) (int, error) {
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

// dotSeedProfile — un client + un profil actif (règle perso « jeux.example »
// bloquée) sous le publicId fixe des tests.
func dotSeedProfile(st *store.Store, publicID string) {
	st.Data().TunnelClients = append(st.Data().TunnelClients, model.TunnelClient{
		ID: "tc-dot", Email: "parent@example.com", Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-dot", PublicID: publicID, OwnerEmail: "parent@example.com",
		Name: "Téléphone de test", Level: model.DnsLevelFamily,
		BlockRules: "jeux.example", AllowRules: "",
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

// dotRcode — le code de réponse (octet 3 & 0x0F).
func dotRcode(msg []byte) int { return int(msg[3] & 0x0F) }

// dotANCount — le nombre de réponses (pour le sinkhole 0.0.0.0).
func dotANCount(msg []byte) int { return int(binary.BigEndian.Uint16(msg[6:8])) }

// ---------------------------------------------------------------------------
// Tests — routage SNI
// ---------------------------------------------------------------------------

// TestDoTBlockedDomain — SNI <publicId>.<zone> + question sur une règle
// bloquée → réponse sinkhole A 0.0.0.0 (miroir exact du DoH N°339).
func TestDoTBlockedDomain(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	conn := dotClient(t, addr, pid+"."+dotTestZone)
	defer conn.Close()
	resp, ok := dotRoundTrip(t, conn, dnsQueryMsg(0x51, "www.jeux.example", 1))
	if !ok {
		t.Fatal("aucune réponse DoT (connexion fermée)")
	}
	if dotRcode(resp) != 0 || dotANCount(resp) != 1 {
		t.Fatalf("attendu sinkhole NOERROR/AN=1, obtenu rcode=%d AN=%d", dotRcode(resp), dotANCount(resp))
	}
	if string(resp[len(resp)-4:]) != "\x00\x00\x00\x00" {
		t.Fatalf("attendu RDATA 0.0.0.0 en queue, obtenu % x", resp[len(resp)-4:])
	}
}

// TestDoTAllowedForwards — question autorisée → l'amont stubbé répond tel
// quel (fail-open sur le chemin normal, miroir DoH).
func TestDoTAllowedForwards(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		out := make([]byte, len(q))
		copy(out, q)
		out[2] |= 0x80 // QR=1 : ça ressemble à une réponse
		return out, nil
	}

	conn := dotClient(t, addr, pid+"."+dotTestZone)
	defer conn.Close()
	msg := dnsQueryMsg(0x52, "iana.org", 1)
	resp, ok := dotRoundTrip(t, conn, msg)
	if !ok {
		t.Fatal("aucune réponse DoT")
	}
	if len(resp) != len(msg)+0 || resp[0] != 0x00 || resp[1] != 0x52 {
		t.Fatalf("réponse amont attendue telle quelle, obtenu %d octets (id=% x)", len(resp), resp[:2])
	}
	if resp[2]&0x80 == 0 {
		t.Fatal("la réponse stubbée devait porter QR=1")
	}
}

// TestDoTBareZoneRefused — SNI hôte nu = SONDE PUBLIQUE : toute question
// lisible reçoit REFUSED (preuve de service SANS filtrage actif).
func TestDoTBareZoneRefused(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	conn := dotClient(t, addr, dotTestZone)
	defer conn.Close()
	resp, ok := dotRoundTrip(t, conn, dnsQueryMsg(0x53, "example.com", 1))
	if !ok {
		t.Fatal("la sonde hôte nu devait répondre (REFUSED), connexion fermée à la place")
	}
	if dotRcode(resp) != 5 {
		t.Fatalf("attendu REFUSED (5), obtenu rcode=%d", dotRcode(resp))
	}
}

// TestDoTBadSNIClosed — SNI hors contrat : poignée de main OK (le joker
// sert tout), puis FERMETURE immédiate (routage impossible).
func TestDoTBadSNIClosed(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	conn := dotClient(t, addr, "evil.example.com")
	defer conn.Close()
	if _, ok := dotRoundTrip(t, conn, dnsQueryMsg(1, "example.com", 1)); ok {
		t.Fatal("un SNI hors contrat devait voir sa connexion fermée sans réponse")
	}
}

// TestDoTUnknownProfileClosed — anti-énumération : publicId inconnu (mais
// bien formé) → connexion fermée, jamais de réponse fabriquée (miroir du
// 404 DoH).
func TestDoTUnknownProfileClosed(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	conn := dotClient(t, addr, "ffff0000ffff0000."+dotTestZone)
	defer conn.Close()
	if _, ok := dotRoundTrip(t, conn, dnsQueryMsg(1, "example.com", 1)); ok {
		t.Fatal("un profil inconnu devait voir sa connexion fermée sans réponse")
	}
}

// TestDoTUpstreamDeadCloses — amont mort → FERMETURE (l'appareil retombe
// sur son DNS système — doctrine fail-open, jamais de réponse fabriquée).
func TestDoTUpstreamDeadCloses(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()
	addr, stop := startDotTest(t, a)
	defer stop()

	orig := dnsshield.Forward
	defer func() { dnsshield.Forward = orig }()
	dnsshield.Forward = func([]byte) ([]byte, error) {
		return nil, errString("amont mort (test)")
	}

	conn := dotClient(t, addr, pid+"."+dotTestZone)
	defer conn.Close()
	if _, ok := dotRoundTrip(t, conn, dnsQueryMsg(0x54, "iana.org", 1)); ok {
		t.Fatal("amont mort : la connexion devait être fermée sans réponse")
	}
}

// TestValidDnsPublicID — le format d'acheminement SNI : 16 hex minuscules,
// rien d'autre (le format exact de NewDnsProfilePublicID).
func TestValidDnsPublicID(t *testing.T) {
	good := []string{"0123456789abcdef", "abcd1234abcd1234", "0000000000000000", "ffffffffffffffff"}
	for _, s := range good {
		if !validDnsPublicID(s) {
			t.Errorf("%q devait être accepté", s)
		}
	}
	bad := []string{"", "abc", "abcd1234abcd12345", "ABCD1234ABCD1234", "abcd1234abcd123g", "abcd-1234abcd123", "abcd1234abcd1234."}
	for _, s := range bad {
		if validDnsPublicID(s) {
			t.Errorf("%q devait être refusé", s)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests — générateur .mobileconfig
// ---------------------------------------------------------------------------

// dnsCfgReq — requête publique /dns-cfg (segments posés à la main).
func dnsCfgReq(publicID, proto string) *http.Request {
	target := "/dns-cfg/" + publicID
	if proto != "" {
		target += "/" + proto
	}
	req := httptest.NewRequest(http.MethodGet, target, nil)
	req.SetPathValue("publicId", publicID)
	if proto != "" {
		req.SetPathValue("proto", proto)
	}
	return req
}

// TestDnsAppleConfigDoH — la variante par défaut : profil Apple avec
// ServerURL DoH, Content-Type Apple, nom du profil échappé.
func TestDnsAppleConfigDoH(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()

	req := dnsCfgReq(pid, "")
	rec := httptest.NewRecorder()
	a.handleDnsAppleConfig(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/x-apple-aspen-config") {
		t.Fatalf("Content-Type Apple attendu, obtenu %q", ct)
	}
	body := rec.Body.String()
	for _, want := range []string{
		"com.apple.dnsSettings.managed",
		"<key>DNSProtocol</key>",
		"<string>HTTPS</string>",
		"<key>ServerURL</key>",
		"/dns-query/" + pid,
		"Téléphone de test",
		"PayloadUUID",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("le .mobileconfig devait contenir %q", want)
		}
	}
	if strings.Contains(body, "<![CDATA[") {
		t.Error("le plist ne doit jamais contenir de CDATA")
	}
}

// TestDnsAppleConfigDoT — la variante /dot : DNSProtocol TLS + ServerName
// <publicId>.<zone> (le même hôte que le DNS privé Android).
func TestDnsAppleConfigDoT(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()

	req := dnsCfgReq(pid, "dot")
	rec := httptest.NewRecorder()
	a.handleDnsAppleConfig(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{
		"<string>TLS</string>",
		"<key>ServerName</key>",
		pid + "." + DnsDotDefaultZone,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("la variante dot devait contenir %q", want)
		}
	}
	if strings.Contains(body, "ServerURL") {
		t.Error("la variante dot ne doit pas contenir ServerURL")
	}
}

// TestDnsAppleConfigUnknown404 — anti-énumération : 404 uniforme pour un
// publicId inconnu (miroir du résolveur DoH).
func TestDnsAppleConfigUnknown404(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	for _, proto := range []string{"", "dot"} {
		req := dnsCfgReq("ffff0000ffff0000", proto)
		rec := httptest.NewRecorder()
		a.handleDnsAppleConfig(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("proto %q : attendu 404, obtenu %d", proto, rec.Code)
		}
	}
}

// TestDnsAppleConfigBadProto — variante inconnue → 400 honnête.
func TestDnsAppleConfigBadProto(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	dotSeedProfile(st, pid)
	st.Unlock()
	req := dnsCfgReq(pid, "carrierpigeon")
	rec := httptest.NewRecorder()
	a.handleDnsAppleConfig(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("attendu 400, obtenu %d", rec.Code)
	}
}

// TestDnsAppleConfigEscaping — un nom de profil piégé (&, <, guillemets)
// traverse le XML ÉCHAPPÉ : le plist reste un document bien formé.
func TestDnsAppleConfigEscaping(t *testing.T) {
	a, st := newTunnelTest(t)
	const pid = "abcd1234abcd1234"
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-esc", PublicID: pid, OwnerEmail: "parent@example.com",
		Name: `Tablette & "Yao" <n°2>`, Level: model.DnsLevelOff,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	req := dnsCfgReq(pid, "")
	rec := httptest.NewRecorder()
	a.handleDnsAppleConfig(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "& \"") || strings.Contains(body, "<n") {
		t.Fatal("le nom piégé devait être échappé dans le plist")
	}
	for _, want := range []string{"&amp;", "&lt;", "&#34;"} {
		if !strings.Contains(body, want) {
			t.Errorf("l'échappement %q attendu", want)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests — bloc setup de la console
// ---------------------------------------------------------------------------

// TestDnsShieldMeSetupBlock — /me expose les quatre clés d'installation
// (DoH, hôte DoT, profils Apple) + l'état DoT : structure complète pour la
// page /dns de la console.
func TestDnsShieldMeSetupBlock(t *testing.T) {
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
	setup, ok := out["setup"].(map[string]any)
	if !ok {
		t.Fatal("bloc setup absent de /me")
	}
	for _, key := range []string{"doh", "dotHost", "appleDoh", "appleDot"} {
		if _, ok := setup[key]; !ok {
			t.Errorf("setup.%s attendu", key)
		}
	}
	if !strings.Contains(setup["dotHost"].(string), "{publicId}.") {
		t.Errorf("setup.dotHost devait être un format avec {publicId}, obtenu %v", setup["dotHost"])
	}
	if _, ok := setup["dotEnabled"]; !ok {
		t.Error("setup.dotEnabled attendu (l'état RÉEL du serveur DoT)")
	}
}
