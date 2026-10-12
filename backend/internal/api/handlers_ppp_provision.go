// handlers_ppp_provision.go — N°310 — provisionnement AUTOMATIQUE du serveur
// PPPoE (voie agent, zéro saisie — miroir wg-auto N°307 pour le chantier PPP).
//
// Le « provisioning assisté » N°294 (D2 phase B) livrait un script .rsc à
// coller SOI-MÊME dans le terminal : interface à bridge, plage du pool,
// adresse locale, DNS — hors de portée d'un gérant sans notion réseau. La
// voie royale N°310 enfile UNE commande agent ppp_provision : le script
// exécuté SUR LE ROUTEUR détecte l'interface LAN et un /24 libre, pose pool
// + profil + pppoe-server de façon idempotente et RAPPORTTE les valeurs
// choisies (Command.Result) — le poll console les affiche.
//
// Contrats :
//   - canal AGENT canonique (D1 : zéro cred API, zéro port public,
//     CGNAT-proof, ≤ 45 s) — aucune dépendance au tunnel ni aux creds du
//     renfort : le provisionnement travaille là où vivent déjà les secrets ;
//   - idempotence : re-provisionner un serveur déjà en place est ok SANS
//     retouche (garde find par nom, exactement le .rsc assisté) — re-livraison
//     self-healing, pattern wg-auto ;
//   - transparence : les valeurs choisies (interface, pool, profil, service)
//     sont rapportées et visibles — le mode expert (.rsc, 7 champs) reste le
//     repli intégral pour les topologies exotiques ;
//   - état SANS colonne : la vérité vit dans le registre des commandes
//     (dernière ppp_provision du routeur : queued/sent/done/error + Result) —
//     aucun champ Router, aucun schéma DB, rien à synchroniser.
package api

import (
	"net/http"

	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
)

// pppProvisionTimeoutNote — message standard du délai agent (contrat D1).
const pppProvisionTimeoutNote = " (application au prochain check-in de l'agent, ≤ 45 s)"

// handlePppProvisionAuto — POST /api/routers/{routerID}/ppp/provision-auto :
// provisionne le serveur PPPoE SANS AUCUNE saisie. Enfile ppp_provision
// (corps vide = auto-détection totale : interface LAN + /24 libre choisis
// CÔTÉ ROUTEUR, vérité locale). Anti double-file : une commande du même kind
// déjà en attente est retournée telle quelle (aucun doublon, idempotence de
// l'INTENTION — pattern read_state de queueCommandLocked).
func (a *API) handlePppProvisionAuto(w http.ResponseWriter, r *http.Request) {
	if !a.guardAccountWrite(w, r) {
		return
	}
	acc := accountScope(r)
	id := r.PathValue("routerID")

	a.store.Lock()
	db := a.store.Data()
	rr := findRouterScoped(db, id, acc)
	if rr == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	if msg := pppAgentOnly(rr); msg != "" {
		a.store.Unlock()
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	// Déjà en attente → la MÊME intention (aucun doublon, même réponse).
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.RouterID == rr.ID && c.Kind == model.CmdPppProvision && c.Status == "queued" {
			cmdID := c.ID
			a.store.Unlock()
			writeJSON(w, http.StatusAccepted, map[string]any{
				"queued": true, "commandId": cmdID, "already": true,
				"message": "Un provisionnement est déjà en attente du prochain check-in (≤ 45 s) — laissez-le converger",
			})
			return
		}
	}
	cmd := queueCommandLocked(db, acc, rr.ID, model.CmdPppProvision,
		agent.PppProvisionPayloadFrom("", "", "", ""))
	a.logActivityBy(r, db, acc, "ppp", "Provisionnement AUTOMATIQUE du serveur PPPoE demandé pour «"+rr.Name+"» — l'agent détecte l'interface LAN et un sous-réseau libre, aucune valeur à saisir")
	a.store.Save()
	cmdID := cmd.ID
	routerName := rr.Name
	a.store.Unlock()

	writeJSON(w, http.StatusAccepted, map[string]any{
		"queued": true, "commandId": cmdID, "router": routerName,
		"message": "Le routeur provisionnera son serveur PPPoE automatiquement" + pppProvisionTimeoutNote,
	})
}

// handlePppProvisionStatus — GET /api/routers/{routerID}/ppp/provision :
// état du provisionnement automatique (poll console). La vérité = la
// DERNIÈRE commande ppp_provision du routeur (walk inverse du registre) :
//   - none    : jamais provisionné ;
//   - queued / sent : en attente du check-in (≤ 45 s) ;
//   - done    : plan appliqué — Result porte iface/pool/profile/service ;
//   - error   : cause (Result.message, bornée — jamais de secret).
//
// Lecture pure : aucun verrou d'écriture, aucun journal (le poll ne produit
// pas de bruit — pattern outils F9).
func (a *API) handlePppProvisionStatus(w http.ResponseWriter, r *http.Request) {
	acc := accountScope(r)
	id := r.PathValue("routerID")

	a.store.Lock()
	db := a.store.Data()
	rr := findRouterScoped(db, id, acc)
	if rr == nil {
		a.store.Unlock()
		writeErr(w, http.StatusNotFound, "Routeur introuvable")
		return
	}
	agentOnline := rr.Status == "online"
	var latest *model.Command
	for i := len(db.Commands) - 1; i >= 0; i-- {
		c := &db.Commands[i]
		if c.RouterID == rr.ID && c.Kind == model.CmdPppProvision {
			latest = c
			break
		}
	}
	out := map[string]any{
		"state":       "none",
		"agentOnline": agentOnline,
		"agentOnly":   rr.Mode == "agent",
	}
	if latest != nil {
		out["state"] = latest.Status // queued | sent | done | error
		out["commandId"] = latest.ID
		out["createdAt"] = latest.CreatedAt
		out["doneAt"] = latest.DoneAt
		if latest.Status == "done" {
			plan := map[string]any{
				"iface":   boundedString(resultStr(latest.Result, "iface"), 40),
				"pool":    boundedString(resultStr(latest.Result, "pool"), 20),
				"profile": boundedString(resultStr(latest.Result, "profile"), 64),
				"service": boundedString(resultStr(latest.Result, "service"), 40),
			}
			out["plan"] = plan
		}
		if latest.Status == "error" {
			out["message"] = boundedString(resultStr(latest.Result, "message"), 200)
		}
	}
	a.store.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// resultStr — lecture d'une clé string de Command.Result (tolérante : les
// valeurs arrivent en chaînes de formulaire — jamais de panic sur un type
// inattendu, "" par défaut).
func resultStr(m map[string]any, k string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}
