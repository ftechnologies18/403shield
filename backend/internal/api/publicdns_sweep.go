// publicdns_sweep.go — N°347 — balayage PÉRIODIQUE du canal DNS « TOURACO »
// (miroir strict de publicvpn_sweep.go N°301 — les mêmes promesses, sans
// le réseau) : le seul filet qui garantit les termes SANS personne devant
// une console.
//
//  1. TERMES : chaque commande « provisioned » dont ExpiresAt est franchi
//     passe « expired » — l'entitlement disparaît, les quotas retombent au
//     tier gratuit au calcul suivant (les profils/logements restent servis,
//     rien n'est supprimé : seule la création au-delà des bornes gratuites
//     redevient refusée). AUCUN réseau à révoquer (la différence VPN : pas
//     de peer wg0, le droit est l'échéance).
//  2. STALE : une commande « pending » non réglée depuis 48 h est annulée
//     (les liens de paiement GeniusPay expirent de toute façon sous 24 h).
//  3. RETRY : chaque commande « paid » non provisionnée (échec au moment du
//     paiement — l'e-mail d'activation n'empêche pas le droit) est REJOUÉE —
//     la promesse « activation auto » ne se perd jamais.
package api

import (
	"log"
	"runtime/debug"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// publicDnsSweepInterval — cadence du balayage : horaire (les termes sont au
// jour près, les retries ne justifient pas plus serré — miroir VPN).
const publicDnsSweepInterval = time.Hour

// RunPublicDnsSweepForever — boucle (goroutine de main.go) : rattrapage au
// démarrage puis passage horaire.
func (a *API) RunPublicDnsSweepForever() {
	sweep := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("dns TOURACO : panique récupérée (reprise à l'heure suivante) : %v\n%s", r, debug.Stack())
			}
		}()
		a.RunPublicDnsSweep()
	}
	sweep()
	for range time.Tick(publicDnsSweepInterval) {
		sweep()
	}
}

// RunPublicDnsSweep — un passage : tout se joue sous verrou (aucun appel
// réseau dans ce canal — le provisioning DNS est un geste de registre).
func (a *API) RunPublicDnsSweep() {
	now := model.NowISO()

	expired := []string{} // orderID
	stale := []string{}   // orderID
	retry := []string{}   // orderID
	a.store.Lock()
	db := a.store.Data()
	for i := range db.PublicDnsOrders {
		o := &db.PublicDnsOrders[i]
		switch o.Status {
		case model.PublicDnsOrderProvisioned:
			if o.ExpiresAt != "" && o.ExpiresAt < now {
				expired = append(expired, o.ID)
			}
		case model.PublicDnsOrderPending:
			if o.CreatedAt != "" && o.CreatedAt < dnsStaleCutoff(now) {
				stale = append(stale, o.ID)
			}
		case model.PublicDnsOrderPaid:
			retry = append(retry, o.ID)
		}
	}
	a.store.Unlock()

	// ---- 1. Termes : le droit cesse (registre seul, aucun réseau) ----
	for _, orderID := range expired {
		a.store.Lock()
		db = a.store.Data()
		if o := model.FindPublicDnsOrderByID(db, orderID); o != nil && o.Status == model.PublicDnsOrderProvisioned {
			o.Status = model.PublicDnsOrderExpired
			o.UpdatedAt = model.NowISO()
			o.ResolvedBy = "terme atteint (balayage)"
			a.logActivity(db, model.AccountMainID, "tunnel",
				"Abonnement DNS TOURACO arrivé à terme : "+o.Ref+" — les quotas de "+o.Email+" retombent au niveau gratuit (rien n'est supprimé)")
			a.store.Save()
		}
		a.store.Unlock()
	}

	// ---- 2. Stale : annulation simple (aucun réseau) ----
	for _, orderID := range stale {
		_ = a.cancelPublicDnsOrder(orderID, "commande non réglée (48 h)", "balayage horaire")
	}

	// ---- 3. Retry provisioning des « paid » ----
	for _, orderID := range retry {
		if _, err := a.provisionPublicDnsOrder(orderID); err != nil {
			log.Printf("dns TOURACO : retry provisioning %s : %v", orderID, err)
		}
	}
}

// dnsStaleCutoff — borne ISO d'annulation d'une commande pending
// (maintenant − PublicDnsStaleAfter ; comparaison lexicographique RFC3339
// sûre en UTC — miroir staleCutoff du canal VPN).
func dnsStaleCutoff(nowISO string) string {
	t, err := time.Parse(time.RFC3339, nowISO)
	if err != nil {
		return nowISO
	}
	return t.Add(-model.PublicDnsStaleAfter).UTC().Format(time.RFC3339)
}
