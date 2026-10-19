// dnsshield_test.go — N°339 — tests des handlers du bouclier DNS :
// console (création/validation/quota/anti-énumération/suppression +
// purge du journal, rapport d'événements) et résolveur DoH public
// (blocage sinkhole, couvre-feu REFUSED, forward fail-open, profil
// inconnu 404, GET base64url). AUCUN réseau réel : dnsshield.Forward est
// stubbé (discipline maison des indirections).
package api

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/dnsshield"
	"mikcloud/hotspot-api/internal/model"
)

// ---------------------------------------------------------------------------
// Harnais
// ---------------------------------------------------------------------------

// dnsSeed — un client tunnel actif + rien d'autre (produit neuf).
func dnsSeed(db *model.DB) {
	db.TunnelClients = append(db.TunnelClients, model.TunnelClient{
		ID: "tc-dns", Email: "parent@example.com", Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

// dnsReq — requête console authentifiée avec le segment {id} posé à la
// main quand la cible est un chemin de profil.
func dnsReq(method, target string, body string) *http.Request {
	claims := &auth.Claims{Sub: "tc-dns", Role: "tunnel"}
	req := tunnelAuthReq(method, target, claims, body)
	if i := strings.Index(target, "/profiles/"); i != -1 {
		rest := strings.TrimPrefix(target[i+len("/profiles/"):], "/")
		if j := strings.Index(rest, "/"); j != -1 {
			rest = rest[:j]
		}
		req.SetPathValue("id", rest)
	}
	return req
}

// dnsDoHReq — requête DoH publique (pas de JWT, segment {publicId}).
func dnsDoHReq(method, publicID string, msg []byte) *http.Request {
	var req *http.Request
	if method == http.MethodPost {
		req = httptest.NewRequest(method, "/dns-query/"+publicID, strings.NewReader(string(msg)))
		req.Header.Set("Content-Type", "application/dns-message")
	} else {
		req = httptest.NewRequest(method, "/dns-query/"+publicID+"?dns="+base64.RawURLEncoding.EncodeToString(msg), nil)
	}
	req.SetPathValue("publicId", publicID)
	return req
}

// dnsQueryMsg — une requête wire « exemple.com » de type donné.
func dnsQueryMsg(id uint16, name string, qtype uint16) []byte {
	out := []byte{}
	out = binary.BigEndian.AppendUint16(out, id)
	out = binary.BigEndian.AppendUint16(out, 0x0100)
	out = binary.BigEndian.AppendUint16(out, 1) // QDCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // ANCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // NSCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // ARCOUNT
	for _, label := range strings.Split(name, ".") {
		out = append(out, byte(len(label)))
		out = append(out, label...)
	}
	out = append(out, 0)
	out = binary.BigEndian.AppendUint16(out, qtype)
	out = binary.BigEndian.AppendUint16(out, 1)
	return out
}

// dnsForwardStub — remplace l'upstream par une réponse factice contrôlée.
func dnsForwardStub() func() {
	old := dnsshield.Forward
	dnsshield.Forward = func(q []byte) ([]byte, error) {
		// Réponse minimale crédible : même ID, QR=1.
		out := make([]byte, 12)
		binary.BigEndian.PutUint16(out[0:2], binary.BigEndian.Uint16(q[0:2]))
		binary.BigEndian.PutUint16(out[2:4], 0x8180)
		return out, nil
	}
	return func() { dnsshield.Forward = old }
}

// dnsCreateProfile — POST création + décode le profil créé.
func dnsCreateProfile(t *testing.T, a *API, body string) map[string]any {
	t.Helper()
	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileCreate(rec, dnsReq(http.MethodPost, "/api/dnsshield/profiles", body))
	if rec.Code != http.StatusCreated {
		t.Fatalf("création : attendu 201, obtenu %d — %s", rec.Code, rec.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("création : JSON illisible : %v", err)
	}
	return out
}

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

func TestDnsShieldMeEmpty(t *testing.T) {
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
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	profiles, _ := out["profiles"].([]any)
	if len(profiles) != 0 {
		t.Fatalf("produit neuf : 0 profil attendu, obtenu %d", len(profiles))
	}
	if _, ok := out["setupUrlFormat"]; !ok {
		t.Fatal("setupUrlFormat attendu (l'URL d'installation est le produit)")
	}
}

func TestDnsShieldProfileCreateValidations(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()

	cases := []struct {
		body string
		want string
	}{
		{`{"name":"","level":"family"}`, "nom vide"},
		{`{"name":"Tablette","level":"niveau-inconnu"}`, "niveau inconnu"},
		// La casse est NORMALISÉE (copier-coller amical) : le rejet vise les
		// caractères impossibles, pas la politesse orthographique.
		{`{"name":"T","level":"family","blockRules":"bad!domain.com"}`, "caractère invalide"},
		{`{"name":"T","level":"family","blockRules":"..point-point..com"}`, "points doubles"},
		{`{"name":"T","level":"family","allowRules":"slash/example.com"}`, "caractère invalide"},
		{`{"name":"T","level":"family","curfew":{"enabled":true,"start":"25:00","end":"06:00","days":"1111111"}}`, "couvre-feu invalide"},
		{`{"name":"T","level":"family","curfew":{"enabled":true,"start":"22:00","end":"22:00","days":"1111111"}}`, "fenêtre nulle"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		a.handleDnsShieldProfileCreate(rec, dnsReq(http.MethodPost, "/api/dnsshield/profiles", c.body))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("corps %s : attendu 400, obtenu %d — %s", c.body, rec.Code, rec.Body.String())
		}
	}
}

func TestDnsShieldProfileCreateQuotaAndCurfew(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()

	// Création complète : niveau family + règles + couvre-feu nocturne.
	created := dnsCreateProfile(t, a, `{"name":"Tablette de Yao","level":"family","blockRules":"tiktok.com, snap.com","allowRules":"vikipedia.example","curfew":{"enabled":true,"start":"21:00","end":"06:00","days":"1111111"}}`)
	if created["publicId"] == "" || len(created["publicId"].(string)) != 16 {
		t.Fatalf("publicId 16 hex attendu, obtenu %v", created["publicId"])
	}
	if created["setupUrl"] == nil {
		t.Fatal("setupUrl attendue dans la réponse de création")
	}
	// Les règles sont normalisées : une par ligne, minuscules.
	if created["blockRules"] != "tiktok.com\nsnap.com" {
		t.Fatalf("règles normalisées attendues, obtenu %q", created["blockRules"])
	}

	// Quota : la limite (10) est honnête — on en pose 10, le 11e refuse.
	st.Lock()
	email := "parent@example.com"
	for i := len(st.Data().DnsProfiles); i < model.MaxDnsProfilesPerEmail; i++ {
		st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
			ID: model.NewID("dp-"), PublicID: model.NewDnsProfilePublicID(),
			OwnerEmail: email, Name: "P", Level: model.DnsLevelOff, Status: model.DnsProfileActive,
			CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
		})
	}
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileCreate(rec, dnsReq(http.MethodPost, "/api/dnsshield/profiles", `{"name":"De trop","level":"off"}`))
	if rec.Code != http.StatusConflict {
		t.Fatalf("quota atteint : attendu 409, obtenu %d", rec.Code)
	}
}

func TestDnsShieldProfileUpdateAndAntiEnumeration(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	created := dnsCreateProfile(t, a, `{"name":"Avant","level":"off"}`)
	id := created["id"].(string)

	// Mise à jour légitime.
	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileUpdate(rec, dnsReq(http.MethodPut, "/api/dnsshield/profiles/"+id, `{"name":"Après","level":"family","blockRules":"jeux.example"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("update : attendu 200, obtenu %d — %s", rec.Code, rec.Body.String())
	}

	// Anti-énumération : un profil d'un AUTRE propriétaire → même 404.
	st.Lock()
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-autre", PublicID: "aaaaaaaaaaaaaaaa", OwnerEmail: "autre@example.com",
		Name: "D'un autre", Level: model.DnsLevelOff, Status: model.DnsProfileActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()
	for _, target := range []string{"/api/dnsshield/profiles/dp-autre", "/api/dnsshield/profiles/dp-fantome"} {
		rec := httptest.NewRecorder()
		a.handleDnsShieldProfileUpdate(rec, dnsReq(http.MethodPut, target, `{"name":"Pirate","level":"off"}`))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s : attendu 404 (anti-énumération), obtenu %d", target, rec.Code)
		}
	}
}

func TestDnsShieldProfileDeletePurgesEvents(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Unlock()
	created := dnsCreateProfile(t, a, `{"name":"Éphémère","level":"family"}`)
	id := created["id"].(string)

	st.Lock()
	st.Data().DnsEvents = append(st.Data().DnsEvents,
		model.DnsEvent{ID: "de-1", ProfileID: id, Domain: "x.example", Action: model.DnsEventBlocked, CreatedAt: model.NowISO()},
		model.DnsEvent{ID: "de-2", ProfileID: "dp-autre", Domain: "y.example", Action: model.DnsEventBlocked, CreatedAt: model.NowISO()},
	)
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileDelete(rec, dnsReq(http.MethodDelete, "/api/dnsshield/profiles/"+id, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("delete : attendu 200, obtenu %d", rec.Code)
	}
	st.Lock()
	if len(st.Data().DnsProfiles) != 0 {
		t.Fatal("profil attendu supprimé")
	}
	if len(st.Data().DnsEvents) != 1 || st.Data().DnsEvents[0].ProfileID != "dp-autre" {
		t.Fatal("le journal du profil part avec lui, PAS celui des autres")
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Résolveur DoH public
// ---------------------------------------------------------------------------

func TestDnsQueryBlockedSinkhole(t *testing.T) {
	a, st := newTunnelTest(t)
	defer dnsForwardStub()()
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "abcd1234abcd1234", OwnerEmail: "parent@example.com",
		Name: "Tablette", Level: model.DnsLevelFamily, BlockRules: "jeux.example",
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	// POST DoH : domaine bloqué → sinkhole 0.0.0.0 + Content-Type RFC 8484.
	rec := httptest.NewRecorder()
	a.handleDnsQuery(rec, dnsDoHReq(http.MethodPost, "abcd1234abcd1234", dnsQueryMsg(0x42, "www.jeux.example", 1)))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d — %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/dns-message" {
		t.Fatalf("Content-Type RFC 8484 attendu, obtenu %q", ct)
	}
	body := rec.Body.Bytes()
	if binary.BigEndian.Uint16(body[0:2]) != 0x42 {
		t.Fatal("ID non recopié")
	}
	if an := binary.BigEndian.Uint16(body[6:8]); an != 1 {
		t.Fatalf("sinkhole : ANCOUNT=1 attendu, obtenu %d", an)
	}
	// Le blocage est consigné (journal minimal : blocages seulement).
	st.Lock()
	n := 0
	for _, e := range st.Data().DnsEvents {
		if e.Domain == "www.jeux.example" && e.Action == model.DnsEventBlocked {
			n++
		}
	}
	st.Unlock()
	if n != 1 {
		t.Fatalf("1 événement de blocage attendu, obtenu %d", n)
	}

	// Dédup : la MÊME requête dans la fenêtre de 10 min n'écrit PAS deux fois.
	rec = httptest.NewRecorder()
	a.handleDnsQuery(rec, dnsDoHReq(http.MethodPost, "abcd1234abcd1234", dnsQueryMsg(0x43, "www.jeux.example", 1)))
	st.Lock()
	n = 0
	for _, e := range st.Data().DnsEvents {
		if e.Domain == "www.jeux.example" {
			n++
		}
	}
	st.Unlock()
	if n != 1 {
		t.Fatalf("dédup 10 min violée : %d événements pour le même domaine", n)
	}
}

func TestDnsQueryCurfewRefused(t *testing.T) {
	a, st := newTunnelTest(t)
	defer dnsForwardStub()()
	// Couvre-feu couvrant l'heure courante ±30 min (robuste au passage de
	// minute — pattern fgTestSpec N°82).
	n := time.Now().UTC()
	m := n.Hour()*60 + n.Minute()
	s, e := (m+1440-30)%1440, (m+30)%1440
	spec := model.FamilyGuardConfig{Enabled: true,
		Start: string([]byte{byte('0' + (s/60)/10), byte('0' + (s/60)%10), ':', byte('0' + (s%60)/10), byte('0' + (s%60)%10)}),
		End:   string([]byte{byte('0' + (e/60)/10), byte('0' + (e/60)%10), ':', byte('0' + (e%60)/10), byte('0' + (e%60)%10)}),
		Days:  "1111111"}.SpecString()
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-2", PublicID: "ffff0000ffff0000", OwnerEmail: "parent@example.com",
		Name: "Nuit", Level: model.DnsLevelOff, CurfewSpec: spec,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsQuery(rec, dnsDoHReq(http.MethodGet, "ffff0000ffff0000", dnsQueryMsg(5, "video.example", 1)))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	if rcode := binary.BigEndian.Uint16(rec.Body.Bytes()[2:4]) & 0x0F; rcode != 5 {
		t.Fatalf("REFUSED (5) attendu sous couvre-feu, obtenu %d", rcode)
	}
}

func TestDnsQueryForwardAndFailOpen(t *testing.T) {
	a, st := newTunnelTest(t)
	defer dnsForwardStub()()
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-3", PublicID: "0123456789abcdef", OwnerEmail: "parent@example.com",
		Name: "Libre", Level: model.DnsLevelOff,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	// Domaine autorisé → forward (réponse stub, même ID).
	rec := httptest.NewRecorder()
	a.handleDnsQuery(rec, dnsDoHReq(http.MethodPost, "0123456789abcdef", dnsQueryMsg(0x77, "wikipedia.org", 1)))
	if rec.Code != http.StatusOK || binary.BigEndian.Uint16(rec.Body.Bytes()[0:2]) != 0x77 {
		t.Fatalf("forward attendu, obtenu %d", rec.Code)
	}
	// AUCUN événement pour une requête autorisée (journal minimal).
	st.Lock()
	if len(st.Data().DnsEvents) != 0 {
		t.Fatal("une requête autorisée ne doit JAMAIS être consignée")
	}
	st.Unlock()

	// Fail-open : message incompréhensible (QDCOUNT=2) → forward tel quel,
	// jamais 400 au client DoH.
	bad := dnsQueryMsg(0x88, "example.com", 1)
	binary.BigEndian.PutUint16(bad[4:6], 2)
	rec = httptest.NewRecorder()
	a.handleDnsQuery(rec, dnsDoHReq(http.MethodPost, "0123456789abcdef", bad))
	if rec.Code != http.StatusOK {
		t.Fatalf("fail-open : attendu 200 (forward), obtenu %d", rec.Code)
	}
}

func TestDnsQueryUnknownProfileAndBlockedProfile(t *testing.T) {
	a, st := newTunnelTest(t)
	defer dnsForwardStub()()
	st.Lock()
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-4", PublicID: "blocked000000001", OwnerEmail: "x@example.com",
		Name: "Révoqué", Level: model.DnsLevelOff, Status: model.DnsProfileBlocked,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Unlock()

	for _, pid := range []string{"inconnu000000000", "blocked000000001"} {
		rec := httptest.NewRecorder()
		a.handleDnsQuery(rec, dnsDoHReq(http.MethodPost, pid, dnsQueryMsg(1, "example.com", 1)))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s : attendu 404 (l'appareil retombe sur son DNS système), obtenu %d", pid, rec.Code)
		}
	}
}

func TestDnsShieldEventsReport(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	dnsSeed(st.Data())
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-5", PublicID: "eeeeeeeeeeeeeeee", OwnerEmail: "parent@example.com",
		Name: "Rapport", Level: model.DnsLevelFamily,
		Status: model.DnsProfileActive, CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Data().DnsEvents = append(st.Data().DnsEvents,
		model.DnsEvent{ID: "de-a", ProfileID: "dp-5", Domain: "a.example", Action: model.DnsEventBlocked, CreatedAt: "2026-10-19T10:00:00Z"},
		model.DnsEvent{ID: "de-b", ProfileID: "dp-5", Domain: "b.example", Action: model.DnsEventCurfew, CreatedAt: "2026-10-19T11:00:00Z"},
		model.DnsEvent{ID: "de-c", ProfileID: "dp-autre", Domain: "c.example", Action: model.DnsEventBlocked, CreatedAt: "2026-10-19T12:00:00Z"},
	)
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileEvents(rec, dnsReq(http.MethodGet, "/api/dnsshield/profiles/dp-5/events", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d", rec.Code)
	}
	var out struct {
		Events []map[string]any `json:"events"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if len(out.Events) != 2 {
		t.Fatalf("2 événements du profil attendus (pas ceux des autres), obtenu %d", len(out.Events))
	}
	// Ordre récent d'abord.
	if out.Events[0]["domain"] != "b.example" {
		t.Fatalf("ordre récent d'abord attendu, obtenu %v", out.Events[0]["domain"])
	}
}
