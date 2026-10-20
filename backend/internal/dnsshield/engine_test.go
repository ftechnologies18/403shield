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

func TestEngineThreatsLiveSet(t *testing.T) {
	// N°343 — MISE À JOUR CONSCIENTE du verrou de phase 1 : ce test était
	// TestEngineThreatsEmptyPhase1 (N°339) et verrouillait « le niveau
	// threats ne bloque RIEN tant que les listes ne sont pas branchées — il
	// échouera le jour où les listes arrivent, forçant sa mise à jour
	// consciente ». Les listes URLhaus/OpenPhish SONT branchées (N°343 :
	// threats.go + balayage 6 h) : le verrou devient le CONTRAT du niveau —
	// 1. set VIDE (démarrage, flux tous injoignables) : le niveau ne bloque
	//    RIEN (fail-open, jamais de blocage au hasard) ;
	// 2. set PEUPLÉ : le domaine listé est bloqué, le frère non.
	p := &model.DnsProfile{Level: model.DnsLevelThreats}
	SetThreatSet(nil, time.Time{})
	defer SetThreatSet(nil, time.Time{})
	if v := Decide(p, "phishing-suspect.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("set vide : le niveau threats ne doit rien bloquer (fail-open)")
	}
	SetThreatSet([]string{"phishing-suspect.example"}, time.Now().UTC())
	if v := Decide(p, "phishing-suspect.example", at(12, 0)); v != VerdictBlock {
		t.Fatal("set peuplé : le domaine listé doit être bloqué")
	}
	if v := Decide(p, "frere.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("set peuplé : un domaine non listé reste libre")
	}
}

func TestEngineThreatsRespectsAllowlist(t *testing.T) {
	// L'ordre figé tient avec les listes vivantes : l'exception « devoirs »
	// dépasse l'agrégat comme elle dépasse tout.
	SetThreatSet([]string{"banque-factice.example"}, time.Now().UTC())
	defer SetThreatSet(nil, time.Time{})
	p := &model.DnsProfile{
		Level:      model.DnsLevelThreats,
		AllowRules: "banque-factice.example",
	}
	if v := Decide(p, "banque-factice.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("l'allowlist doit dépasser l'agrégat de menaces")
	}
	sansAllow := &model.DnsProfile{Level: model.DnsLevelThreats}
	if v := Decide(sansAllow, "banque-factice.example", at(12, 0)); v != VerdictBlock {
		t.Fatal("sans allowlist, le domaine listé est bloqué")
	}
}

func TestEngineFamilySharesThreatSet(t *testing.T) {
	// family = threats + catégories (vocabulaire SafeWiFi N°80) : l'agrégat
	// est consulté par les DEUX niveaux.
	SetThreatSet([]string{"phish.example"}, time.Now().UTC())
	defer SetThreatSet(nil, time.Time{})
	p := &model.DnsProfile{Level: model.DnsLevelFamily}
	if v := Decide(p, "phish.example", at(12, 0)); v != VerdictBlock {
		t.Fatal("niveau family : le domaine de menaces doit être bloqué")
	}
	// ... et le niveau OFF n'y est pas sensible.
	off := &model.DnsProfile{Level: model.DnsLevelOff}
	if v := Decide(off, "phish.example", at(12, 0)); v != VerdictAllow {
		t.Fatal("niveau off : l'agrégat ne s'applique pas")
	}
}
