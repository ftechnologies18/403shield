package model_test

// Tests N°343 — purge du journal de blocage du bouclier DNS (PurgeDnsEvents) :
// rétention 30 jours (comparaison lexicographique RFC3339, les événements
// étant en ordre d'insertion), borne par profil (les MaxDnsEventsPerProfile
// plus RÉCENTS survivent, ordre d'insertion conservé), les deux règles
// combinées, et le cas vide (aucune perte).

import (
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// dnsEventAt — un événement daté (l'ordre d'insertion est le sien : les
// plus récents en queue, comme le résolveur les écrit).
func dnsEventAt(id, profileID, domain, at string) model.DnsEvent {
	return model.DnsEvent{ID: id, ProfileID: profileID, Domain: domain, Action: model.DnsEventBlocked, CreatedAt: at}
}

func TestPurgeDnsEventsRetention30j(t *testing.T) {
	now := time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC)
	db := &model.DB{}
	db.DnsEvents = []model.DnsEvent{
		dnsEventAt("de-1", "dp-a", "vieux.example", now.AddDate(0, 0, -31).Format(time.RFC3339)),  // périmé
		dnsEventAt("de-2", "dp-a", "limite.example", now.AddDate(0, 0, -30).Format(time.RFC3339)), // 30 j jour pour jour : conservé
		dnsEventAt("de-3", "dp-a", "frais.example", now.Add(-time.Hour).Format(time.RFC3339)),     // frais
	}
	purged := model.PurgeDnsEvents(db, now)
	if purged != 1 {
		t.Fatalf("attendu 1 purgé, obtenu %d", purged)
	}
	if len(db.DnsEvents) != 2 || db.DnsEvents[0].ID != "de-2" || db.DnsEvents[1].ID != "de-3" {
		t.Fatalf("survivants attendus [de-2 de-3], obtenu %v", db.DnsEvents)
	}
}

func TestPurgeDnsEventsCapPerProfile(t *testing.T) {
	now := time.Now().UTC()
	db := &model.DB{}
	// Profil A : 1001 événements RÉCENTS — la borne garde les 1000 derniers.
	// Profil B : 3 événements — intact (la borne est PAR profil).
	for i := 0; i <= model.MaxDnsEventsPerProfile; i++ {
		at := now.Add(-time.Duration(model.MaxDnsEventsPerProfile-i) * time.Second).Format(time.RFC3339)
		db.DnsEvents = append(db.DnsEvents, dnsEventAt("a"+itoaPurge(i), "dp-a", "domaine.example", at))
	}
	for i, d := range []string{"b1.example", "b2.example", "b3.example"} {
		at := now.Add(-time.Duration(3-i) * time.Second).Format(time.RFC3339)
		db.DnsEvents = append(db.DnsEvents, dnsEventAt("b"+itoaPurge(i), "dp-b", d, at))
	}
	purged := model.PurgeDnsEvents(db, now)
	if purged != 1 {
		t.Fatalf("attendu 1 purgé (le plus ancien du profil A), obtenu %d", purged)
	}
	counts := map[string]int{}
	for _, e := range db.DnsEvents {
		counts[e.ProfileID]++
	}
	if counts["dp-a"] != model.MaxDnsEventsPerProfile || counts["dp-b"] != 3 {
		t.Fatalf("bornes : dp-a=%d (attendu %d), dp-b=%d (attendu 3)", counts["dp-a"], model.MaxDnsEventsPerProfile, counts["dp-b"])
	}
	// Le survivant le plus ancien de A n'est PAS a0 (le premier inséré).
	if db.DnsEvents[0].ID != "a1" {
		t.Fatalf("le plus ancien conservé de dp-a doit être a1, obtenu %s", db.DnsEvents[0].ID)
	}
}

func TestPurgeDnsEventsEmptyAndOrder(t *testing.T) {
	now := time.Now().UTC()
	db := &model.DB{}
	if n := model.PurgeDnsEvents(db, now); n != 0 {
		t.Fatalf("journal vide : 0 purgé attendu, obtenu %d", n)
	}
	// L'ordre d'insertion des survivants est conservé (le rapport d'activité
	// lit les événements par la queue — les plus récents d'abord).
	fresh := now.Add(-time.Minute).Format(time.RFC3339)
	db.DnsEvents = []model.DnsEvent{
		dnsEventAt("de-1", "dp-a", "un.example", fresh),
		dnsEventAt("de-2", "dp-a", "deux.example", fresh),
	}
	if n := model.PurgeDnsEvents(db, now); n != 0 {
		t.Fatalf("rien à purger : obtenu %d", n)
	}
	if db.DnsEvents[0].ID != "de-1" || db.DnsEvents[1].ID != "de-2" {
		t.Fatal("l'ordre d'insertion doit être conservé")
	}
}

// itoaPurge — itoa local (le paquet de test reste léger).
func itoaPurge(n int) string {
	if n == 0 {
		return "0"
	}
	b := [12]byte{}
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
