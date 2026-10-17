// handlers_devices.go — machinerie « appareils » du module Cybercafé (N°290).
//
// N°324 — RETRAITE DU MODE HOMENET : les handlers foyer (GET /api/devices,
// PUT nom affecté, POST pause dîner — N°101) sont SUPPRIMÉS avec le mode ;
// ce fichier conserve la MÉCANIQUE réutilisée par le module Cybercafé :
// cadenceur read_dhcp, upsert des bails (applyDeviceLeases), convergence
// device_pause (état désiré cloud, pattern FamilyGuard N°82) et import
// d'un bail comme poste (findDeviceScoped — handlers_cyber.go).
package api

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strconv"
	"strings"
	"time"

	"mikcloud/hotspot-api/internal/agent"
	"mikcloud/hotspot-api/internal/model"
)

// devicesMinInterval — N°101 — cadence du cycle read_dhcp d'un foyer : même
// pas que read_state (2 min). Un inventaire domestique est petit (≤ 100
// bails côté script), le coût est une commande de lecture légère (~1 Ko)
// toutes les ~2,7 check-ins — le régime egress N°74/N°75 reste la règle.
const devicesMinInterval = 2 * time.Minute

// deviceReadCap — le script read_dhcp rapporte AU PLUS 100 baux (borne F9).
// Un rapport de TAILLE EXACTEMENT 100 est potentiellement tronqué : aucune
// déduction « absent = parti » ne s'applique alors (honnêteté v2/v4 — on ne
// badgue jamais sur un rapport incomplet).
const deviceReadCap = 100

// N°324 — les handlers foyer (GET/PUT/POST /api/devices*, N°101) sont supprimés
// avec le mode HomeNet : la machinerie read_dhcp/device_pause reste (Cybercafé).

// ---------------------------------------------------------------------------
// Convergence device_pause (pattern FamilyGuard : le cloud calcule, le
// routeur converge — jamais d'horloge routeur consultée)
// ---------------------------------------------------------------------------

// desiredPauseMacsLocked — MAC des appareils HomeNet ET des postes Cybercafé
// (N°290 — le module réutilise la MÊME commande device_pause et la MÊME
// signature ; un poste en pause rejoint l'ensemble désiré de son routeur)
// de CE routeur dont la pause est effective à `now` (demandée ET non
// expirée), triées (signature stable). À appeler sous le verrou du store.
func desiredPauseMacsLocked(db *model.DB, routerID string, now time.Time) []string {
	macs := []string{}
	for i := range db.Devices {
		d := &db.Devices[i]
		if d.RouterID == routerID && d.PauseActiveAt(now) {
			macs = append(macs, d.MAC)
		}
	}
	for i := range db.CyberPostes {
		p := &db.CyberPostes[i]
		if p.RouterID == routerID && p.PauseActiveAt(now) {
			macs = append(macs, p.MAC)
		}
	}
	sort.Strings(macs)
	return macs
}

// DevicePauseVersion — sel de version de la forme des règles (pattern
// safeWifiRulesVersion) : toute évolution du script (nouveau marquage,
// paramètre supplémentaire) bump ce sel → chaque routeur en ligne reçoit la
// nouvelle forme au check-in suivant.
const DevicePauseVersion = "dp-v1"

// devicePauseSig — signature de l'ensemble pause : version + hash de la
// liste triée. Deux foyers aux mêmes pauses partagent la même signature —
// elle ne contient AUCUNE donnée compte/routeur.
func devicePauseSig(macs []string) string {
	h := sha256.Sum256([]byte(DevicePauseVersion + "|" + strings.Join(macs, ";")))
	return DevicePauseVersion + "-" + hex.EncodeToString(h[:8])
}

// queueDevicePauseLocked — dépose (ou met à jour) la commande device_pause
// pour CE routeur avec l'ensemble désiré COURANT. Une commande déjà « queued »
// est RÉÉCRITE (payload frais : deux pauses posées à la suite partagent le
// prochain check-in au lieu de le doubler) ; une commande « sent » est laissée
// (son rapport sera vérifié contre la signature désirée — périmée = re-file,
// pattern SafeWiFi « le gérant change d'avis pendant le vol »).
// À appeler sous le verrou ; Save à charge de l'appelant.
func (a *API) queueDevicePauseLocked(db *model.DB, router *model.Router) {
	now := time.Now().UTC()
	macs := desiredPauseMacsLocked(db, router.ID, now)
	payload := map[string]any{
		"macs": strings.Join(macs, ";") + ";",
		"sig":  devicePauseSig(macs),
	}
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.RouterID == router.ID && c.Kind == model.CmdDevicePause && c.Status == "queued" {
			c.Payload = payload
			return
		}
	}
	queueCommandLocked(db, router.AccountID, router.ID, model.CmdDevicePause, payload)
}

// ensureDevicePauseLocked — N°101 — convergeur check-in de la pause :
// la signature désirée est recalculée à CHAQUE check-in (une pause qui
// expire change l'ensemble → re-file, la coupure se lève d'elle-même) et
// comparée à celle APPLIQUÉE (Router.PauseSig) ; divergence → device_pause
// en file (idempotent, servie dans CE check-in). HOMENET (pause dîner)
// OU HOTSPOT avec module Cybercafé activé (pause postes N°290) : les autres
// routeurs n'ont ni appareil ni poste en pause — aucun bruit de file.
// À appeler sous le verrou depuis handleAgentCmd.
func (a *API) ensureDevicePauseLocked(db *model.DB, router *model.Router) {
	// N°324 — mono-mode : seuls les routeurs agent de comptes HOTSPOT avec
	// module Cybercafé activé portent des pauses de postes (le foyer est
	// retiré ; normalizeAccountUsage rabat tout compte vers hotspot).
	if router.Mode != "agent" || !cyberEnabledLocked(db, router.AccountID) {
		return
	}
	now := time.Now().UTC()
	sig := devicePauseSig(desiredPauseMacsLocked(db, router.ID, now))
	if router.PauseSig == sig {
		return // convergé (y compris l'ensemble vide : rien à couper)
	}
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.RouterID == router.ID && c.Kind == model.CmdDevicePause && (c.Status == "queued" || c.Status == "sent") {
			if s, _ := c.Payload["sig"].(string); s == sig {
				return // la bonne version est déjà en vol
			}
			break // version périmée en vol : file la fraîche (l'idempotence la fera gagner)
		}
	}
	a.queueDevicePauseLocked(db, router)
}

// ensureHomeDevicesLocked — N°101 — cadenceur de l'inventaire : enfile un
// read_dhcp pour CE routeur si (1) c'est un routeur agent d'un compte
// HOMENET (les parcs hotspot ne paient pas ce cycle — leurs données DHCP
// restent de l'outil F9 à la demande) OU d'un compte HOTSPOT avec le module
// Cybercafé activé (N°290 : la découverte nourrit l'import des postes),
// (2) aucun n'est déjà en file/vol, (3) le dernier rapport appliqué date de
// plus de devicesMinInterval. À appeler sous le verrou depuis handleAgentCmd.
func (a *API) ensureHomeDevicesLocked(db *model.DB, router *model.Router) {
	// N°324 — mono-mode : le cadenceur read_dhcp ne vit plus que pour les
	// comptes HOTSPOT avec module Cybercafé activé (N°290 : la découverte
	// nourrit l'import des postes — l'inventaire foyer est retiré).
	if router.Mode != "agent" || !cyberEnabledLocked(db, router.AccountID) {
		return
	}
	for i := range db.Commands {
		c := &db.Commands[i]
		if c.RouterID == router.ID && c.Kind == model.CmdReadDhcp && (c.Status == "queued" || c.Status == "sent") {
			return // déjà en file ou en vol (clic F9 compris : jamais deux lectures)
		}
	}
	if t, ok := a.devicesDone[router.ID]; ok && time.Since(t) < devicesMinInterval {
		return // pas encore dû
	}
	queueCommandLocked(db, router.AccountID, router.ID, model.CmdReadDhcp, map[string]any{})
}

// ---------------------------------------------------------------------------
// Application du rapport read_dhcp → registre des appareils
// ---------------------------------------------------------------------------

// applyDeviceLeases — N°101 — upsert des bails rapportés dans le registre :
//   - MAC inconnue → création (le nom affecté naît vide : la famille nomme) ;
//   - MAC connue → IP/host-name/statut/bail rafraîchis (host-name vide
//     conservé : certains appareils ne le rapportent qu'une fois) ;
//   - rapport COMPLET (moins de baux que la borne du script) → les appareils
//     du routeur ABSENTS du rapport passent « gone » (bail retiré côté box) —
//     la ligne est conservée : le nom de famille y survit, l'appareil qui
//     revient retrouve son identité au bail suivant.
//
// Renvoie le nombre d'appareils découverts. À appeler sous le verrou ;
// Save à charge de l'appelant.
func (a *API) applyDeviceLeases(db *model.DB, router *model.Router, vals map[string][]string) int {
	raw := ""
	if vs := vals["data"]; len(vs) > 0 {
		raw = vs[0]
	}
	rows := splitAgentList(raw)
	now := model.NowISO()
	seen := map[string]bool{}
	created := 0
	for _, e := range rows {
		if len(e) < 5 {
			continue
		}
		mac := model.NormalizeMAC(e[0])
		if mac == "" {
			continue // rapport corrompu : jamais de ligne fantôme
		}
		seen[mac] = true
		ip := bounded(e[1], 45)
		host := bounded(e[2], 64)
		expires := bounded(e[3], 24)
		status := bounded(e[4], 16)
		idx := -1
		for i := range db.Devices {
			if db.Devices[i].RouterID == router.ID && db.Devices[i].MAC == mac {
				idx = i
				break
			}
		}
		if idx < 0 {
			db.Devices = append(db.Devices, model.Device{
				ID: model.NewID("dev-"), AccountID: router.AccountID, RouterID: router.ID,
				RouterName: router.Name, MAC: mac, Hostname: host, IP: ip, Status: status,
				Expires: expires, LeaseAt: now, CreatedAt: now,
			})
			created++
		} else {
			d := &db.Devices[idx]
			d.RouterName = router.Name
			if ip != "" {
				d.IP = ip
			}
			if host != "" {
				d.Hostname = host
			}
			d.Status = status
			d.Expires = expires
			d.LeaseAt = now
		}
	}
	// Déduction « gone » UNIQUEMENT sur rapport complet (borne F9 = 100) :
	// un rapport tronqué ne badgue jamais (honnêteté, pattern read_state).
	if len(rows) < deviceReadCap {
		for i := range db.Devices {
			d := &db.Devices[i]
			if d.RouterID == router.ID && !seen[d.MAC] && d.Status != model.DeviceLeaseGone {
				d.Status = model.DeviceLeaseGone
			}
		}
	}
	return created
}

// findDeviceScoped — appareil par ID dans le périmètre du compte (404 sinon).
// Sous verrou.
func findDeviceScoped(db *model.DB, id, acc string) int {
	for i := range db.Devices {
		if db.Devices[i].ID == id && db.Devices[i].AccountID == acc {
			return i
		}
	}
	return -1
}

// bounded — trim + borne défensive d'un champ de rapport agent.
func bounded(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		s = s[:n]
	}
	return s
}

// applyDevicePauseResult — N°101 — vérifie et signe le retour « ok » de la
// commande device_pause (vérité routeur : le compte de règles marquées
// IPv4 APRÈS application doit égaler le nombre de MAC du payload) et pose
// Router.PauseSig si la version envoyée est TOUJOURS la version désirée.
// Sous verrou ; l'appelant journalise.
func (a *API) applyDevicePauseResult(db *model.DB, router *model.Router, cmd *model.Command, vals map[string][]string) (applied int) {
	macs := agent.DevicePauseMacsFromPayload(cmd.Payload)
	sentSig := agent.DevicePauseSigFromPayload(cmd.Payload)
	rules := 0
	if vs := vals["rules"]; len(vs) > 0 {
		if n, err := strconv.Atoi(strings.TrimSpace(vs[0])); err == nil && n >= 0 {
			rules = n
		}
	}
	wantSig := devicePauseSig(desiredPauseMacsLocked(db, router.ID, time.Now().UTC()))
	if rules != len(macs) || sentSig == "" || sentSig != wantSig {
		return 0 // compte infidèle ou version périmée : pas de signature, re-file au check-in
	}
	router.PauseSig = sentSig
	return len(macs)
}
