// wire.go — N°339 — WIRE FORMAT DNS minimal (stdlib PURE — doctrine du
// backend : aucune dépendance externe, miekg/dns exclu par design).
//
// PÉRIMÈTRE (le strict nécessaire d'un résolveur FILTRAN par nom) :
//   - PARSER l'en-tête (12 octets) et LA QUESTION (nom + type + classe) —
//     les questions ne sont jamais compressées (RFC 1035 §4.1.2) : le
//     parsing est trivial et complet pour notre usage ;
//   - CONSTRUIRE les deux réponses de filtrage :
//   - blocage A → 0.0.0.0, AAAA → :: (TTL 60 s — comportement standard
//     des bloqueurs : le client met en cache, le résolveur souffle) ;
//   - blocage d'un autre type (HTTPS/SVCB type 65 des navigateurs,
//     MX, TXT…) → NXDOMAIN : le nom N'EXISTE PAS, toutes les
//     résolutions de la famille s'arrêtent ;
//   - couvre-feu → REFUSED (rcode 5) : « pas de service » — l'appareil
//     affiche « pas d'Internet », exactement l'effet attendu ;
//   - PASSER TELLE QUELLE la réponse upstream (forward du message brut :
//     ni réécriture, ni réinterprétation — l'EDNS et la section
//     supplémentaire du client traversent intacts).
//
// FAIL-OPEN (doctrine de disponibilité, miroir « un routeur avarié ne
// bloque jamais le geste VPN ») : un message INCOMPRÉHENSIBLE n'est jamais
// rejeté — il est transmis upstream tel quel. Un filtrage en panne ne doit
// pas couper Internet : le pire cas est « non filtré », jamais « offline ».
package dnsshield

import (
	"encoding/binary"
	"errors"
)

// Question — l'unique question d'un message DNS (QDCOUNT attendu 1 ; un
// message multi-questions est hors contrat DoH réel — forwarded tel quel).
type Question struct {
	ID    uint16
	RD    bool   // recursion desired (recopié dans la réponse)
	Name  string // qname minuscules, point final retiré
	Qtype uint16 // 1=A, 28=AAAA, 65=HTTPS…
}

// Types utilisés (pas de constante externe : stdlib pur).
const (
	qtypeA    = 1
	qtypeAAAA = 28
)

// Erreurs sentinelles : ParseQuery ne PANIQUE jamais, il signale.
var (
	ErrTooShort   = errors.New("message DNS trop court")
	ErrNoQuestion = errors.New("aucune question dans le message")
	ErrBadName    = errors.New("nom de la question incohérent")
)

// ParseQuery — en-tête + question. err != nil → l'appelant DOIT forwarder
// le message brut (fail-open), jamais répondre 400 au client.
func ParseQuery(msg []byte) (Question, error) {
	if len(msg) < 12 {
		return Question{}, ErrTooShort
	}
	qdcount := binary.BigEndian.Uint16(msg[4:6])
	if qdcount != 1 {
		return Question{}, ErrNoQuestion
	}
	flags := binary.BigEndian.Uint16(msg[2:4])
	if flags&0x8000 != 0 { // QR=1 : c'est une réponse, pas une requête
		return Question{}, ErrNoQuestion
	}
	off := 12
	var sb []byte
	for {
		if off >= len(msg) {
			return Question{}, ErrBadName
		}
		l := int(msg[off])
		off++
		if l == 0 {
			break
		}
		if l > 63 || off+l > len(msg) {
			return Question{}, ErrBadName
		}
		if len(sb) > 0 {
			sb = append(sb, '.')
		}
		sb = append(sb, msg[off:off+l]...)
		off += l
	}
	if off+4 > len(msg) {
		return Question{}, ErrBadName
	}
	qtype := binary.BigEndian.Uint16(msg[off : off+2])
	name := lowerASCII(string(sb))
	if len(name) > 253 || name == "" {
		return Question{}, ErrBadName
	}
	return Question{ID: binary.BigEndian.Uint16(msg[0:2]), RD: flags&0x0100 != 0, Name: name, Qtype: qtype}, nil
}

// lowerASCII — minuscules sans allocation hors ASCII.
func lowerASCII(s string) string {
	b := []byte(s)
	changed := false
	for i := 0; i < len(b); i++ {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
			changed = true
		}
	}
	if !changed {
		return s
	}
	return string(b)
}

// BuildBlocked — la réponse de blocage : A → 0.0.0.0 / AAAA → :: (TTL 60),
// tout autre type → NXDOMAIN (le nom n'existe pas — arrête aussi les
// résolutions HTTPS/MX de la famille). La question est rééchée via un
// pointeur de compression vers l'offset 12 (0xC00C, RFC 1035 §4.1.4).
func BuildBlocked(q Question) []byte {
	if q.Qtype == qtypeA || q.Qtype == qtypeAAAA {
		return buildAnswerIP(q)
	}
	return buildHeaderOnly(q, 3) // NXDOMAIN
}

// BuildRefused — la réponse de couvre-feu : REFUSED (rcode 5), question
// rééchée, aucune réponse — « pas de service à cette heure ».
func BuildRefused(q Question) []byte {
	return buildHeaderOnly(q, 5)
}

// buildHeaderOnly — en-tête réponse + question, rcode posé, compteurs 0.
func buildHeaderOnly(q Question, rcode int) []byte {
	name := encodeName(q.Name)
	out := make([]byte, 0, 12+len(name)+4)
	out = binary.BigEndian.AppendUint16(out, q.ID)
	flags := uint16(0x8000) // QR=1
	if q.RD {
		flags |= 0x0100
	}
	flags |= 0x0080 // RA=1 (nous filtrons via upstream récursif)
	flags |= uint16(rcode) & 0x0F
	out = binary.BigEndian.AppendUint16(out, flags)
	out = binary.BigEndian.AppendUint16(out, 1) // QDCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // ANCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // NSCOUNT
	out = binary.BigEndian.AppendUint16(out, 0) // ARCOUNT
	out = append(out, name...)
	out = binary.BigEndian.AppendUint16(out, q.Qtype)
	out = binary.BigEndian.AppendUint16(out, 1) // IN
	return out
}

// buildAnswerIP — réponse NOERROR avec l'adresse sinkhole (0.0.0.0 ou ::).
func buildAnswerIP(q Question) []byte {
	name := encodeName(q.Name)
	var rdata []byte
	if q.Qtype == qtypeAAAA {
		rdata = make([]byte, 16) // ::
	} else {
		rdata = make([]byte, 4) // 0.0.0.0
	}
	out := make([]byte, 0, 12+len(name)+4+2+10+2+len(rdata))
	out = binary.BigEndian.AppendUint16(out, q.ID)
	flags := uint16(0x8000)
	if q.RD {
		flags |= 0x0100
	}
	flags |= 0x0080
	out = binary.BigEndian.AppendUint16(out, flags)
	out = binary.BigEndian.AppendUint16(out, 1) // QDCOUNT
	out = binary.BigEndian.AppendUint16(out, 1) // ANCOUNT
	out = binary.BigEndian.AppendUint16(out, 0)
	out = binary.BigEndian.AppendUint16(out, 0)
	out = append(out, name...)
	out = binary.BigEndian.AppendUint16(out, q.Qtype)
	out = binary.BigEndian.AppendUint16(out, 1)
	// Réponse : pointeur vers le nom en offset 12.
	out = binary.BigEndian.AppendUint16(out, 0xC00C)
	out = binary.BigEndian.AppendUint16(out, q.Qtype)
	out = binary.BigEndian.AppendUint16(out, 1)  // IN
	out = binary.BigEndian.AppendUint32(out, 60) // TTL 60 s
	out = binary.BigEndian.AppendUint16(out, uint16(len(rdata)))
	out = append(out, rdata...)
	return out
}

// encodeName — nom pointé en labels wire (jamais de compression côté
// émission — simple et correct).
func encodeName(name string) []byte {
	out := []byte{}
	start := 0
	for i := 0; i <= len(name); i++ {
		if i == len(name) || name[i] == '.' {
			l := i - start
			if l > 0 {
				out = append(out, byte(l))
				out = append(out, name[start:i]...)
			}
			start = i + 1
		}
	}
	return append(out, 0)
}
