// wgsetup_heal.go — N°344 — cicatrice du « Tunnel non joignable » : au
// démarrage du backend, re-file wg_setup aux routeurs tunnels ACTIFS.
//
// INCIDENT (2026-10-20, première commande Pro de la production) : le
// diagnostic wg-test dial 10.8.0.N:8728/8291 à travers wg0 — la sonde
// échouait « Tunnel non joignable » sur un tunnel PLEINEMENT vivant
// (handshake 18 s) parce que le pare-feu RouterOS par défaut jette l'input
// venant de mikcloud-wg. La règle marquée « mikcloud-wg-in » (agent/
// wireguard.go, N°344) ouvre le pilotage direct promis depuis D-B1 — mais
// les routeurs déjà configurés ne reçoivent un wg_setup NEUF que sur un
// geste (provisioning Pro, wg-params, wg-enable). CE balayage de démarrage
// referme la cicatrice : chaque boot re-file le script du jour aux routeurs
// actifs (idempotent par construction — remove-then-add par marqueur côté
// routeur, anti-doublon par commande déjà en file).
//
// Coût honnête : un redémarrage de backend = un re-file par routeur tunnel
// actif, appliqué au check-in suivant (≤ 45 s + cadence veille), blip de
// tunnel < 25 s (keepalive), le check-in agent (socle, HTTPS public) n'est
// JAMAIS sur ce chemin. La convergence au RÉSULTAT (fw=0 = script ancien)
// est le filet qui suit — ce balayage n'est que le coup de pouce initial.
package api

import "log"

// RunWgSetupHealOnce — un passage : pour chaque compte possédant au moins
// un routeur tunnel actif, queueWgSetupRefreshLocked (le geste existant,
// avec ses gardes : paramètres complets, commande non déjà en file, valeurs
// stockées saines). Retour : le nombre de routeurs reconfigurés.
func (a *API) RunWgSetupHealOnce() int {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("wg setup heal : panique récupérée (abandonnée — la convergence au résultat reprendra) : %v", r)
		}
	}()
	accounts := map[string]bool{}
	a.store.Lock()
	db := a.store.Data()
	for i := range db.Routers {
		rot := &db.Routers[i]
		if rot.Mode == "agent" && rot.WgState == "active" && rot.AccountID != "" {
			accounts[rot.AccountID] = true
		}
	}
	n := 0
	for acc := range accounts {
		n += a.queueWgSetupRefreshLocked(nil, db, acc, "démarrage : pare-feu du pilotage direct (N°344)")
	}
	if n > 0 {
		a.store.Save()
	}
	a.store.Unlock()
	if n > 0 {
		log.Printf("wg setup : %d routeur(s) tunnel reconfiguré(s) au démarrage (règle pare-feu du pilotage direct — application au check-in, ≤ 45 s par routeur)", n)
	}
	return n
}
