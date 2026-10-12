// Tests N°310 — provisionnement AUTOMATIQUE du serveur PPPoE (voie agent,
// zéro saisie) : cycle complet POST → file → rapport ok (plan rapporté) →
// poll done ; échec rapporté → error + cause ; idempotence d'intention
// (anti double-file) ; re-livraison self-healing après done ; isolation
// multi-compte ; mode non-agent refusé. Discipline du dépôt : surface HTTP
// RÉELLE (doJSON/postAgentResult), AUCUN réseau.
package api

import (
	"net/url"
	"strings"
	"testing"

	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// pppProvisionLastCmd — dernière commande ppp_provision du routeur (ou nil).
func pppProvisionLastCmd(st *store.Store, routerID string) *model.Command {
	st.Lock()
	defer st.Unlock()
	var out *model.Command
	for i := range st.Data().Commands {
		c := &st.Data().Commands[i]
		if c.RouterID == routerID && c.Kind == model.CmdPppProvision {
			out = c
		}
	}
	return out
}

// TestPppProvisionAutoCycle — la voie royale de bout en bout.
func TestPppProvisionAutoCycle(t *testing.T) {
	st, ts := newTestServerWithStore(t)
	ownerToken, accID, _ := registerAccount(t, ts, "ppp-prov", "")
	seedPppAgentRouter(t, st, accID, "rt-prov1", "POP Auto", "tok-prov1")

	// 1. Avant tout : état « none ».
	s, out := doJSON(t, ts, "GET", "/api/routers/rt-prov1/ppp/provision", ownerToken, nil)
	if s != 200 || out["state"] != "none" {
		t.Fatalf("état initial : 200/none attendus, %d %v", s, out)
	}

	// 2. POST voie royale — 202, commande en file, payload VIDE (zéro saisie).
	s, out = doJSON(t, ts, "POST", "/api/routers/rt-prov1/ppp/provision-auto", ownerToken, map[string]string{})
	if s != 202 || out["queued"] != true {
		t.Fatalf("POST provision-auto : 202/queued attendus, %d %v", s, out)
	}
	cmdID, _ := out["commandId"].(string)
	if cmdID == "" {
		t.Fatalf("POST provision-auto : commandId attendu, %v", out)
	}
	cmd := pppProvisionLastCmd(st, "rt-prov1")
	if cmd == nil || cmd.ID != cmdID || len(cmd.Payload) != 0 {
		t.Fatalf("commande ppp_provision en file (payload vide) attendue, %+v", cmd)
	}

	// 3. Anti double-file : le second POST renvoie la MÊME commande.
	s, out = doJSON(t, ts, "POST", "/api/routers/rt-prov1/ppp/provision-auto", ownerToken, map[string]string{})
	if s != 202 || out["already"] != true || out["commandId"] != cmdID {
		t.Fatalf("anti double-file : 202/already/même commande attendus, %d %v", s, out)
	}
	if n := pppProvisionCount(st, "rt-prov1"); n != 1 {
		t.Fatalf("une seule commande attendue en file, %d", n)
	}

	// 4. Le script généré est la voie automatique (détection + candidats).
	b := agent.Builder{BaseURL: "https://cloud.test", Token: "t"}
	script, err := b.ScriptFor(*cmd)
	if err != nil || !strings.Contains(script, "type=bridge") || !strings.Contains(script, `"10.10.0"`) {
		t.Fatalf("script ppp_provision inattendu (err %v)", err)
	}

	// 5. Poll pendant l'attente : queued.
	s, out = doJSON(t, ts, "GET", "/api/routers/rt-prov1/ppp/provision", ownerToken, nil)
	if s != 200 || out["state"] != "queued" {
		t.Fatalf("poll : queued attendu, %d %v", s, out)
	}

	// 6. Rapport agent ok (plan détecté côté routeur) → done + plan.
	if s, _ := postAgentResult(t, ts, url.Values{
		"token": {"tok-prov1"}, "cmd": {cmdID}, "status": {"ok"},
		"iface": {"bridge-lan"}, "pool": {"10.10.0"}, "profile": {"mikcloud-ppp"}, "service": {"mikcloud"},
	}); s != 200 {
		t.Fatalf("rapport agent ok : statut %d", s)
	}
	s, out = doJSON(t, ts, "GET", "/api/routers/rt-prov1/ppp/provision", ownerToken, nil)
	if s != 200 || out["state"] != "done" {
		t.Fatalf("poll : done attendu, %d %v", s, out)
	}
	plan, _ := out["plan"].(map[string]any)
	if plan == nil || plan["iface"] != "bridge-lan" || plan["pool"] != "10.10.0" ||
		plan["profile"] != "mikcloud-ppp" || plan["service"] != "mikcloud" {
		t.Fatalf("poll : plan rapporté attendu, %v", plan)
	}

	// 7. Journal : le geste automatique est tracé.
	if !activityHas(st, accID, "provisionné AUTOMATIQUEMENT") {
		t.Fatal("journal : trace « provisionné AUTOMATIQUEMENT » attendue")
	}

	// 8. Re-livraison self-healing : après done, un nouveau POST enfila une
	// NOUVELLE commande (idempotence ROUTEUR — relancer ne duplique rien).
	s, out = doJSON(t, ts, "POST", "/api/routers/rt-prov1/ppp/provision-auto", ownerToken, map[string]string{})
	if s != 202 || out["already"] == true {
		t.Fatalf("re-livraison : 202/nouvelle commande attendus, %d %v", s, out)
	}
	cmd2ID, _ := out["commandId"].(string)
	if cmd2ID == "" || cmd2ID == cmdID {
		t.Fatalf("re-livraison : nouvelle commande attendue, %v", out)
	}

	// 9. Échec rapporté → error + cause bornée (le poll la montre).
	if s, _ := postAgentResult(t, ts, url.Values{
		"token": {"tok-prov1"}, "cmd": {cmd2ID}, "status": {"error"},
		"message": {"aucun /24 libre (candidats occupes par vos reseaux)"},
	}); s != 200 {
		t.Fatalf("rapport agent error : statut %d", s)
	}
	s, out = doJSON(t, ts, "GET", "/api/routers/rt-prov1/ppp/provision", ownerToken, nil)
	if s != 200 || out["state"] != "error" {
		t.Fatalf("poll : error attendu, %d %v", s, out)
	}
	if msg, _ := out["message"].(string); !strings.Contains(msg, "aucun /24 libre") {
		t.Fatalf("poll : cause attendue, %v", out["message"])
	}

	// 10. Isolation multi-compte : le routeur d'un autre compte → 404.
	s2, out2 := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"name": "Gérant Autre", "username": "ppp-prov2", "password": "mot-de-passe-8+",
		"email": "ppp-prov2@example.ci", "phone": "0606060606", "country": "CI", "city": "Abidjan",
	})
	if s2 != 201 {
		t.Fatalf("inscription ppp-prov2 : statut %d, corps %v", s2, out2)
	}
	otherToken, _ := out2["token"].(string)
	if s, _ := doJSON(t, ts, "GET", "/api/routers/rt-prov1/ppp/provision", otherToken, nil); s != 404 {
		t.Fatalf("isolation : 404 attendu, %d", s)
	}
	if s, _ := doJSON(t, ts, "POST", "/api/routers/rt-prov1/ppp/provision-auto", otherToken, map[string]string{}); s != 404 {
		t.Fatalf("isolation : 404 attendu, %d", s)
	}

	// 11. Routeur simulé (non-agent) refusé — la commande ne convergerait pas.
	st.Lock()
	st.Data().Routers = append(st.Data().Routers, model.Router{
		ID: "rt-sim", AccountID: accID, Name: "Simulé", Mode: "simulated", CreatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()
	if s, _ := doJSON(t, ts, "POST", "/api/routers/rt-sim/ppp/provision-auto", ownerToken, map[string]string{}); s != 400 {
		t.Fatalf("routeur simulé : 400 attendu, %d", s)
	}
}

// pppProvisionCount — commandes ppp_provision QUEUED du routeur.
func pppProvisionCount(st *store.Store, routerID string) int {
	st.Lock()
	defer st.Unlock()
	n := 0
	for i := range st.Data().Commands {
		c := &st.Data().Commands[i]
		if c.RouterID == routerID && c.Kind == model.CmdPppProvision && c.Status == "queued" {
			n++
		}
	}
	return n
}

// activityHas — le journal du compte contient-il le fragment donné ?
func activityHas(st *store.Store, accID, frag string) bool {
	st.Lock()
	defer st.Unlock()
	for i := range st.Data().Activity {
		a := &st.Data().Activity[i]
		if a.AccountID == accID && strings.Contains(a.Message, frag) {
			return true
		}
	}
	return false
}
