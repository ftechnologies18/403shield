// engine_test.go — N°339 — tests du moteur de décision : ordre exact
// (allow > couvre-feu > blocage > niveau), suffixe de domaine, casse,
// couvre-feu nocturne chevauchant minuit (sémantique FamilyGuard N°82),
// niveaux threats (VIDE en phase 1 — honnêteté) et family (graines).
package dnsshield

import (
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// at — construit un instant UTC (le moteur décide en UTC == Abidjan).
func at(hour, min int) time.Time {
	return time.Date(2026, 10, 19, hour, min, 0, 0, time.UTC)
}

func TestEngineAllowByDefault(t *testing.T) {
	p := &model.DnsProfile{Level: model.DnsLevelOff}
	if v := Decide(p, "example.com", at(12, 0)); v != VerdictAllow {
		t.Fatalf("profil vide : attendu Allow, obtenu %d", v)
	}
}

func TestEngineBlockRuleSuffix(t *testing.T) {
	p := &model.DnsProfile{Level: model.DnsLevelOff, BlockRules: "jeux.example"}
	for _, d := range []string{"jeux.example", "www.jeux.example", "a.b.jeux.example"} {
		if v := Decide(p, d, at(12, 0)); v != VerdictBlock {
			t.Fatalf("%s : attendu Block, obtenu %d", d, v)
		}
	}
	// Le suffixe ne déborde PAS : jeux.example ne bloque pas mesjeux.example.
	if v := Decide(p, "mesjeux.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("mesjeux.example ne doit PAS être bloqué (suffixe strict)")
	}
}

func TestEngineAllowOverridesBlockAndCurfew(t *testing.T) {
	// L'exception « devoirs » : l'allowlist dépasse la règle de blocage…
	p := &model.DnsProfile{
		Level:      model.DnsLevelOff,
		BlockRules: "reseaux.example",
		AllowRules: "cours.reseaux.example",
	}
	if v := Decide(p, "cours.reseaux.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("l'allowlist doit dépasser la règle de blocage")
	}
	if v := Decide(p, "chat.reseaux.example", at(12, 0)); v != VerdictBlock {
		t.Fatal("le reste du domaine reste bloqué")
	}
	// …ET le couvre-feu.
	nuit := &model.DnsProfile{
		Level:      model.DnsLevelOff,
		AllowRules: "edu.example",
		CurfewSpec: "1|21:00|06:00|1111111",
	}
	// Lundi 19 octobre 2026, 23:00 : couvre-feu actif.
	if v := Decide(nuit, "edu.example", at(23, 0)); v != VerdictAllow {
		t.Fatal("l'allowlist doit dépasser le couvre-feu (exception devoirs)")
	}
	if v := Decide(nuit, "distraction.example", at(23, 0)); v != VerdictCurfew {
		t.Fatal("couvre-feu actif : attendu Curfew")
	}
}

func TestEngineCurfewWindowAndDays(t *testing.T) {
	p := &model.DnsProfile{CurfewSpec: "1|21:00|06:00|1111111"} // toutes nuits
	// 23:00 → couvre-feu ; 12:00 → libre (la fenêtre s'arrête à 06:00 EXCLU).
	if v := Decide(p, "video.example", at(23, 0)); v != VerdictCurfew {
		t.Fatal("23:00 attendu sous couvre-feu")
	}
	if v := Decide(p, "video.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("12:00 attendu hors couvre-feu")
	}
	// Jours de DÉBUT (sémantique N°82) : lundi seulement, 22:00→23:00.
	// Lundi 19 octobre 2026 22:30 → actif ; mardi 20 22:30 → inactif.
	lundi := &model.DnsProfile{CurfewSpec: "1|22:00|23:00|1000000"}
	if v := Decide(lundi, "video.example", at(22, 30)); v != VerdictCurfew {
		t.Fatal("lundi 22:30 attendu sous couvre-feu")
	}
	mardi := at(22, 30).AddDate(0, 0, 1)
	if v := Decide(lundi, "video.example", mardi); v != VerdictAllow {
		t.Fatal("mardi 22:30 attendu hors couvre-feu (jour de début = lundi)")
	}
}

func TestEngineFamilyBlocksSeeds(t *testing.T) {
	p := &model.DnsProfile{Level: model.DnsLevelFamily}
	if v := Decide(p, "www.pornhub.com", at(12, 0)); v != VerdictBlock {
		t.Fatal("niveau family : graine adulte attendue bloquée")
	}
	if v := Decide(p, "bet365.com", at(12, 0)); v != VerdictBlock {
		t.Fatal("niveau family : graine jeux d'argent attendue bloquée")
	}
	if v := Decide(p, "wikipedia.org", at(12, 0)); v != VerdictAllow {
		t.Fatal("wikipedia doit rester libre")
	}
}

func TestEngineThreatsEmptyPhase1(t *testing.T) {
	// HONNÊTETÉ PHASE 1 : le niveau threats ne bloque RIEN tant que les
	// listes automatiques (N°339) ne sont pas branchées — ce test VERROUILLE
	// ce comportement : il échouera le jour où les listes arrivent, forçant
	// sa mise à jour consciente.
	p := &model.DnsProfile{Level: model.DnsLevelThreats}
	if v := Decide(p, "phishing-suspect.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("phase 1 : le niveau threats reste vide (listes N°339)")
	}
}
