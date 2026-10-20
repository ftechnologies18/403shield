// wgsetup_heal_test.go — N°344 — tests du coup de pouce de démarrage : les
// routeurs tunnels ACTIFS reçoivent un wg_setup re-filé au boot (la règle
// pare-feu du pilotage direct n'existe pas dans les scripts posés avant
// N°344 — rien d'autre ne la poserait : ni provisioning, ni wg-params, ni
// convergence au résultat sans un PREMIER rapport neuf).
//
// Couverture :
//   - un routeur actif à paramètres complets → UNE commande wg_setup en
//     file, état pending_setup ;
//   - rejeu immédiat → AUCUN doublon (garde pendingCommandOfKind) ;
//   - routeur wg inactif / paramètres incomplets / mode non agent →
//     AUCUNE commande ;
//   - les COMPTES distincts sont tous servis (un re-file par routeur).
package api

import (
	"testing"

	"mikcloud/hotspot-api/internal/model"
)

func TestWgSetupHealOnce(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	db.Accounts = append(db.Accounts,
		model.Account{ID: "acc-a", Name: "Café A", Status: "active", Email: "a@example.com"},
		model.Account{ID: "acc-b", Name: "Café B", Status: "active", Email: "b@example.com"},
	)
	// Éligibles : agents, tunnel actif, paramètres complets.
	db.Routers = append(db.Routers,
		model.Router{ID: "r-a1", AccountID: "acc-a", Name: "A1", Mode: "agent", Status: "online",
			WgState: "active", WgPeerName: "r-a1", WgIPv4: "10.8.0.2",
			WgServerPub: proKey, WgPSK: proKey, WgEndpoint: "203.0.113.10:51820"},
		model.Router{ID: "r-b1", AccountID: "acc-b", Name: "B1", Mode: "agent", Status: "online",
			WgState: "active", WgPeerName: "r-b1", WgIPv4: "10.8.0.3",
			WgServerPub: proKey, WgPSK: proKey, WgEndpoint: "203.0.113.10:51820"},
		// Non éligibles : wg prêt SANS tunnel actif / params incomplets / mode réel.
		model.Router{ID: "r-a2", AccountID: "acc-a", Name: "A2", Mode: "agent", Status: "online",
			WgState: "ready", WgServerPub: proKey, WgPSK: proKey, WgEndpoint: "203.0.113.10:51820"},
		model.Router{ID: "r-a3", AccountID: "acc-a", Name: "A3", Mode: "agent", Status: "online",
			WgState: "active", WgIPv4: "10.8.0.4"}, // pas de pub/psk/endpoint
		model.Router{ID: "r-a4", AccountID: "acc-a", Name: "A4", Mode: "real", Status: "online",
			WgState: "active", WgServerPub: proKey, WgPSK: proKey, WgEndpoint: "203.0.113.10:51820"},
	)
	st.Save()
	st.Unlock()

	// 1. Passage : les DEUX routeurs éligibles (comptes distincts) sont re-filés.
	if n := a.RunWgSetupHealOnce(); n != 2 {
		t.Fatalf("2 routeurs attendus (un par compte éligible), eu %d", n)
	}
	st.Lock()
	queued := map[string]int{}
	for _, c := range st.Data().Commands {
		if c.Kind == model.CmdWgSetup {
			queued[c.RouterID]++
		}
	}
	if queued["r-a1"] != 1 || queued["r-b1"] != 1 {
		t.Fatalf("wg_setup attendu sur r-a1 et r-b1, eu %v", queued)
	}
	for _, id := range []string{"r-a2", "r-a3", "r-a4"} {
		if queued[id] != 0 {
			t.Fatalf("%s ne doit PAS être re-filé (%v)", id, queued)
		}
	}
	// État honnête pendant l'attente du check-in.
	if r := findRouterByID(st.Data(), "r-a1"); r == nil || r.WgState != "pending_setup" {
		t.Fatalf("r-a1 doit passer pending_setup, eu %+v", r)
	}
	st.Unlock()

	// 2. Rejeu immédiat : la garde anti-doublon (commande déjà en file) tient.
	if n := a.RunWgSetupHealOnce(); n != 0 {
		t.Fatalf("rejeu : 0 re-file attendu (commandes déjà en file), eu %d", n)
	}
	st.Lock()
	total := 0
	for _, c := range st.Data().Commands {
		if c.Kind == model.CmdWgSetup {
			total++
		}
	}
	st.Unlock()
	if total != 2 {
		t.Fatalf("2 commandes wg_setup au total attendues, eu %d", total)
	}
}

// findRouterByID — routeur par ID exact (harnais local).
func findRouterByID(db *model.DB, id string) *model.Router {
	for i := range db.Routers {
		if db.Routers[i].ID == id {
			return &db.Routers[i]
		}
	}
	return nil
}
