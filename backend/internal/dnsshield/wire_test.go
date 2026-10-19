// wire_test.go — N°339 — tests du wire-format minimal : parse d'une vraie
// question (construite octet par octet), réponses de blocage (A sinkhole,
// AAAA sinkhole, HTTPS NXDOMAIN), REFUSED du couvre-feu, échecs propres
// (trop court, zéro question, réponse reçue en guise de requête) et
// aller-retour parse→build sur une grille de noms.
package dnsshield

import (
	"encoding/binary"
	"testing"
)

// buildQuery — construit une requête wire légitime (RD posé, une question).
func buildQuery(id uint16, name string, qtype uint16) []byte {
	out := []byte{}
	out = binary.BigEndian.AppendUint16(out, id)
	out = binary.BigEndian.AppendUint16(out, 0x0100) // RD=1
	out = binary.BigEndian.AppendUint16(out, 1)      // QDCOUNT
	out = binary.BigEndian.AppendUint16(out, 0)
	out = binary.BigEndian.AppendUint16(out, 0)
	out = binary.BigEndian.AppendUint16(out, 0)
	out = append(out, encodeName(name)...)
	out = binary.BigEndian.AppendUint16(out, qtype)
	out = binary.BigEndian.AppendUint16(out, 1) // IN
	return out
}

func TestParseQueryRoundTrip(t *testing.T) {
	for _, name := range []string{"example.com", "a.b.example.com", "xn--bcher-kva.example"} {
		msg := buildQuery(0xBEEF, name, 1)
		q, err := ParseQuery(msg)
		if err != nil {
			t.Fatalf("ParseQuery(%s) : %v", name, err)
		}
		if q.Name != name || q.ID != 0xBEEF || q.Qtype != 1 || !q.RD {
			t.Fatalf("question avariée : %+v", q)
		}
	}
}

func TestParseQueryCaseFolded(t *testing.T) {
	q, err := ParseQuery(buildQuery(1, "Example.COM", 28))
	if err != nil {
		t.Fatal(err)
	}
	if q.Name != "example.com" {
		t.Fatalf("nom attendu en minuscules, obtenu %q", q.Name)
	}
}

func TestParseQueryFailures(t *testing.T) {
	if _, err := ParseQuery([]byte{1, 2, 3}); err != ErrTooShort {
		t.Fatalf("message <12 octets : attendu ErrTooShort, obtenu %v", err)
	}
	// QDCOUNT=0 → pas de question.
	noQ := buildQuery(1, "example.com", 1)
	binary.BigEndian.PutUint16(noQ[4:6], 0)
	if _, err := ParseQuery(noQ); err != ErrNoQuestion {
		t.Fatalf("QDCOUNT=0 : attendu ErrNoQuestion, obtenu %v", err)
	}
	// QR=1 (une réponse) → rejetée.
	resp := buildQuery(1, "example.com", 1)
	binary.BigEndian.PutUint16(resp[2:4], 0x8180)
	if _, err := ParseQuery(resp); err != ErrNoQuestion {
		t.Fatalf("QR=1 : attendu ErrNoQuestion, obtenu %v", err)
	}
	// Nom qui déborde du message (message tronqué au milieu du label) →
	// incohérent : aucune question n'est fabriquée.
	bad := buildQuery(1, "example.com", 1)[:14]
	if _, err := ParseQuery(bad); err != ErrBadName {
		t.Fatalf("nom débordant : attendu ErrBadName, obtenu %v", err)
	}
}

func TestBuildBlockedSinkholeA(t *testing.T) {
	q, _ := ParseQuery(buildQuery(0x1234, "blocked.example", 1))
	out := BuildBlocked(q)
	if len(out) < 12+4+16 {
		t.Fatalf("réponse trop courte : %d octets", len(out))
	}
	if binary.BigEndian.Uint16(out[0:2]) != 0x1234 {
		t.Fatal("ID non recopié")
	}
	if out[2]&0x80 == 0 {
		t.Fatal("QR attendu à 1")
	}
	if binary.BigEndian.Uint16(out[6:8]) != 1 {
		t.Fatalf("ANCOUNT attendu 1, obtenu %d", binary.BigEndian.Uint16(out[6:8]))
	}
	// Le RDATA final = 4 octets nuls (0.0.0.0).
	tail := out[len(out)-4:]
	for _, b := range tail {
		if b != 0 {
			t.Fatalf("sinkhole A attendu 0.0.0.0, RDATA=%v", tail)
		}
	}
	// Le TTL vaut 60.
	if binary.BigEndian.Uint32(out[len(out)-10:len(out)-6]) != 60 {
		t.Fatal("TTL 60 attendu")
	}
}

func TestBuildBlockedSinkholeAAAA(t *testing.T) {
	q, _ := ParseQuery(buildQuery(7, "blocked.example", 28))
	out := BuildBlocked(q)
	tail := out[len(out)-16:]
	for _, b := range tail {
		if b != 0 {
			t.Fatalf("sinkhole AAAA attendu ::, RDATA=%v", tail)
		}
	}
}

func TestBuildBlockedNXDOMAIN(t *testing.T) {
	// Type 65 (HTTPS, le préféré de Chrome) → NXDOMAIN, aucune réponse.
	q, _ := ParseQuery(buildQuery(9, "blocked.example", 65))
	out := BuildBlocked(q)
	if rcode := binary.BigEndian.Uint16(out[2:4]) & 0x0F; rcode != 3 {
		t.Fatalf("NXDOMAIN (rcode 3) attendu pour le type 65, obtenu %d", rcode)
	}
	if an := binary.BigEndian.Uint16(out[6:8]); an != 0 {
		t.Fatalf("ANCOUNT attendu 0, obtenu %d", an)
	}
}

func TestBuildRefused(t *testing.T) {
	q, _ := ParseQuery(buildQuery(11, "anything.example", 1))
	out := BuildRefused(q)
	if rcode := binary.BigEndian.Uint16(out[2:4]) & 0x0F; rcode != 5 {
		t.Fatalf("REFUSED (rcode 5) attendu, obtenu %d", rcode)
	}
	if qd := binary.BigEndian.Uint16(out[4:6]); qd != 1 {
		t.Fatalf("question rééchée attendue (QDCOUNT=1), obtenu %d", qd)
	}
}
