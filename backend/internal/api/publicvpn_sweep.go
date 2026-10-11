// publicvpn_sweep.go — N°301 — balayage PÉRIODIQUE du canal B2C « vente
// directe » : le seul filet qui garantit les promesses de la vitrine SANS
// personne devant une console.
//
//   1. TERMES : chaque commande « provisioned » dont ExpiresAt est franchi
//      perd son peer (wg-peer.sh remove à chaud — le client n'a plus
//      d'accès, la ligne passe « expired », l'historique reste).
//   2. STALE : une commande « pending » non réglée depuis 48 h est annulée
//      (les liens de paiement GeniusPay expirent de toute façon sous 24 h).
//   3. RETRY : chaque commande « paid » non provisionnée (échec transitoire
//      wg-mini, pool épuisé au moment du paiement…) est REJOUÉE — la
//      promesse « provisioning auto » ne se perd jamais.
//
// Patron des balayages existants (retention.go N°64, chat_sweep.go N°129,
// announcement_sweep.go N°165) : goroutine lancée par main.go, rattrapage
// immédiat au démarrage, panique récupérée (la boucle repart au passage
// suivant), collecte sous verrou + gestes réseau HORS verrou + re-verrou
// par résultat (jamais d'appel wg-mini sous le verrou global).
package api

import (
	"log"
	"runtime/debug"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// publicVpnSweepInterval — cadence du balayage : horaire (les termes sont au
// jour près, les retries ne justifient pas plus serré — wg-mini casse
// rarement à la minute).
const publicVpnSweepInterval = time.Hour

// RunPublicVpnSweepForever — boucle (goroutine de main.go) : rattrapage au
// démarrage puis passage horaire.
func (a *API) RunPublicVpnSweepForever() {
	sweep := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("vpn B2C : panique récupérée (reprise à l'heure suivante) : %v\n%s", r, debug.Stack())
			}
		}()
		a.RunPublicVpnSweep()
	}
	sweep()
	for range time.Tick(publicVpnSweepInterval) {
		sweep()
	}
}

// RunPublicVpnSweep — un passage : collecte sous verrou, gestes réseau hors
// verrou, résultats re-verrouillés un par un.
func (a *API) RunPublicVpnSweep() {
	now := model.NowISO()

	// ---- Collecte (verrou) ----
	type expiryJob struct {
		orderID, peerID, peerName, ref string
	}
	expired := []expiryJob{}
	stale := []string{} // orderID
	retry := []string{} // orderID
	a.store.Lock()
	db := a.store.Data()
	for i := range db.PublicVpnOrders {
		o := &db.PublicVpnOrders[i]
		switch o.Status {
		case model.PublicVpnOrderProvisioned:
			if o.ExpiresAt != "" && o.ExpiresAt < now {
				expired = append(expired, expiryJob{orderID: o.ID, peerID: o.PeerID, peerName: o.PeerName, ref: o.Ref})
			}
		case model.PublicVpnOrderPending:
			if o.CreatedAt != "" && o.CreatedAt < staleCutoff(now) {
				stale = append(stale, o.ID)
			}
		case model.PublicVpnOrderPaid:
			retry = append(retry, o.ID)
		}
	}
	a.store.Unlock()

	// ---- 1. Termes : retrait wg0 hors verrou, puis expiration sous verrou ----
	for _, job := range expired {
		if err := wgMiniRemoveFn(job.peerName); err != nil {
			// wg-mini indisponible : le terme est RETENTÉ au passage suivant
			// (un accès qui dure trop vaut mieux qu'un registre mensonger).
			log.Printf("vpn B2C : terme %s non applicable (wg-mini : %v) — retenté à l'heure suivante", job.ref, err)
			continue
		}
		a.store.Lock()
		db = a.store.Data()
		if o := model.FindPublicVpnOrderByID(db, job.orderID); o != nil && o.Status == model.PublicVpnOrderProvisioned {
			o.Status = model.PublicVpnOrderExpired
			o.UpdatedAt = model.NowISO()
			o.ResolvedBy = "terme atteint (balayage)"
			if job.peerID != "" {
				db.VpnPeers = removeVpnPeerByID(db.VpnPeers, job.peerID)
			}
			a.logActivity(db, model.AccountMainID, "vpn",
				"Commande VPN B2C arrivée à terme : "+o.Ref+" — peer révoqué, le client n'a plus d'accès")
			a.store.Save()
		}
		a.store.Unlock()
	}

	// ---- 2. Stale : annulation simple (aucun réseau) ----
	for _, orderID := range stale {
		_ = a.cancelPublicVpnOrder(orderID, "commande non réglée (48 h)", "balayage horaire")
	}

	// ---- 3. Retry provisioning des « paid » ----
	for _, orderID := range retry {
		if _, err := a.provisionPublicVpnOrder(orderID); err != nil {
			log.Printf("vpn B2C : retry provisioning %s : %v", orderID, err)
		}
	}
}

// staleCutoff — borne ISO d'annulation d'une commande pending (maintenant −
// PublicVpnStaleAfter ; comparaison lexicographique RFC3339 sûre en UTC).
func staleCutoff(nowISO string) string {
	t, err := time.Parse(time.RFC3339, nowISO)
	if err != nil {
		return nowISO
	}
	return t.Add(-model.PublicVpnStaleAfter).UTC().Format(time.RFC3339)
}
