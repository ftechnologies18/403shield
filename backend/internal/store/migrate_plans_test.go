// migrate_plans_test.go — N°122 → N°324 : migrations idempotentes des
// identifiants de formule. Mono-mode Hotspot : « essentiel »/« illimite »
// (et tout compte, homenet léger compris) résolvent sur la grille hotspot
// unique ; la RETRAITE DU MODE HOMENET (migrateHomeNetRetirement) convertit
// au boot comptes, abonnements, demandes de facturation, audiences d'annonces
// et lève les pauses dîner des comptes convertis (commande device_pause vide
// enfilée pour leurs box).
package store

import (
	"testing"

	"mikcloud/hotspot-api/internal/model"
)

func TestMigrateUsageScopedPlans(t *testing.T) {
	db := &model.DB{
		Accounts: []model.Account{
			{ID: "acc-hot", Usage: model.AccountUsageHotspot},
			{ID: "acc-home", Usage: model.AccountUsageHomeNet}, // N°324 — léger : lu hotspot
			{ID: "acc-vide"}, // usage vide → hotspot (produit historique)
		},
		SettingsByAccount: map[string]model.Settings{
			"acc-hot":  {Subscription: model.Subscription{PlanID: "essentiel", Status: "active"}},
			"acc-home": {Subscription: model.Subscription{PlanID: "illimite", Status: "active"}},
			"acc-vide": {Subscription: model.Subscription{PlanID: "essentiel", Status: "active"}},
		},
		BillingRequests: []model.BillingRequest{
			{ID: "breq-1", AccountID: "acc-home", PlanID: "essentiel", Status: "pending"},
			{ID: "breq-2", AccountID: "acc-hot", PlanID: "illimite", Status: "done"},
		},
	}

	if !migrateUsageScopedPlans(db) {
		t.Fatal("la migration initiale doit signaler un changement")
	}

	// N°324 — mono-mode : plus de segmentation foyer, la grille hotspot
	// s'applique à TOUS les comptes (y compris homenet léger résiduel).
	veut := map[string]string{
		"acc-hot":  "hotspot-mensuel", // essentiel + hotspot
		"acc-home": "hotspot-annuel",  // illimite + homenet léger → grille hotspot
		"acc-vide": "hotspot-mensuel", // essentiel + usage vide → hotspot
	}
	for accID, want := range veut {
		if got := db.SettingsByAccount[accID].Subscription.PlanID; got != want {
			t.Fatalf("abonnement %s : PlanID = %q, attendu %q", accID, got, want)
		}
	}
	// Libellé compat rafraîchi (formule de la grille unique, plafond cohérent).
	if p := db.SettingsByAccount["acc-home"].Plan; p.Name != "403Shield Hotspot Annuel" || p.MaxRouters != "Illimité" {
		t.Fatalf("libellé compat acc-home = %+v", db.SettingsByAccount["acc-home"].Plan)
	}
	if p := db.SettingsByAccount["acc-hot"].Plan; p.Name != "403Shield Hotspot Mensuel" || p.MaxRouters != "Par routeur" {
		t.Fatalf("libellé compat acc-hot = %+v", db.SettingsByAccount["acc-hot"].Plan)
	}
	// Demandes de facturation : résolues sur la grille unique.
	if got := db.BillingRequests[0].PlanID; got != "hotspot-mensuel" {
		t.Fatalf("demande breq-1 : PlanID = %q, attendu hotspot-mensuel", got)
	}
	if got := db.BillingRequests[1].PlanID; got != "hotspot-annuel" {
		t.Fatalf("demande breq-2 : PlanID = %q, attendu hotspot-annuel", got)
	}

	// Idempotence : un second passage ne change rien.
	if migrateUsageScopedPlans(db) {
		t.Fatal("la migration doit être idempotente (second passage sans changement)")
	}

	// Les essais et les identifiants catalogue ne sont jamais touchés.
	db2 := &model.DB{
		Accounts: []model.Account{{ID: "a1", Usage: model.AccountUsageHomeNet}},
		SettingsByAccount: map[string]model.Settings{
			"a1": {Subscription: model.Subscription{PlanID: "essai", Status: "active"}},
		},
	}
	if migrateUsageScopedPlans(db2) {
		t.Fatal("un essai ne doit pas être migré")
	}
	// N°324 — l'alias foyer « homenet-annuel » n'est PAS le travail de cette
	// migration (elle ne réécrit que « essentiel »/« illimite ») : c'est
	// migrateHomeNetRetirement qui le convertit — cf. TestMigrateHomeNetRetirement.
	s := db2.SettingsByAccount["a1"]
	s.Subscription.PlanID = "homenet-annuel"
	db2.SettingsByAccount["a1"] = s
	if migrateUsageScopedPlans(db2) {
		t.Fatal("un identifiant hors périmètre (alias foyer) ne doit pas être touché ici")
	}
}

// TestMigrateHomeNetRetirement — N°324 : la retraite du mode HomeNet
// convertit AU BOOT tout état hérité — comptes homenet → hotspot, PlanID
// homenet-* → hotspot-* (abonnement + demandes de facturation), audience
// d'annonce homenet → all, pauses dîner LEVÉES + une commande device_pause
// VIDE enfilée pour les box des comptes convertis (le script retire toutes
// les règles « mikcloud-pause »). Idempotente : second passage sans
// changement.
func TestMigrateHomeNetRetirement(t *testing.T) {
	db := &model.DB{
		Accounts: []model.Account{
			{ID: "acc-maison", Usage: model.AccountUsageHomeNet},
			{ID: "acc-autre", Usage: model.AccountUsageHotspot}, // contrôle : jamais converti
		},
		SettingsByAccount: map[string]model.Settings{
			"acc-maison": {Subscription: model.Subscription{PlanID: "homenet-mensuel", Status: "active"}},
			"acc-autre":  {Subscription: model.Subscription{PlanID: "hotspot-mensuel", Status: "active"}},
		},
		BillingRequests: []model.BillingRequest{
			{ID: "breq-annuel", AccountID: "acc-maison", PlanID: "homenet-annuel", Status: "pending"},
		},
		Announcements: []model.Announcement{
			{Title: "Message foyer", Level: "info", Audience: model.AnnouncementAudienceHomeNet},
			{Title: "Message public", Level: "info", Audience: model.AnnouncementAudienceAll}, // contrôle
		},
		Devices: []model.Device{
			// Pause dîner active sur la box du compte converti…
			{ID: "dev-1", AccountID: "acc-maison", RouterID: "r-maison", MAC: "AA:BB:CC:DD:EE:01",
				Paused: true, PausedUntil: "2999-01-01T00:00:00Z"},
			// …et sur la box d'un compte NON converti (contrôle : conservée).
			{ID: "dev-2", AccountID: "acc-autre", RouterID: "r-autre", MAC: "AA:BB:CC:DD:EE:02",
				Paused: true},
		},
		Routers: []model.Router{
			{ID: "r-maison", AccountID: "acc-maison", PauseSig: "dp-v1-ancienne"},
			{ID: "r-autre", AccountID: "acc-autre", PauseSig: "dp-v1-autre"},
		},
	}

	if !migrateHomeNetRetirement(db) {
		t.Fatal("la retraite initiale doit signaler un changement")
	}

	// (a) Comptes : homenet → hotspot ; le compte hotspot reste intact.
	if got := db.Accounts[0].Usage; got != model.AccountUsageHotspot {
		t.Fatalf("compte acc-maison : usage = %q, attendu %q (converti)", got, model.AccountUsageHotspot)
	}
	if got := db.Accounts[1].Usage; got != model.AccountUsageHotspot {
		t.Fatalf("compte acc-autre : usage = %q, attendu %q (déjà hotspot)", got, model.AccountUsageHotspot)
	}

	// (b) PlanID hérités : abonnements et demandes de facturation basculés
	// sur la grille unique (libellé compat rafraîchi).
	if got := db.SettingsByAccount["acc-maison"].Subscription.PlanID; got != "hotspot-mensuel" {
		t.Fatalf("abonnement acc-maison : PlanID = %q, attendu hotspot-mensuel", got)
	}
	if p := db.SettingsByAccount["acc-maison"].Plan; p.Name != "403Shield Hotspot Mensuel" || p.MaxRouters != "Par routeur" {
		t.Fatalf("libellé compat acc-maison = %+v", p)
	}
	if got := db.SettingsByAccount["acc-autre"].Subscription.PlanID; got != "hotspot-mensuel" {
		t.Fatalf("abonnement acc-autre : PlanID = %q, attendu hotspot-mensuel (inchangé)", got)
	}
	if got := db.BillingRequests[0].PlanID; got != "hotspot-annuel" {
		t.Fatalf("demande breq-annuel : PlanID = %q, attendu hotspot-annuel", got)
	}

	// (c) Annonces : audience homenet → all (sinon invisibles à jamais) ;
	// les autres audiences restent telles quelles.
	if got := db.Announcements[0].Audience; got != model.AnnouncementAudienceAll {
		t.Fatalf("audience de « Message foyer » = %q, attendu %q (convertie)", got, model.AnnouncementAudienceAll)
	}
	if got := db.Announcements[1].Audience; got != model.AnnouncementAudienceAll {
		t.Fatalf("audience de « Message public » = %q, attendu %q (inchangée)", got, model.AnnouncementAudienceAll)
	}

	// (d) Pauses dîner : levées pour le compte CONVERTI (l'état désiré est
	// mort avec le mode), conservées pour le compte hotspot de contrôle.
	if db.Devices[0].Paused || db.Devices[0].PausedUntil != "" {
		t.Fatalf("pause du compte converti doit être levée : %+v", db.Devices[0])
	}
	if !db.Devices[1].Paused {
		t.Fatal("pause du compte NON converti doit être conservée")
	}
	// Le routeur du compte converti est forcé à re-converger (PauseSig
	// effacée) ; celui du compte témoin garde sa signature.
	if got := db.Routers[0].PauseSig; got != "" {
		t.Fatalf("PauseSig du routeur converti = %q, attendu vide (re-convergence)", got)
	}
	if got := db.Routers[1].PauseSig; got != "dp-v1-autre" {
		t.Fatalf("PauseSig du routeur témoin = %q, attendu dp-v1-autre (inchangée)", got)
	}

	// Une commande device_pause VIDE est enfilée pour LA box convertie
	// (payload macs « ; » = zéro MAC, signature de l'ensemble vide) — le
	// script retire TOUTES les règles « mikcloud-pause » : le convergeur
	// ne repassera plus pour un compte sans module Cybercafé, il ne faut
	// pas laisser une coupure familiale à vie sur le routeur.
	pauses := 0
	for _, c := range db.Commands {
		if c.Kind != model.CmdDevicePause {
			continue
		}
		pauses++
		if c.RouterID != "r-maison" || c.Status != "queued" {
			t.Fatalf("commande device_pause inattendue : %+v", c)
		}
		if macs, _ := c.Payload["macs"].(string); macs != ";" {
			t.Fatalf("payload macs = %v, attendu « ; » (ensemble vide)", c.Payload["macs"])
		}
		if sig, _ := c.Payload["sig"].(string); sig != homeNetRetirePauseSig {
			t.Fatalf("payload sig = %q, attendu la signature vide %q", sig, homeNetRetirePauseSig)
		}
	}
	if pauses != 1 {
		t.Fatalf("exactement 1 commande device_pause attendue (la box convertie), %d trouvées", pauses)
	}

	// Idempotence : un second passage ne change rien (comptes déjà
	// hotspot, pauses déjà levées, signature déjà effacée).
	if migrateHomeNetRetirement(db) {
		t.Fatal("la retraite doit être idempotente (second passage sans changement)")
	}
	if len(db.Commands) != 1 {
		t.Fatalf("aucune nouvelle commande ne doit être enfilée au second passage, %d au total", len(db.Commands))
	}
}
