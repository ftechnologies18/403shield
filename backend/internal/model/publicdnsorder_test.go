package model_test

// publicdnsorder_test.go — N°347 — tests du modèle de l'abonnement DNS
// « TOURACO » : entitlement par e-mail (la plus lointaine échéance
// provisionnée non échue), quotas effectifs (TOURACO 25/600/15/90 vs
// gratuit INTACT 10/200/5/30), purge du journal PAR PROPRIÉTAIRE (un
// abonné garde 90 j/3000, un compte gratuit 30 j/1000 — un terme franchi
// retombe immédiatement), normalisation des listes à borne paramétrée et
// référence publique MCD-.

import (
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// dnsSeedSub — commande provisionnée d'un e-mail (échéance libre).
func dnsSeedSub(db *model.DB, id, ref, email, expiresAt string) {
	db.PublicDnsOrders = append(db.PublicDnsOrders, model.PublicDnsOrder{
		ID: id, Ref: ref, Email: email, PlanID: model.PublicDnsPlanMonthID,
		Months: 1, BaseAmountFcfa: 1000, AmountFcfa: 1000, PayMethod: "manual",
		Status: model.PublicDnsOrderProvisioned, ExpiresAt: expiresAt,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

func TestDnsSubscriptionOfEmail(t *testing.T) {
	db := &model.DB{}
	futur := time.Now().UTC().AddDate(0, 1, 0).Format(time.RFC3339)
	futur2 := time.Now().UTC().AddDate(1, 0, 0).Format(time.RFC3339)
	passe := time.Now().UTC().AddDate(0, 0, -1).Format(time.RFC3339)
	dnsSeedSub(db, "o1", "MCD-AAAA1111", "Ali@Example.com", futur)
	dnsSeedSub(db, "o2", "MCD-BBBB2222", "ali@example.com", futur2) // cumul : la plus lointaine gagne
	dnsSeedSub(db, "o3", "MCD-CCCC3333", "ali@example.com", passe)  // échue : ignorée
	// Autres états : jamais porteurs du droit.
	db.PublicDnsOrders = append(db.PublicDnsOrders,
		model.PublicDnsOrder{ID: "o4", Ref: "MCD-DDDD4444", Email: "ali@example.com", Status: model.PublicDnsOrderPending},
		model.PublicDnsOrder{ID: "o5", Ref: "MCD-EEEE5555", Email: "ali@example.com", Status: model.PublicDnsOrderPaid},
		model.PublicDnsOrder{ID: "o6", Ref: "MCD-FFFF6666", Email: "ali@example.com", Status: model.PublicDnsOrderExpired, ExpiresAt: futur},
	)

	expiresAt, active := model.DnsSubscriptionOfEmail(db, "ALI@example.com")
	if !active {
		t.Fatal("abonnement attendu actif")
	}
	if expiresAt != futur2 {
		t.Fatalf("échéance attendue %s (la plus lointaine), obtenue %s", futur2, expiresAt)
	}
	if _, active := model.DnsSubscriptionOfEmail(db, "autre@example.com"); active {
		t.Fatal("un e-mail sans commande ne doit jamais être actif")
	}
	if _, active := model.DnsSubscriptionOfEmail(db, ""); active {
		t.Fatal("e-mail vide : jamais actif")
	}
}

func TestDnsQuotasForEmail(t *testing.T) {
	db := &model.DB{}
	// Tier gratuit INTACT : les constantes historiques restent la source.
	q := model.DnsQuotasForEmail(db, "gratuit@example.com")
	if q.MaxProfiles != model.DnsQuotasFree.MaxProfiles || q.MaxRules != model.DnsQuotasFree.MaxRules ||
		q.MaxHomeBindings != model.DnsQuotasFree.MaxHomeBindings || q.RetentionDays != model.DnsQuotasFree.RetentionDays {
		t.Fatalf("tier gratuit inattendu : %+v", q)
	}
	if q.MaxProfiles != 10 || q.MaxRules != 200 || q.MaxHomeBindings != 5 || q.RetentionDays != 30 {
		t.Fatalf("le tier gratuit doit rester TEL QUE LIVRÉ N°339→346 : %+v", q)
	}
	// Abonné TOURACO : capacités étendues.
	dnsSeedSub(db, "o1", "MCD-AAAA1111", "abo@example.com", time.Now().UTC().AddDate(0, 1, 0).Format(time.RFC3339))
	q = model.DnsQuotasForEmail(db, "ABO@example.com")
	if q.MaxProfiles != 25 || q.MaxRules != 600 || q.MaxHomeBindings != 15 || q.RetentionDays != 90 {
		t.Fatalf("quotas TOURACO inattendus : %+v", q)
	}
	// Terme franchi → retombée immédiate au gratuit (aucune recopie).
	db.PublicDnsOrders[0].ExpiresAt = time.Now().UTC().AddDate(0, 0, -1).Format(time.RFC3339)
	if q := model.DnsQuotasForEmail(db, "abo@example.com"); q.MaxProfiles != 10 {
		t.Fatalf("échéance franchie : le compte doit retomber au gratuit, obtenu %+v", q)
	}
}

func TestNormalizeDnsRulesWithMax(t *testing.T) {
	// 250 domaines : refusé au tier gratuit (200), accepté en TOURACO (600).
	domains := make([]string, 250)
	for i := range domains {
		domains[i] = "site" + itoaPurge(i) + ".example"
	}
	raw := strings.Join(domains, "\n")
	if _, ok := model.NormalizeDnsRulesWithMax(raw, 200); ok {
		t.Fatal("250 règles doivent être refusées à la borne 200")
	}
	out, ok := model.NormalizeDnsRulesWithMax(raw, 600)
	if !ok || len(strings.Fields(out)) != 250 {
		t.Fatalf("250 règles attendues acceptées à la borne 600 : ok=%v", ok)
	}
	// Borne absurde (≤0) : repli sur la constante historique.
	if _, ok := model.NormalizeDnsRulesWithMax("a.example\nb.example", 0); !ok {
		t.Fatal("borne 0 doit replier sur la constante gratuite (200), pas refuser")
	}
	// NormalizeDnsRules (historique) reste la borne gratuite — INTACTE.
	if _, ok := model.NormalizeDnsRules(raw); ok {
		t.Fatal("NormalizeDnsRules historique doit garder la borne 200")
	}
}

func TestPurgeDnsEventsPerOwnerQuotas(t *testing.T) {
	now := time.Now().UTC()
	db := &model.DB{}
	// Profil d'un ABONNÉ TOURACO (rétention 90 j) et profil d'un GRATUIT
	// (30 j) : le même événement d'il y a 45 j survit chez l'abonné, pas
	// chez le gratuit — la rétention est PAR PROPRIÉTAIRE.
	db.DnsProfiles = append(db.DnsProfiles,
		model.DnsProfile{ID: "dp-abo", OwnerEmail: "abo@example.com", Status: model.DnsProfileActive},
		model.DnsProfile{ID: "dp-free", OwnerEmail: "free@example.com", Status: model.DnsProfileActive},
	)
	dnsSeedSub(db, "o1", "MCD-AAAA1111", "abo@example.com", now.AddDate(0, 1, 0).Format(time.RFC3339))
	at45 := now.AddDate(0, 0, -45).Format(time.RFC3339)
	db.DnsEvents = []model.DnsEvent{
		{ID: "e-1", ProfileID: "dp-abo", Domain: "abo.example", Action: model.DnsEventBlocked, CreatedAt: at45},
		{ID: "e-2", ProfileID: "dp-free", Domain: "free.example", Action: model.DnsEventBlocked, CreatedAt: at45},
	}
	if purged := model.PurgeDnsEvents(db, now); purged != 1 {
		t.Fatalf("attendu 1 purgé (le gratuit seulement), obtenu %d", purged)
	}
	if len(db.DnsEvents) != 1 || db.DnsEvents[0].ProfileID != "dp-abo" {
		t.Fatalf("le survivant doit être l'événement de l'abonné, obtenu %v", db.DnsEvents)
	}

	// Terme de l'abonné franchi : sa rétention retombe à 30 j — l'événement
	// de 45 j est purgé au passage SUIVANT (le droit se recalcule à chaque
	// balayage, aucune recopie).
	db.PublicDnsOrders[0].ExpiresAt = now.AddDate(0, 0, -1).Format(time.RFC3339)
	if purged := model.PurgeDnsEvents(db, now); purged != 1 {
		t.Fatalf("après terme : attendu 1 purgé (retombée au 30 j), obtenu %d", purged)
	}
	if len(db.DnsEvents) != 0 {
		t.Fatalf("journal attendu vide, obtenu %v", db.DnsEvents)
	}
}

func TestPublicDnsRefPrefixeEtQuotidien(t *testing.T) {
	db := &model.DB{}
	ref := model.NewPublicDnsRef(db)
	if !strings.HasPrefix(ref, "MCD-") || len(ref) != 12 {
		t.Fatalf("référence MCD-XXXXXXXX attendue, obtenue %q", ref)
	}
	// Unicité : la référence tirée n'existe pas dans le registre.
	dnsSeedSub(db, "o1", ref, "x@example.com", "2999-01-01T00:00:00Z")
	ref2 := model.NewPublicDnsRef(db)
	if ref2 == ref {
		t.Fatalf("deux références identiques tirées : %s", ref)
	}
}

func TestExtendPublicDnsExpiry(t *testing.T) {
	now := time.Date(2026, time.October, 23, 12, 0, 0, 0, time.UTC)
	// Renouvellement AVANT le terme : les jours restants ne sont pas perdus.
	current := now.AddDate(0, 0, 10).Format(time.RFC3339)
	got := model.ExtendPublicDnsExpiry(current, now.Format(time.RFC3339), 1)
	want := now.AddDate(0, 0, 10).AddDate(0, 1, 0).Format(time.RFC3339)
	if got != want {
		t.Fatalf("échéance attendue %s, obtenue %s", want, got)
	}
	// Droit ÉCHU : l'extension part de MAINTENANT (jamais dans le passé).
	expired := now.AddDate(0, 0, -40).Format(time.RFC3339)
	got = model.ExtendPublicDnsExpiry(expired, now.Format(time.RFC3339), 1)
	want = now.AddDate(0, 1, 0).Format(time.RFC3339)
	if got != want {
		t.Fatalf("échéance attendue %s (depuis maintenant), obtenue %s", want, got)
	}
}

func TestPublicDnsActiveOrdersEtPending(t *testing.T) {
	db := &model.DB{}
	dnsSeedSub(db, "o1", "MCD-AAAA1111", "a@example.com", "2999-01-01T00:00:00Z")
	db.PublicDnsOrders = append(db.PublicDnsOrders,
		model.PublicDnsOrder{ID: "o2", Ref: "MCD-BBBB2222", Email: "b@example.com", Status: model.PublicDnsOrderPending},
		model.PublicDnsOrder{ID: "o3", Ref: "MCD-CCCC3333", Email: "c@example.com", Status: model.PublicDnsOrderCancelled},
		model.PublicDnsOrder{ID: "o4", Ref: "MCD-DDDD4444", Email: "d@example.com", Status: model.PublicDnsOrderExpired},
	)
	if n := model.PublicDnsActiveOrders(db); n != 2 {
		t.Fatalf("2 ordres actifs attendus (provisioned + pending), obtenu %d", n)
	}
	if p := model.PublicDnsOrderPendingForEmail(db, "B@example.com"); p == nil || p.Ref != "MCD-BBBB2222" {
		t.Fatalf("pending de b@example.com attendue, obtenu %+v", p)
	}
	if p := model.PublicDnsOrderPendingForEmail(db, "a@example.com"); p != nil {
		t.Fatalf("aucune pending attendue pour a@example.com, obtenu %+v", p)
	}
}

func TestPublicDnsOrderLabel(t *testing.T) {
	o := model.PublicDnsOrder{PlanID: model.PublicDnsPlanYearID, Email: "x@example.com"}
	if label := model.PublicDnsOrderLabel(o); !strings.Contains(label, "TOURACO Annuel") || !strings.Contains(label, "x@example.com") {
		t.Fatalf("libellé inattendu : %q", label)
	}
	o.PlanID = "inconnu"
	if label := model.PublicDnsOrderLabel(o); label != "x@example.com" {
		t.Fatalf("formule inconnue : repli e-mail attendu, obtenu %q", label)
	}
}
