// vpnquota_sweep_test.go — N°311 — tests du balayage du quota mensuel de
// trafic des peers VPN vendus.
//
// Couverture :
//   - parseWgTransferBytes : octets bruts « rx/tx » (sortie wg-peer.sh
//     list), « — » (jamais de transfert), formats unités défensifs, unité
//     inconnue → 0 ;
//   - accumulation par DELTAS, rollover mensuel (le compteur repart à
//     zéro au changement de mois), REBASE au reboot VM (compteur qui
//     recule : jamais de cumul négatif ni de double comptage), peer absent
//     du wg0 = cumul gelé ;
//   - révocation au dépassement : peer actif retiré du registre APRÈS
//     confirmation wg-mini, commande B2C liée annulée, journal du compte ;
//     peer « error » NON révoqué (déjà visible du gérant), quota 0 =
//     illimité (aucune révocation) ;
//   - notification du compte (canal Telegram configuré, exécuteur
//     déterministe goroutine + WaitGroup, consignation NotifLog — pattern
//     handlers_ppp_lifecycle_test.go) ;
//   - wg-mini injoignable : aucun crash, cumul intact (reprise au passage
//     suivant).
//
// AUCUNE connexion réseau réelle : wgMiniListFn / wgMiniRemoveFn /
// deliverNotif / dispatchEmailTask remplacés par des indirections.
package api

import (
	"errors"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/model"
	"mikcloud/hotspot-api/internal/store"
)

// newVpnQuotaSweepTest — API + store JSON éphémère (harnais maison, zéro
// réseau : cf. newTestServerWithStore).
func newVpnQuotaSweepTest(t *testing.T) (*API, *store.Store) {
	t.Helper()
	t.Setenv("DATABASE_URL", "")
	t.Setenv("ADMIN_PASSWORD", "admin-test-1234")
	t.Setenv("ADMIN_USERNAME", "")
	st, err := store.New(t.TempDir())
	if err != nil {
		t.Fatalf("store.New impossible : %v", err)
	}
	return New(st, testJWTSecret), st
}

// overrideWgMini — remplace les indirections wg-mini pour TOUTE la durée du
// test (restaurées par t.Cleanup — les tests du package ne tournent pas en
// parallèle, discipline maison).
func overrideWgMini(t *testing.T, list func() ([]wgMiniPeer, error), remove func(name string) error) *[]string {
	t.Helper()
	oldList, oldRemove := wgMiniListFn, wgMiniRemoveFn
	removed := &[]string{}
	t.Cleanup(func() { wgMiniListFn, wgMiniRemoveFn = oldList, oldRemove })
	wgMiniListFn = list
	if remove != nil {
		wgMiniRemoveFn = remove
	} else {
		wgMiniRemoveFn = func(name string) error {
			*removed = append(*removed, name)
			return nil
		}
	}
	return removed
}

func TestParseWgTransferBytes(t *testing.T) {
	cas := []struct {
		in   string
		want int64
	}{
		{"123456/789", 124245},                // octets bruts (sortie réelle wg-peer.sh list)
		{"5368709120/1073741824", 6442450944}, // 5 GiB / 1 GiB en octets bruts
		{"—", 0},                              // jamais de transfert
		{"-", 0},                              // variante tiret
		{"", 0},                               // vide
		{"1.2 MiB/3.4 MiB", 4823449},          // 1258291 + 3565158 (troncature par côté)
		{"512 KiB/0 B", 512 << 10},
		{"2.5 GiB/2.5 GiB", int64(5.0 * (1 << 30))},
		{"1.0 TiB/0 B", 1 << 40},
		{"3 widgets/0 B", 0}, // unité inconnue → 0 (prudence : rien plutôt qu'un compte faux)
		{"abc", 0},
	}
	for _, c := range cas {
		if got := parseWgTransferBytes(c.in); got != c.want {
			t.Errorf("parseWgTransferBytes(%q) = %d, attendu %d", c.in, got, c.want)
		}
	}
}

func TestVpnQuotaSweepAccumulation(t *testing.T) {
	a, st := newVpnQuotaSweepTest(t)
	month := model.VpnQuotaMonthKey(time.Now())
	gib50 := int64(50) << 30

	st.Lock()
	db := st.Data()
	db.VpnPeers = []model.VpnPeer{
		// Peer 1 : cumul en cours dans le mois courant, base 10 GiB.
		{ID: "vp-a1", AccountID: "acc-a", Name: "vpn-aaaa1111", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 10 << 30, QuotaLast: 10 << 30},
		// Peer 2 : mois ÉCOULÉ (rollover attendu au passage).
		{ID: "vp-a2", AccountID: "acc-a", Name: "vpn-bbbb2222", State: model.VpnStateActive, QuotaMonth: "2000-01", QuotaBytes: 40 << 30, QuotaLast: 40 << 30},
		// Peer 3 : compteur VM PLUS PETIT que la base (reboot VM → rebase).
		{ID: "vp-a3", AccountID: "acc-a", Name: "vpn-cccc3333", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 5 << 30, QuotaLast: 30 << 30},
	}
	st.Save()
	st.Unlock()

	// VM : peer 1 +3 GiB, peer 2 repart de 42 GiB (base 40), peer 3 rebooté à
	// 2 GiB. Peer 4 du registre absent du wg0 (terme B2C en cours).
	vm := []wgMiniPeer{
		{Name: "vpn-aaaa1111", Transfer: formatRawBytes(13 << 30)},
		{Name: "vpn-bbbb2222", Transfer: formatRawBytes(42 << 30)},
		{Name: "vpn-cccc3333", Transfer: formatRawBytes(2 << 30)},
	}
	overrideWgMini(t, func() ([]wgMiniPeer, error) { return vm, nil }, nil)

	a.RunVpnQuotaSweep()

	st.Lock()
	db = st.Data()
	var p1, p2, p3 *model.VpnPeer
	for i := range db.VpnPeers {
		switch db.VpnPeers[i].ID {
		case "vp-a1":
			p1 = &db.VpnPeers[i]
		case "vp-a2":
			p2 = &db.VpnPeers[i]
		case "vp-a3":
			p3 = &db.VpnPeers[i]
		}
	}
	st.Unlock()
	if p1 == nil || p2 == nil || p3 == nil {
		t.Fatalf("peers disparus du registre après un simple passage d'accumulation : %v", db.VpnPeers)
	}
	if p1.QuotaBytes != 13<<30 || p1.QuotaLast != 13<<30 || p1.QuotaMonth != month {
		t.Errorf("peer 1 : delta attendu +3 GiB (13 cumulés), obtenu cumul=%d base=%d mois=%q", p1.QuotaBytes, p1.QuotaLast, p1.QuotaMonth)
	}
	if p2.QuotaMonth != month || p2.QuotaBytes != 2<<30 || p2.QuotaLast != 42<<30 {
		t.Errorf("peer 2 : rollover mensuel attendu (mois courant, cumul 2 GiB), obtenu mois=%q cumul=%d base=%d", p2.QuotaMonth, p2.QuotaBytes, p2.QuotaLast)
	}
	if p3.QuotaBytes != 7<<30 || p3.QuotaLast != 2<<30 {
		t.Errorf("peer 3 : rebase reboot attendu (5 + 2 = 7 GiB, base 2), obtenu cumul=%d base=%d", p3.QuotaBytes, p3.QuotaLast)
	}
	if p1.QuotaBytes > gib50 || p2.QuotaBytes > gib50 || p3.QuotaBytes > gib50 {
		t.Errorf("aucune révocation attendue sous la limite de 50 Go ( défaut), cumuls : %d %d %d", p1.QuotaBytes, p2.QuotaBytes, p3.QuotaBytes)
	}
}

// formatRawBytes — fabrique la sortie « rx/tx » de wg-peer.sh list pour un
// total donné (moitié/moitié : seul le TOTAL compte pour le test).
func formatRawBytes(total int64) string {
	return strconv.FormatInt(total/2, 10) + "/" + strconv.FormatInt(total-total/2, 10)
}

func TestVpnQuotaSweepRevocation(t *testing.T) {
	a, st := newVpnQuotaSweepTest(t)
	month := model.VpnQuotaMonthKey(time.Now())

	st.Lock()
	db := st.Data()
	db.VpnPeers = []model.VpnPeer{
		// vp-r1 : actif, cumul qui FRANCHIT la limite (50 Go défaut) à ce
		// passage → révocation + commande B2C annulée + journal.
		{ID: "vp-r1", AccountID: "acc-r", Name: "vpn-rrrr1111", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 48 << 30, QuotaLast: 48 << 30, Label: "Téléphone Ali"},
		// vp-r2 : dépasse AUSSI la limite mais état « error » → NON révoqué
		// (déjà dans un état visible du gérant — la révocation automatique ne
		// touche que les actifs).
		{ID: "vp-r2", AccountID: "acc-r", Name: "vpn-ssss2222", State: model.VpnStateError, QuotaMonth: month, QuotaBytes: 90 << 30, QuotaLast: 90 << 30},
		// vp-r3 : actif et gourmand mais SOUS la limite (45 Go < 50) → NON
		// révoqué (le garde-fou ne coupe que le dépassement réel).
		{ID: "vp-r3", AccountID: "acc-r", Name: "vpn-tttt3333", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 0, QuotaLast: 0},
	}
	db.PublicVpnOrders = []model.PublicVpnOrder{
		{ID: "po-1", Ref: "MCV-TEST1", Email: "client@fai.ci", Status: model.PublicVpnOrderProvisioned, PeerID: "vp-r1", PeerName: "vpn-rrrr1111"},
		{ID: "po-2", Ref: "MCV-TEST2", Email: "autre@fai.ci", Status: model.PublicVpnOrderProvisioned, PeerID: "vp-autre", PeerName: "vpn-autre"},
	}
	// Quota plateforme : DÉFAUT 50 Go (aucune config posée — la borne
	// constante honnête D-a). Le cas « 0 = illimité » a son test dédié
	// (TestVpnQuotaSweepUnlimited).
	st.Save()
	st.Unlock()

	vm := []wgMiniPeer{
		{Name: "vpn-rrrr1111", Transfer: formatRawBytes(52 << 30)}, // 48 + 4 = 52 GiB > 50
		{Name: "vpn-ssss2222", Transfer: formatRawBytes(91 << 30)},
		{Name: "vpn-tttt3333", Transfer: formatRawBytes(45 << 30)}, // 45 GiB < 50 : sous la limite
	}
	removed := overrideWgMini(t, func() ([]wgMiniPeer, error) { return vm, nil }, nil)

	a.RunVpnQuotaSweep()

	st.Lock()
	db = st.Data()
	var r2, r3 *model.VpnPeer
	r1Found := false
	for i := range db.VpnPeers {
		switch db.VpnPeers[i].ID {
		case "vp-r1":
			r1Found = true
		case "vp-r2":
			r2 = &db.VpnPeers[i]
		case "vp-r3":
			r3 = &db.VpnPeers[i]
		}
	}
	var order1, order2 *model.PublicVpnOrder
	for i := range db.PublicVpnOrders {
		switch db.PublicVpnOrders[i].ID {
		case "po-1":
			order1 = &db.PublicVpnOrders[i]
		case "po-2":
			order2 = &db.PublicVpnOrders[i]
		}
	}
	journal := ""
	for _, act := range db.Activity {
		if act.AccountID == "acc-r" && act.Type == "vpn" && strings.Contains(act.Message, "vpn-rrrr1111") {
			journal = act.Message
		}
	}
	st.Unlock()

	if r1Found {
		t.Error("le peer vp-r1 (actif, 52 Go > 50) doit être retiré du registre après révocation")
	}
	if len(*removed) != 1 || (*removed)[0] != "vpn-rrrr1111" {
		t.Errorf("wg-mini remove attendu exactement pour vpn-rrrr1111, obtenu %v", *removed)
	}
	if r2 == nil || r2.State != model.VpnStateError {
		t.Error("le peer vp-r2 (état error) ne doit PAS être révoqué")
	}
	if r3 == nil || r3.QuotaBytes != 45<<30 {
		t.Errorf("le peer vp-r3 doit rester au registre avec son cumul (45 GiB), obtenu %+v", r3)
	}
	if order1 == nil || order1.Status != model.PublicVpnOrderCancelled || !strings.Contains(order1.ResolvedBy, "quota") {
		t.Errorf("commande B2C liée à vp-r1 : statut cancelled attendu avec mention quota, obtenu %+v", order1)
	}
	if order2 == nil || order2.Status != model.PublicVpnOrderProvisioned {
		t.Errorf("commande B2C d'un autre peer : doit rester provisioned, obtenu %+v", order2)
	}
	if journal == "" || !strings.Contains(journal, "quota mensuel") {
		t.Errorf("journal du compte attendu (révocation + mention quota mensuel), obtenu %q", journal)
	}

	// Dépassement SANS commande liée (gérant) + échec wg-mini : la ligne
	// reste au registre, retentée au passage suivant.
	st.Lock()
	db = st.Data()
	db.VpnPeers = append(db.VpnPeers, model.VpnPeer{
		ID: "vp-r4", AccountID: "acc-r", Name: "vpn-uuuu4444", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 60 << 30, QuotaLast: 60 << 30,
	})
	st.Save()
	st.Unlock()
	vmDown := []wgMiniPeer{{Name: "vpn-uuuu4444", Transfer: formatRawBytes(61 << 30)}}
	overrideWgMini(t, func() ([]wgMiniPeer, error) { return vmDown, nil }, func(name string) error {
		return errors.New("wg-mini injoignable (test)")
	})
	a.RunVpnQuotaSweep()
	st.Lock()
	found := false
	for i := range st.Data().VpnPeers {
		if st.Data().VpnPeers[i].ID == "vp-r4" {
			found = true
		}
	}
	st.Unlock()
	if !found {
		t.Error("échec wg-mini : la ligne vp-r4 doit rester au registre (retentée au passage suivant)")
	}
}

func TestVpnQuotaSweepUnlimited(t *testing.T) {
	a, st := newVpnQuotaSweepTest(t)
	month := model.VpnQuotaMonthKey(time.Now())

	// Quota plateforme 0 = illimité : même 500 Go consommés → aucune
	// révocation (le garde-fou est explicitement désarmé par l'exploitant).
	st.Lock()
	db := st.Data()
	settings := ensureSettings(db, model.AccountMainID)
	zero := 0
	if settings.Platform == nil {
		settings.Platform = &model.PlatformConfig{Name: "MikCloud", RegisterOpen: true}
	}
	settings.Platform.WgVpnMonthlyQuotaGB = &zero
	db.SettingsByAccount[model.AccountMainID] = settings
	db.VpnPeers = []model.VpnPeer{
		{ID: "vp-u1", AccountID: "acc-u", Name: "vpn-uuuu1111", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 400 << 30, QuotaLast: 400 << 30},
	}
	st.Save()
	st.Unlock()

	vm := []wgMiniPeer{{Name: "vpn-uuuu1111", Transfer: formatRawBytes(500 << 30)}}
	removed := overrideWgMini(t, func() ([]wgMiniPeer, error) { return vm, nil }, nil)
	a.RunVpnQuotaSweep()

	st.Lock()
	found := false
	var cumul int64
	for i := range st.Data().VpnPeers {
		if st.Data().VpnPeers[i].ID == "vp-u1" {
			found = true
			cumul = st.Data().VpnPeers[i].QuotaBytes
		}
	}
	st.Unlock()
	if !found {
		t.Fatal("quota illimité (0) : le peer ne doit JAMAIS être révoqué")
	}
	if len(*removed) != 0 {
		t.Errorf("quota illimité (0) : aucun remove attendu, obtenu %v", *removed)
	}
	if cumul != 500<<30 {
		t.Errorf("quota illimité : cumul attendu 500 GiB, obtenu %d", cumul)
	}
}

func TestVpnQuotaSweepNotice(t *testing.T) {
	a, st := newVpnQuotaSweepTest(t)
	month := model.VpnQuotaMonthKey(time.Now())

	// Canal Telegram configuré (exécuteur déterministe — pattern
	// handlers_ppp_lifecycle_test.go) : la révocation notifie le compte.
	st.Lock()
	db := st.Data()
	cfg := store.GetOrCreateNotifSettings(db, "acc-n")
	cfg.Enabled = true
	cfg.TelegramEnabled = true
	cfg.TelegramBotToken = "tok-test"
	cfg.TelegramChatID = "42"
	store.SetNotifSettings(db, cfg)
	db.VpnPeers = []model.VpnPeer{
		{ID: "vp-n1", AccountID: "acc-n", Name: "vpn-nnnn1111", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 49 << 30, QuotaLast: 49 << 30, Label: "Client Nik"},
	}
	st.Save()
	st.Unlock()

	oldDispatch, oldDeliver := dispatchEmailTask, deliverNotif
	t.Cleanup(func() { dispatchEmailTask, deliverNotif = oldDispatch, oldDeliver })
	var wg sync.WaitGroup
	dispatchEmailTask = func(fn func()) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			fn()
		}()
	}
	var mu sync.Mutex
	captured := []string{}
	deliverNotif = func(cfg *model.NotificationSettings, platform *model.NotificationSettings, kind, title, body, onlyChannel string) []model.NotificationLog {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, kind+"|"+body)
		return []model.NotificationLog{{Channel: "telegram", Status: "sent", Kind: kind, Title: title}}
	}

	vm := []wgMiniPeer{{Name: "vpn-nnnn1111", Transfer: formatRawBytes(51 << 30)}}
	overrideWgMini(t, func() ([]wgMiniPeer, error) { return vm, nil }, nil)
	a.RunVpnQuotaSweep()
	wg.Wait()

	mu.Lock()
	snapshot := append([]string(nil), captured...)
	mu.Unlock()
	if len(snapshot) != 1 || !strings.Contains(snapshot[0], "vpn_quota") || !strings.Contains(snapshot[0], "Client Nik") || !strings.Contains(snapshot[0], "51") {
		t.Fatalf("notification attendue exactement une fois (kind vpn_quota, label + cumul dans le corps), obtenu %v", snapshot)
	}
	st.Lock()
	logs := len(st.Data().NotifLog)
	st.Unlock()
	if logs != 1 {
		t.Errorf("NotifLog : 1 entrée attendue (consignation par la goroutine), obtenu %d", logs)
	}
}

func TestVpnQuotaSweepWgMiniDown(t *testing.T) {
	a, st := newVpnQuotaSweepTest(t)
	month := model.VpnQuotaMonthKey(time.Now())

	st.Lock()
	db := st.Data()
	db.VpnPeers = []model.VpnPeer{
		{ID: "vp-d1", AccountID: "acc-d", Name: "vpn-dddd1111", State: model.VpnStateActive, QuotaMonth: month, QuotaBytes: 12 << 30, QuotaLast: 12 << 30},
	}
	st.Save()
	st.Unlock()

	// wg-mini injoignable : passage propre, cumul INTACT (un trou
	// d'échantillon ne compte jamais du trafic fantôme).
	overrideWgMini(t, func() ([]wgMiniPeer, error) { return nil, errors.New("wg-mini injoignable (test)") }, nil)
	a.RunVpnQuotaSweep()

	st.Lock()
	p := model.FindVpnPeerScoped(st.Data(), "vp-d1", "acc-d")
	st.Unlock()
	if p == nil {
		t.Fatal("peer disparu alors que wg-mini est injoignable")
	}
	if p.QuotaBytes != 12<<30 || p.QuotaLast != 12<<30 {
		t.Errorf("cumul intact attendu (12 GiB), obtenu cumul=%d base=%d", p.QuotaBytes, p.QuotaLast)
	}
}
