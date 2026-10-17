// vpnquota_sweep.go — N°311 — balayage périodique du QUOTA MENSUEL DE TRAFIC
// des peers VPN vendus (garde-fou egress P-B — N°289 §3.1/§3.3, décisions
// D-a/D-b arbitrées en session : quota plateforme + révocation/notification).
//
// POURQUOI : l'egress (sortie Internet) des clients full-tunnel traverse la
// VM — l'alerte documentée N°289 §3.3 surveille le PLAFOND du tier Always
// Free OCI (~10 To/mois TOUTE la plateforme). Un client qui consomme
// 24h/24 dépasse ce plafond SANS jamais commettre un pic de débit : seul un
// cumul mensuel par peer peut l'arrêter à temps. La limite de débit kernel
// (tc/HTB, « Niveau B ») protégerait la pipe mais pas le volume — elle
// restera un chantier séparé si les volumes réels l'exigent.
//
// MÉCANIQUE (toutes les 15 min, rattrapage au démarrage) :
//  1. ÉCHANTILLON — wg-mini /v1/list HORS verrou : compteurs cumulés wg par
//     peer (rx/tx confondus — proxy honnête de la contribution au egress
//     facturé : wg tx ≈ réponses servies au client, wg rx ≈ requêtes
//     renvoyées vers Internet après décapsulage).
//  2. ACCUMULATION — sous verrou, par DELTAS dans la fenêtre du mois
//     calendaire UTC (QuotaMonth — le cycle de facturation OCI) ; un
//     compteur qui RECULE = reboot VM (les compteurs wg repartent de zéro)
//     → REBASE : delta = valeur courante (jamais de cumul négatif, jamais de
//     double comptage). Un peer absent du wg0 (révocation/terme en cours)
//     garde son cumul gelé — l'histoire ne se réécrit pas.
//  3. RÉVOCATION — au dépassement du quota plateforme
//     (settings.platform_wg_vpn_quota_gb, défaut 50 Go, 0 = illimité) :
//     wg-peer.sh remove HORS verrou (syncconf à chaud, les autres peers
//     restent intacts), puis re-verrou : ligne retirée du registre,
//     commande B2C liée passée « cancelled », journal, notification du
//     compte (e-mail + Telegram, relais plateforme — pattern
//     dispatchPppReminder N°294). Échec wg-mini : le terme est RETENTÉ au
//     passage suivant (un accès qui dure trop vaut mieux qu'un registre
//     mensonger — même verdict que publicvpn_sweep N°301).
//
// PÉRIMÈTRE D-d : peers B2C « vpn-* » UNIQUEMENT (registre vpn_peers) — les
// peers ROUTEURS de gestion (WgPeerName, N°285/307) ne sont PAS dans ce
// registre et ne sont jamais touchés (trafic de gestion minuscule, check-in
// HTTPS sortant indépendant de wg0).
//
// Patron des balayages existants (retention.go N°64, publicvpn_sweep.go
// N°301) : collecte sous verrou + gestes réseau HORS verrou + re-verrou par
// résultat (jamais d'appel wg-mini sous le verrou global), panique
// récupérée (la boucle repart au passage suivant).
package api

import (
	"fmt"
	"log"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/notify"
	"mikcloud/hotspot-api/internal/store"
)

// vpnQuotaSweepInterval — cadence du balayage : 15 min. Le péril est
// MENSUEL (le plafond egress OCI), pas à la seconde — 15 min bornent le
// dépassement en dépassement détecté (± un échantillon) sans marteler
// wg-mini (appel local ~ms, budget intact).
const vpnQuotaSweepInterval = 15 * time.Minute

// RunVpnQuotaSweepForever — boucle (goroutine de main.go) : rattrapage au
// démarrage puis passage toutes les 15 min.
func (a *API) RunVpnQuotaSweepForever() {
	sweep := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("vpn quota : panique récupérée (reprise au passage suivant) : %v\n%s", r, debug.Stack())
			}
		}()
		a.RunVpnQuotaSweep()
	}
	sweep()
	for range time.Tick(vpnQuotaSweepInterval) {
		sweep()
	}
}

// quotaJob — une révocation à effectuer (collectée sous verrou, exécutée
// hors verrou : jamais d'appel wg-mini sous le verrou global).
type quotaJob struct {
	peerID     string
	peerName   string
	accountID  string
	usedBytes  int64
	limitBytes int64
}

// RunVpnQuotaSweep — un passage : échantillon hors verrou, accumulation sous
// verrou, révocations une à une (remove hors verrou, re-verrou par résultat).
func (a *API) RunVpnQuotaSweep() {
	// ---- 1. Échantillon wg-mini (HORS verrou) ----
	peers, err := wgMiniListFn()
	if err != nil {
		// wg-mini indisponible (service arrêté, VM redémarrée…) : le cumul
		// reprendra au prochain passage — un trou d'échantillon ne compte
		// JAMAIS du trafic fantôme (les deltas repartent du dernier point).
		log.Printf("vpn quota : échantillon wg-mini impossible (%v) — reprise au passage suivant", err)
		return
	}
	totals := make(map[string]int64, len(peers))
	for _, p := range peers {
		totals[p.Name] = parseWgTransferBytes(p.Transfer)
	}
	month := model.VpnQuotaMonthKey(time.Now())

	// ---- 2. Accumulation + détection (VERROU) ----
	jobs := []quotaJob{}
	a.store.Lock()
	db := a.store.Data()
	limitGB := model.DefaultWgVpnMonthlyQuotaGB
	if s, ok := db.SettingsByAccount[model.AccountMainID]; ok && s.Platform != nil {
		limitGB = s.Platform.WgVpnMonthlyQuotaEffective()
	}
	limitBytes := int64(limitGB) << 30 // « Go » = GiB binaire, aligné sur les compteurs wg
	changed := false
	for i := range db.VpnPeers {
		p := &db.VpnPeers[i]
		raw, seen := totals[p.Name]
		if !seen {
			continue // absent du wg0 : cumul gelé (révocation/terme déjà en cours)
		}
		if p.QuotaMonth != month {
			// Rollover mensuel : la fenêtre d'abus repart à zéro (cycle OCI).
			p.QuotaMonth = month
			p.QuotaBytes = 0
			changed = true
		}
		delta := raw - p.QuotaLast
		if delta < 0 {
			// Compteur qui recule = reboot VM (wg repart de zéro) : rebase.
			delta = raw
		}
		if delta > 0 {
			p.QuotaBytes += delta
			changed = true
		}
		if p.QuotaLast != raw {
			p.QuotaLast = raw
			changed = true
		}
		// D-b : révocation au dépassement — UNIQUEMENT les peers actifs (un
		// peer pending n'existe pas encore côté VM, un peer error est déjà
		// dans un état visible du gérant). 0 = illimité (D-a).
		if limitBytes > 0 && p.State == model.VpnStateActive && p.QuotaBytes > limitBytes {
			jobs = append(jobs, quotaJob{
				peerID: p.ID, peerName: p.Name, accountID: p.AccountID,
				usedBytes: p.QuotaBytes, limitBytes: limitBytes,
			})
		}
	}
	if changed {
		a.store.Save()
	}
	a.store.Unlock()

	// ---- 3. Révocations (remove HORS verrou, re-verrou par résultat) ----
	for _, job := range jobs {
		if err := wgMiniRemoveFn(job.peerName); err != nil {
			// Retenté au passage suivant : la ligne reste au registre, le
			// cumul continue de croître — le dépassement reste visible.
			log.Printf("vpn quota : révocation %s non applicable (wg-mini : %v) — retentée au passage suivant", job.peerName, err)
			continue
		}
		a.store.Lock()
		db = a.store.Data()
		idx := -1
		for i := range db.VpnPeers {
			if db.VpnPeers[i].ID == job.peerID && db.VpnPeers[i].Name == job.peerName {
				idx = i
				break
			}
		}
		if idx < 0 {
			// Déjà retirée entre-temps (geste concurrent console) : rien à faire.
			a.store.Unlock()
			continue
		}
		peer := db.VpnPeers[idx]
		db.VpnPeers = removeVpnPeerByID(db.VpnPeers, job.peerID)
		// Commande B2C liée : annulée APRÈS confirmation VM (cohérence
		// registre — jamais d'état mensonger si wg-mini échoue, même
		// discipline que handlePlatformVpnPeerRevoke N°301).
		ref := ""
		for i := range db.PublicVpnOrders {
			if db.PublicVpnOrders[i].PeerID == job.peerID && db.PublicVpnOrders[i].Status == model.PublicVpnOrderProvisioned {
				db.PublicVpnOrders[i].Status = model.PublicVpnOrderCancelled
				db.PublicVpnOrders[i].UpdatedAt = model.NowISO()
				db.PublicVpnOrders[i].ResolvedBy = "quota mensuel dépassé (révocation automatique)"
				db.PublicVpnOrders[i].ErrorMsg = "peer révoqué : quota mensuel de trafic dépassé"
				ref = db.PublicVpnOrders[i].Ref
			}
		}
		a.logActivity(db, job.accountID, "vpn",
			fmt.Sprintf("Peer VPN révoqué — quota mensuel dépassé (%s / %s Go) : %s (%s)",
				gib(job.usedBytes), gib(job.limitBytes), model.VpnPeerLabel(peer), peer.Name))
		if ref != "" {
			a.logActivity(db, model.AccountMainID, "vpn",
				"Commande VPN B2C "+ref+" : peer révoqué (quota mensuel de trafic dépassé)")
		}
		// Notification du compte (e-mail + Telegram, relais plateforme) —
		// appelé sous verrou, il ne fait que lire des copies valeur puis
		// spawn une goroutine (pattern dispatchPppReminder N°294).
		a.dispatchVpnQuotaNotice(db, peer, job.usedBytes, job.limitBytes)
		a.store.Save()
		a.store.Unlock()
	}
}

// dispatchVpnQuotaNotice — N°311 — notification « quota dépassé, peer
// révoqué » au compte propriétaire (gérant) ou à la plateforme (pair B2C,
// AccountMainID). Mail + Telegram du compte avec relais e-mail plateforme
// (N°150) ; WhatsApp reste le chantier N°149. APPELÉ SOUS VERROU : copies
// valeur uniquement, l'envoi réseau part en goroutine (jamais sous le
// verrou), la goroutine re-verrouille pour consigner dans NotifLog
// (résumés sans secret — pattern dispatchPppReminder).
func (a *API) dispatchVpnQuotaNotice(db *model.DB, peer model.VpnPeer, usedBytes, limitBytes int64) {
	cfg := store.GetOrCreateNotifSettings(db, peer.AccountID)
	cfgCopy := cfg // copie VALEUR : la goroutine ne touche jamais au store
	var platformEmail model.NotificationSettings
	hasRelay := false
	if ptr := a.platformEmailRelayPtrLocked(db); ptr != nil {
		platformEmail = *ptr
		hasRelay = true
	}
	var relayPtr *model.NotificationSettings
	if hasRelay {
		relayPtr = &platformEmail
	}
	emailOK := notify.ConfiguredWithPlatform(&cfgCopy, relayPtr, "email")
	telegramOK := notify.ConfiguredWithPlatform(&cfgCopy, nil, "telegram")
	if !emailOK && !telegramOK {
		return // aucun canal : le journal d'activité garde la trace
	}
	title := "403Shield — Peer VPN révoqué (quota mensuel dépassé)"
	body := "Le peer VPN « " + model.VpnPeerLabel(peer) + " » (" + peer.Name + ") a dépassé son quota mensuel de trafic : " +
		gib(usedBytes) + " Go consommés sur une limite de " + gib(limitBytes) + " Go.\n" +
		"Le peer a été révoqué automatiquement — le client n'a plus d'accès (les autres peers sont intacts).\n" +
		"Recréez le peer depuis la console 403Shield — VPN si le client doit repartir : le compteur repart de zéro au changement de mois.\n" +
		"Ce garde-fou protège la bande passante de la plateforme (réglable : console plateforme — Paramètres — quota mensuel VPN)."
	accID, label, name := peer.AccountID, model.VpnPeerLabel(peer), peer.Name
	emailTaskDispatch()(func() {
		logs := deliverNotif(&cfgCopy, relayPtr, "vpn_quota", title, body, "")
		a.store.Lock()
		dbn := a.store.Data()
		for _, l := range logs {
			l.ID = model.NewID("n-")
			l.At = model.NowISO()
			l.AccountID = accID // trace au compte émetteur (isolation)
			l.Body = label + " (" + name + ") — quota mensuel dépassé, peer révoqué"
			dbn.NotifLog = append(dbn.NotifLog, l)
		}
		a.store.Save()
		a.store.Unlock()
	})
}

// gib — octets → Go (GiB binaire) avec une décimale, pour les messages et
// journaux (« 52,3 »). Les compteurs wg et le quota parlent en base 2.
func gib(b int64) string {
	return strconv.FormatFloat(float64(b)/(1<<30), 'f', 1, 64)
}

// parseWgTransferBytes — le champ « reçu/envoyé » de wg-peer.sh list en
// OCTETS BRUTS (« 1234567/89101112 », sortie directe de `wg show transfer`)
// ; « — » (jamais de transfert) ou vide → 0. Par robustesse le parseur
// accepte AUSSI les formats unités (« 1.2 MiB/3.4 MiB » — si wg-peer.sh
// évolue vers un affichage humain, le cumul reste juste). rx+tx CONFONDUS :
// pour un full-tunnel, les deux directions deviennent du egress facturé
// (réponses servies au client + requêtes renvoyées vers Internet).
func parseWgTransferBytes(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "—" || s == "-" {
		return 0
	}
	total := int64(0)
	for _, part := range strings.Split(s, "/") {
		total += parseByteCount(strings.TrimSpace(part))
	}
	return total
}

// parseByteCount — un compteur : octets bruts (« 1234567 ») ou « 1.2 MiB ».
// Unité inconnue → 0 (prudence : rien plutôt qu'un compte faux — le delta
// suivant repartira de la dernière valeur SÛRE).
func parseByteCount(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	i := 0
	for i < len(s) && ((s[i] >= '0' && s[i] <= '9') || s[i] == '.') {
		i++
	}
	numPart := s[:i]
	if numPart == "" {
		return 0
	}
	v, err := strconv.ParseFloat(numPart, 64)
	if err != nil {
		return 0
	}
	switch strings.TrimSpace(s[i:]) {
	case "", "B":
		return int64(v)
	case "KiB":
		return int64(v * (1 << 10))
	case "MiB":
		return int64(v * (1 << 20))
	case "GiB":
		return int64(v * (1 << 30))
	case "TiB":
		return int64(v * (1 << 40))
	case "PiB":
		return int64(v * (1 << 50))
	default:
		return 0
	}
}
