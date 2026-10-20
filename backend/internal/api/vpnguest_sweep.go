// vpnguest_sweep.go — N°342 — balayage périodique des INVITÉS arrivés à
// terme (Accès Invité) : la moitié du cycle de vie ne dépend de PERSONNE.
//
// Un invité est un accès de TIERS à périmètre minimal — sa promesse produit
// est de se refermer SEUL : personne n'a à se souvenir de le révoquer. Ce
// balayage applique l'échéance qui a déjà courtu (la VÉRITÉ reste la
// comparaison ExpiresAt < maintenant — jamais un champ « expired » persisté
// avec retard) et retire le peer de wg0 par le MÊME geste « remove » que la
// révocation manuelle.
//
// Il reprend AUSSI les retraits manqués : une révocation console dont le
// retrait wg-mini avait échoué (VM redeployée, service arrêté…) porte
// ErrorMsg — le balayage la nettoie (remove + ErrorMsg effacé). Un invité
// ne reste JAMAIS fantôme sur la VM à vie.
//
// Patron des balayages existants (retention.go N°64, publicvpn_sweep.go
// N°301, vpnquota_sweep.go N°311) : collecte sous verrou, gestes réseau HORS
// verrou (jamais d'appel wg-mini sous le verrou global), re-verrou par
// résultat, panique récupérée (reprise au passage suivant).
package api

import (
	"log"
	"runtime/debug"
	"time"

	"mikcloud/hotspot-api/internal/model"
)

// vpnGuestSweepInterval — cadence du balayage : 5 minutes. Le TTL minimal
// est 1 h : au plus 5 min de survie effective après le terme (≈8 % du TTL
// le plus court, ~0,1 % du plus long) — assez honnête sans marteler wg-mini
// (appel local ~ms, une requête par invité echu SEULEMENT).
const vpnGuestSweepInterval = 5 * time.Minute

// RunVpnGuestSweepForever — boucle (goroutine de main.go) : rattrapage au
// démarrage (les invités échus pendant un arrêt partent aussitôt) puis
// passage toutes les 5 min.
func (a *API) RunVpnGuestSweepForever() {
	sweep := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("vpn guests : panique récupérée (reprise au passage suivant) : %v\n%s", r, debug.Stack())
			}
		}()
		a.RunVpnGuestSweep()
	}
	sweep()
	for range time.Tick(vpnGuestSweepInterval) {
		sweep()
	}
}

// vpnGuestJob — un retrait à effectuer (collecté sous verrou, exécuté hors
// verrou : jamais d'appel wg-mini sous le verrou global).
type vpnGuestJob struct {
	id      string
	name    string
	label   string
	expired bool // true = échéance naturelle (trace dédiée), false = retrait manqué
}

// RunVpnGuestSweep — un passage : collecte sous verrou, removes wg-mini un
// à un hors verrou, re-verrou par résultat.
func (a *API) RunVpnGuestSweep() {
	now := model.NowISO()
	jobs := []vpnGuestJob{}

	// ---- 1. Collecte (VERROU) ----
	a.store.Lock()
	db := a.store.Data()
	for i := range db.VpnGuests {
		g := &db.VpnGuests[i]
		switch {
		case g.State == model.VpnGuestStateActive && model.VpnGuestExpired(g, now):
			jobs = append(jobs, vpnGuestJob{id: g.ID, name: g.Name, label: model.VpnGuestLabel(*g), expired: true})
		case g.State == model.VpnGuestStateRevoked && g.ErrorMsg != "":
			// Retrait manqué d'une révocation : on le retente au prochain
			// passage jusqu'à ce qu'il passe (jamais de fantôme à vie).
			jobs = append(jobs, vpnGuestJob{id: g.ID, name: g.Name, label: model.VpnGuestLabel(*g), expired: false})
		}
	}
	a.store.Unlock()
	if len(jobs) == 0 {
		return
	}

	// ---- 2. Retraits wg-mini (HORS verrou) + ---- 3. Résultats (VERROU) ----
	for _, job := range jobs {
		err := wgMiniRemoveFn(job.name)
		a.store.Lock()
		if g := findVpnGuestByID(a.store.Data(), job.id); g != nil {
			if err != nil {
				// Échec : ErrorMsg conservée/posée — reprise au passage suivant.
				g.ErrorMsg = boundedString("retrait VM en attente : "+err.Error(), 200)
				g.UpdatedAt = model.NowISO()
				if job.expired {
					// L'échéance reste la vérité : l'état ne passe PAS à revoked
					// tant que le peer vit sur wg0 (reveal déjà coupé par la
					// comparaison d'échéance — jamais un mensonge d'état).
					g.State = model.VpnGuestStateActive
				}
				a.logActivity(a.store.Data(), model.AccountMainID, "tunnel",
					"Expiration invité "+job.label+" : retrait VM en attente ("+boundedString(err.Error(), 120)+")")
			} else {
				g.State = model.VpnGuestStateRevoked
				g.ErrorMsg = ""
				g.Conf = ""
				g.UpdatedAt = model.NowISO()
				if job.expired {
					a.logActivity(a.store.Data(), model.AccountMainID, "tunnel",
						"Invité "+job.label+" arrivé à terme — peer retiré du tunnel ("+g.ExpiresAt+")")
				} else {
					a.logActivity(a.store.Data(), model.AccountMainID, "tunnel",
						"Retrait différé de l'invité "+job.label+" finalisé (révocation antérieure)")
				}
			}
			a.store.Save()
		}
		a.store.Unlock()
	}
}

// findVpnGuestByID — l'invité par son ID exact, SANS périmètre de compte
// (le sweep a déjà collecté l'ID sous verrou depuis le registre lui-même :
// aucune surface d'énumération ici, nil = ligne disparue entre-temps — le
// geste est alors sans objet).
func findVpnGuestByID(db *model.DB, id string) *model.VpnGuest {
	if id == "" {
		return nil
	}
	for i := range db.VpnGuests {
		if db.VpnGuests[i].ID == id {
			return &db.VpnGuests[i]
		}
	}
	return nil
}
