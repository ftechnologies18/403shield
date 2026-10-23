package api

// publicdns_test.go — N°347 — tests du canal B2C de l'abonnement DNS
// « TOURACO » (vitrine /api/public/dns/* + chaîne GeniusPay + renouvellement
// console + registre plateforme + balayage). Miroir strict de la discipline
// des tests VPN N°301/314 — AUCUNE connexion réseau réelle : stubs +
// indirections.
//
// Couverture :
//   - vitrine : catalogue fermé/ouvert, création de commande (validations,
//     honeypot, doublon pending 409, boutique fermée 403, plafond), statut
//     minimal par référence, récupération self-service (réponse générique) ;
//   - machine à états : markPaid → provision (échéance = paid + mois,
//     e-mail d'activation sans secret), renouvellement (cible étendue au
//     max(now, terme) + mois), dégénérescence honnête en vente (cible morte),
//     annulation idempotente ;
//   - webhook GeniusPay branche MCD- : payment.failed → annulation, montant
//     incohérent 409, succès → provisioned, rejeu idempotent ;
//   - console tunnel : renouvellement 1-clic (200/404 anti-énumération/409
//     cible morte/403 boutique fermée/honeypot), bloc subscription de /me
//     (état + bornes EFFECTIVES + cibles de renouvellement) ;
//   - quotas : 11e profil refusé au gratuit, accepté en TOURACO (25),
//     15 logements abonné vs 5 gratuit ;
//   - console plateforme : file (non-admin 403, pending en tête), resolve
//     markPaid → provisioning auto, resolve cancel ;
//   - balayage : terme → expired (quotas retombent), stale 48 h → cancelled,
//     « paid » non provisionnée → rejeu.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
)

// dnsPubPost — requête publique POST JSON (sans JWT — routes vitrine).
func dnsPubPost(target, body string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// dnsEnableShop — ouvre la vitrine DNS sur le compte principal (la mutation
// passe par ensureSettings : COPIE réécrite dans la map).
func dnsEnableShop(db *model.DB) {
	settings := ensureSettings(db, model.AccountMainID)
	if settings.Platform == nil {
		settings.Platform = &model.PlatformConfig{}
	}
	on := true
	settings.Platform.PublicDnsShop = &on
	db.SettingsByAccount[model.AccountMainID] = settings
}

// dnsSeedClient — client tunnel actif (miroir tunnelSeedClient).
func dnsSeedClient(db *model.DB, id, email string) {
	db.TunnelClients = append(db.TunnelClients, model.TunnelClient{
		ID: id, Email: email, Status: model.TunnelClientActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
}

// dnsSeedOrder — commande DNS minimale (statut/échéance libres).
func dnsSeedOrder(db *model.DB, id, ref, email, status, expiresAt string) *model.PublicDnsOrder {
	db.PublicDnsOrders = append(db.PublicDnsOrders, model.PublicDnsOrder{
		ID: id, Ref: ref, Email: email, PlanID: model.PublicDnsPlanMonthID,
		Months: 1, BaseAmountFcfa: 1000, AmountFcfa: 1000, PayMethod: "manual",
		Status: status, ExpiresAt: expiresAt,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	return &db.PublicDnsOrders[len(db.PublicDnsOrders)-1]
}

// ---------------------------------------------------------------------------
// Vitrine publique
// ---------------------------------------------------------------------------

func TestPublicDnsOffers(t *testing.T) {
	a, st := newTunnelTest(t)

	// Boutique fermée (défaut opt-in strict) : {"enabled": false}, 200.
	rec := httptest.NewRecorder()
	a.handlePublicDnsOffers(rec, httptest.NewRequest(http.MethodGet, "/api/public/dns/offers", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"enabled":false`) {
		t.Fatalf("boutique fermée : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	st.Lock()
	dnsEnableShop(st.Data())
	st.Save()
	st.Unlock()

	rec = httptest.NewRecorder()
	a.handlePublicDnsOffers(rec, httptest.NewRequest(http.MethodGet, "/api/public/dns/offers", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("boutique ouverte : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var offers struct {
		Enabled       bool `json:"enabled"`
		OnlinePayment bool `json:"onlinePayment"`
		Plans         []struct {
			ID       string `json:"id"`
			Label    string `json:"label"`
			BaseFcfa int    `json:"baseFcfa"`
			CardFcfa int    `json:"cardFcfa"`
			WaveFcfa int    `json:"waveFcfa"`
		} `json:"plans"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &offers); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !offers.Enabled || len(offers.Plans) != 2 {
		t.Fatalf("2 formules attendues (mensuel/annuel), obtenu %+v", offers)
	}
	if offers.Plans[0].ID != model.PublicDnsPlanMonthID || offers.Plans[0].BaseFcfa != 1000 {
		t.Fatalf("formule mensuelle inattendue : %+v", offers.Plans[0])
	}
	if !strings.Contains(offers.Plans[0].Label, "TOURACO") {
		t.Fatalf("le libellé porte le nom du service (TOURACO), obtenu %q", offers.Plans[0].Label)
	}
	// Les frais par moyen sont servis (miroir vitrine VPN).
	if offers.Plans[0].CardFcfa <= offers.Plans[0].BaseFcfa || offers.Plans[0].WaveFcfa < offers.Plans[0].BaseFcfa {
		t.Fatalf("montants par moyen inattendus : %+v", offers.Plans[0])
	}
}

func TestPublicDnsOrderCreate(t *testing.T) {
	a, st := newTunnelTest(t)
	// Le test enchaîne des requêtes : limiteurs élargis LOCALEMENT (les
	// bornes production restent 10/40 — routes.go).
	a.dnsOrder = newSignupLimiterLimits(200, 800)

	// Boutique fermée → 403 honnête, aucune ligne.
	rec := httptest.NewRecorder()
	a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order",
		`{"email":"client@example.com","planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "shop_disabled") {
		t.Fatalf("boutique fermée : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	st.Lock()
	dnsEnableShop(st.Data())
	st.Save()
	st.Unlock()

	// Validations : e-mail, formule, moyen, Wave sans téléphone.
	for _, tc := range []struct{ body, attendu string }{
		{`{"email":"pas-un-email","planId":"dns-month","payMethod":"manual"}`, "e-mail"},
		{`{"email":"a@example.com","planId":"inconnu","payMethod":"manual"}`, "Formule"},
		{`{"email":"a@example.com","planId":"dns-month","payMethod":"cheque"}`, "Moyen"},
		{`{"email":"a@example.com","planId":"dns-month","payMethod":"wave"}`, "téléphone"},
	} {
		rec := httptest.NewRecorder()
		a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order", tc.body))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("validation %q : HTTP %d attendu (400) — %s", tc.body, rec.Code, rec.Body.String())
		}
	}

	// Honeypot : succès factice, ZÉRO ligne créée.
	rec = httptest.NewRecorder()
	a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order",
		`{"email":"robot@example.com","planId":"dns-month","payMethod":"manual","website":"spam"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("honeypot : succès factice attendu, HTTP %d", rec.Code)
	}
	st.Lock()
	if n := len(st.Data().PublicDnsOrders); n != 0 {
		t.Fatalf("honeypot : zéro commande attendue, obtenu %d", n)
	}
	st.Unlock()

	// Succès (canal manual — pas de réseau GeniusPay en test) : référence
	// MCD-, pending, montants par moyen.
	rec = httptest.NewRecorder()
	a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order",
		`{"email":"Client@Example.com","planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("création : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref        string `json:"ref"`
		Status     string `json:"status"`
		AmountFcfa int    `json:"amountFcfa"`
		PayMethod  string `json:"payMethod"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !strings.HasPrefix(out.Ref, "MCD-") || out.Status != model.PublicDnsOrderPending || out.AmountFcfa != 1000 {
		t.Fatalf("commande inattendue : %+v", out)
	}

	// E-mail normalisé en minuscules (le droit vit sur l'e-mail).
	st.Lock()
	o := model.FindPublicDnsOrderByRef(st.Data(), out.Ref)
	if o == nil || o.Email != "client@example.com" {
		st.Unlock()
		t.Fatalf("e-mail normalisé attendu, obtenu %+v", o)
	}
	st.Unlock()

	// Doublon pending → 409 clair.
	rec = httptest.NewRecorder()
	a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order",
		`{"email":"client@example.com","planId":"dns-year","payMethod":"manual"}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "order_pending_exists") {
		t.Fatalf("doublon pending : HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Plafond d'ordres actifs : borne produit honnête v1.
	st.Lock()
	db := st.Data()
	if o := model.FindPublicDnsOrderByRef(db, out.Ref); o != nil {
		o.Status = model.PublicDnsOrderCancelled // libère la pending pour isoler le plafond
	}
	for i := 0; i < model.MaxPublicDnsActiveOrders; i++ {
		dnsSeedOrder(db, "fill-"+itoa(i), "MCD-F"+strings.ToUpper(itoa(i))+"0000000"+itoa(i),
			"fill"+itoa(i)+"@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	}
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handlePublicDnsOrderCreate(rec, dnsPubPost("/api/public/dns/order",
		`{"email":"autre@example.com","planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "shop_full") {
		t.Fatalf("plafond : HTTP %d — %s", rec.Code, rec.Body.String())
	}
}

func TestPublicDnsOrderStatusMinimal(t *testing.T) {
	a, st := newTunnelTest(t)
	a.dnsStatus = newSignupLimiterLimits(200, 8000)
	st.Lock()
	dnsSeedOrder(st.Data(), "o1", "MCD-AAAA1111", "a@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()

	// Inconnue → 404.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/public/dns/order/MCD-INCONNU", nil)
	req.SetPathValue("ref", "MCD-INCONNU")
	a.handlePublicDnsOrderStatus(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("référence inconnue : 404 attendu, HTTP %d", rec.Code)
	}

	// Connue : statut MINIMAL — jamais l'e-mail (anti-énumération).
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/public/dns/order/MCD-AAAA1111", nil)
	req.SetPathValue("ref", "MCD-AAAA1111")
	a.handlePublicDnsOrderStatus(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "a@example.com") {
		t.Fatalf("le statut public ne doit JAMAIS porter l'e-mail : %s", rec.Body.String())
	}
	var out struct {
		Ref       string `json:"ref"`
		Status    string `json:"status"`
		PlanLabel string `json:"planLabel"`
		ExpiresAt string `json:"expiresAt"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if out.Ref != "MCD-AAAA1111" || out.Status != model.PublicDnsOrderProvisioned || out.ExpiresAt == "" {
		t.Fatalf("statut inattendu : %+v", out)
	}
	if !strings.Contains(out.PlanLabel, "TOURACO") {
		t.Fatalf("libellé de formule attendu (TOURACO), obtenu %q", out.PlanLabel)
	}
}

func TestPublicDnsRecoverGenerique(t *testing.T) {
	a, st := newTunnelTest(t)
	a.dnsRecover = newSignupLimiterLimits(200, 800)

	// Inconnue OU appariement divergent : réponse GÉNÉRIQUE (200, aucune
	// divulgation d'existence — anti-énumération), aucun envoi.
	var sent []sentEmail
	wg := stubAccountEmailCapture(t, &sent)
	st.Lock()
	enableTunnelEmail(st.Data())
	st.Save()
	st.Unlock()
	rec := httptest.NewRecorder()
	a.handlePublicDnsRecover(rec, dnsPubPost("/api/public/dns/recover",
		`{"email":"a@example.com","ref":"MCD-INCONNU"}`))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Si cette commande existe") {
		t.Fatalf("réponse générique attendue, HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// Succès : commande provisionnée de l'e-mail → re-livraison.
	st.Lock()
	dnsSeedOrder(st.Data(), "o1", "MCD-AAAA1111", "a@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handlePublicDnsRecover(rec, dnsPubPost("/api/public/dns/recover",
		`{"email":"A@Example.com","ref":"MCD-AAAA1111"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("recover : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	wg.Wait()
	if len(sent) == 0 {
		t.Fatal("l'e-mail d'activation doit être re-livré")
	}
	if !strings.Contains(sent[0].title, "TOURACO") {
		t.Fatalf("titre d'activation inattendu : %q", sent[0].title)
	}

	// Relais absent : erreur HONNÊTE (jamais un faux « envoyé »).
	st.Lock()
	delete(st.Data().NotifSettings, model.AccountMainID)
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handlePublicDnsRecover(rec, dnsPubPost("/api/public/dns/recover",
		`{"email":"a@example.com","ref":"MCD-AAAA1111"}`))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "email_unavailable") {
		t.Fatalf("relais absent : 503 email_unavailable attendu, HTTP %d — %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Machine à états : provision / renewal / cancel
// ---------------------------------------------------------------------------

func TestPublicDnsProvisioningEnvoieActivation(t *testing.T) {
	a, st := newTunnelTest(t)
	var sent []sentEmail
	wg := stubAccountEmailCapture(t, &sent)
	st.Lock()
	db := st.Data()
	enableTunnelEmail(db)
	dnsSeedOrder(db, "o1", "MCD-AAAA1111", "abo@example.com", model.PublicDnsOrderPending, "")
	st.Save()
	st.Unlock()

	if !a.markPublicDnsOrderPaid("o1", "gwx-1", "geniuspay", "test") {
		t.Fatal("markPaid attendu true")
	}
	// Rejeu markPaid : no-op (plus pending).
	if a.markPublicDnsOrderPaid("o1", "gwx-1", "geniuspay", "test") {
		t.Fatal("markPaid rejoué doit être false (idempotent)")
	}
	final, err := a.provisionPublicDnsOrder("o1")
	if err != nil {
		t.Fatalf("provision : %v", err)
	}
	if final.Status != model.PublicDnsOrderProvisioned || final.ExpiresAt == "" {
		t.Fatalf("commande provisionnée attendue : %+v", final)
	}
	// L'échéance = paid + 1 mois.
	st.Lock()
	paid := st.Data().PublicDnsOrders[0].PaidAt
	want := model.AddMonthsISO(paid, 1)
	st.Unlock()
	if final.ExpiresAt != want {
		t.Fatalf("échéance attendue %s (paid+mois), obtenue %s", want, final.ExpiresAt)
	}
	// Provisioning rejoué : no-op (déjà provisionnée).
	if _, err := a.provisionPublicDnsOrder("o1"); err != nil {
		t.Fatalf("provision rejoué : no-op attendu, obtenu %v", err)
	}

	// L'e-mail d'activation part SANS secret, AVEC le nom du service.
	wg.Wait()
	if len(sent) == 0 {
		t.Fatal("e-mail d'activation attendu")
	}
	body := sent[0].body
	if !strings.Contains(body, "TOURACO") {
		t.Fatalf("l'activation porte le nom du service (TOURACO) : %q", body)
	}
	if strings.Contains(body, "[Interface]") || strings.Contains(body, "PrivateKey") {
		t.Fatalf("aucune conf ne doit apparaître dans l'activation (le produit est un DROIT) : %q", body)
	}
	if sent[0].to != "abo@example.com" {
		t.Fatalf("destinataire inattendu : %q", sent[0].to)
	}
}

func TestPublicDnsRenewalProvisioning(t *testing.T) {
	a, st := newTunnelTest(t)
	var sent []sentEmail
	wg := stubAccountEmailCapture(t, &sent)
	st.Lock()
	db := st.Data()
	enableTunnelEmail(db)
	// Cible vivante couverte 10 jours de plus ; la renewal est PAYÉE.
	dnsSeedOrder(db, "t1", "MCD-TARGET01", "abo@example.com", model.PublicDnsOrderProvisioned,
		time.Now().UTC().AddDate(0, 0, 10).Format(time.RFC3339))
	dnsSeedOrder(db, "r1", "MCD-RENEW001", "abo@example.com", model.PublicDnsOrderPaid, "")
	db.PublicDnsOrders[1].Kind = model.PublicDnsKindRenewal
	db.PublicDnsOrders[1].RenewTargetRef = "MCD-TARGET01"
	db.PublicDnsOrders[1].Months = 1
	db.PublicDnsOrders[1].PaidAt = model.NowISO()
	// L'échéance ORIGINALE de la cible — capturée AVANT le provisioning
	// (l'extension l'écrase, l'assertion la recalculerait sinon deux fois).
	originale := db.PublicDnsOrders[0].ExpiresAt
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicDnsOrder("r1"); err != nil {
		t.Fatalf("provision renewal : %v", err)
	}
	st.Lock()
	target := model.FindPublicDnsOrderByRef(st.Data(), "MCD-TARGET01")
	renewal := model.FindPublicDnsOrderByRef(st.Data(), "MCD-RENEW001")
	st.Unlock()
	// L'échéance étendue vit sur la CIBLE : max(terme, maintenant) + 1 mois.
	want := model.ExtendPublicDnsExpiry(originale, model.NowISO(), 1)
	if target.ExpiresAt != want {
		t.Fatalf("cible étendue attendue à %s, obtenue %s", want, target.ExpiresAt)
	}
	if renewal.Status != model.PublicDnsOrderProvisioned || renewal.ExpiresAt != want {
		t.Fatalf("renewal provisionnée en miroir de la cible : %+v", renewal)
	}
	// Confirmation envoyée (kind dns_renew — sans conf).
	wg.Wait()
	found := false
	for _, m := range sent {
		if strings.Contains(m.title, "renouvelé") {
			found = true
		}
	}
	if !found {
		t.Fatalf("confirmation de renouvellement attendue : %d message(s)", len(sent))
	}
}

func TestPublicDnsRenewalDegradesToSale(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	// Cible MORTE (expirée entre la commande et le paiement).
	dnsSeedOrder(db, "t1", "MCD-TARGET01", "abo@example.com", model.PublicDnsOrderExpired,
		time.Now().UTC().AddDate(0, 0, -1).Format(time.RFC3339))
	dnsSeedOrder(db, "r1", "MCD-RENEW001", "abo@example.com", model.PublicDnsOrderPaid, "")
	db.PublicDnsOrders[1].Kind = model.PublicDnsKindRenewal
	db.PublicDnsOrders[1].RenewTargetRef = "MCD-TARGET01"
	db.PublicDnsOrders[1].Months = 1
	db.PublicDnsOrders[1].PaidAt = model.NowISO()
	st.Save()
	st.Unlock()

	if _, err := a.provisionPublicDnsOrder("r1"); err != nil {
		t.Fatalf("provision : %v", err)
	}
	st.Lock()
	renewal := model.FindPublicDnsOrderByRef(st.Data(), "MCD-RENEW001")
	target := model.FindPublicDnsOrderByRef(st.Data(), "MCD-TARGET01")
	st.Unlock()
	if renewal.Kind != model.PublicDnsKindSale || renewal.RenewTargetRef != "" {
		t.Fatalf("dégénérescence honnête en vente attendue : %+v", renewal)
	}
	if renewal.Status != model.PublicDnsOrderProvisioned || renewal.ExpiresAt == "" {
		t.Fatalf("un NOUVEAU droit doit être posé depuis le paiement : %+v", renewal)
	}
	if target.ExpiresAt == renewal.ExpiresAt {
		t.Fatal("la cible morte ne doit PAS être étendue")
	}
}

func TestPublicDnsCancel(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	dnsSeedOrder(db, "o1", "MCD-AAAA1111", "a@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()

	if err := a.cancelPublicDnsOrder("o1", "test", "junit"); err != nil {
		t.Fatalf("cancel : %v", err)
	}
	// Idempotent : un rejeu ne fait pas d'erreur.
	if err := a.cancelPublicDnsOrder("o1", "test", "junit"); err != nil {
		t.Fatalf("cancel rejoué : no-op attendu, obtenu %v", err)
	}
	st.Lock()
	o := model.FindPublicDnsOrderByRef(st.Data(), "MCD-AAAA1111")
	st.Unlock()
	if o.Status != model.PublicDnsOrderCancelled {
		t.Fatalf("annulée attendue, obtenu %s", o.Status)
	}
	// Le droit a cessé : les quotas retombent au gratuit.
	if q := model.DnsQuotasForEmail(st.Data(), "a@example.com"); q.MaxProfiles != 10 {
		t.Fatalf("après annulation : tier gratuit attendu, obtenu %+v", q)
	}
}

// ---------------------------------------------------------------------------
// Webhook GeniusPay — branche MCD-
// ---------------------------------------------------------------------------

func TestGeniusPayWebhookDnsOrder(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	dnsSeedOrder(db, "o1", "MCD-AAAA1111", "a@example.com", model.PublicDnsOrderPending, "")
	st.Save()
	st.Unlock()

	// Échec de paiement → annulation.
	rec := httptest.NewRecorder()
	a.handleGeniusPayWebhookDnsOrder(rec, "payment.failed", "MCD-AAAA1111", "gwx-1", 0)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), model.PublicDnsOrderCancelled) {
		t.Fatalf("payment.failed : annulation attendue — %s", rec.Body.String())
	}

	// Nouvelle commande : montant incohérent → 409 (le webhook n'encaisse
	// pas n'importe quoi).
	st.Lock()
	dnsSeedOrder(st.Data(), "o2", "MCD-BBBB2222", "b@example.com", model.PublicDnsOrderPending, "")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleGeniusPayWebhookDnsOrder(rec, "payment.success", "MCD-BBBB2222", "gwx-2", 4242)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "amount_mismatch") {
		t.Fatalf("montant incohérent : 409 attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Succès : paid → provisioned dans la MÊME requête (droit immédiat).
	rec = httptest.NewRecorder()
	a.handleGeniusPayWebhookDnsOrder(rec, "payment.success", "MCD-BBBB2222", "gwx-2", 1000)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), model.PublicDnsOrderProvisioned) {
		t.Fatalf("payment.success : provisioned attendu — %s", rec.Body.String())
	}

	// Rejeu idempotent : accusé OK, aucun double droit.
	rec = httptest.NewRecorder()
	a.handleGeniusPayWebhookDnsOrder(rec, "payment.success", "MCD-BBBB2222", "gwx-2", 1000)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "idempotent") {
		t.Fatalf("rejeu : accusé idempotent attendu — %s", rec.Body.String())
	}

	// Référence inconnue → 404.
	rec = httptest.NewRecorder()
	a.handleGeniusPayWebhookDnsOrder(rec, "payment.success", "MCD-INCONNU", "", 1000)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("référence inconnue : 404 attendu, HTTP %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Console tunnel : renouvellement 1-clic + bloc subscription de /me
// ---------------------------------------------------------------------------

func TestTunnelDnsRenew(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(200, 800)
	st.Lock()
	db := st.Data()
	dnsSeedClient(db, "tc-1", "ali@example.com")
	dnsSeedOrder(db, "o1", "MCD-AAAA1111", "Ali@Example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	dnsEnableShop(db)
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// 1. Succès (canal manual — pas de réseau en test).
	rec := httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-AAAA1111/renew", claims,
		`{"planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusOK {
		t.Fatalf("renew : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref    string `json:"ref"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	st.Lock()
	created := model.FindPublicDnsOrderByRef(st.Data(), out.Ref)
	if created == nil || created.Kind != model.PublicDnsKindRenewal || created.RenewTargetRef != "MCD-AAAA1111" {
		st.Unlock()
		t.Fatalf("commande renewal inattendue : %+v", created)
	}
	st.Unlock()

	// 2. Anti-énumération : e-mail divergent ≡ référence inconnue → 404.
	claimsAutre := &auth.Claims{Sub: "tc-1", Role: "tunnel"}
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-AAAA1111/renew", claimsAutre,
		`{"planId":"dns-month","payMethod":"manual"}`))
	// (même client — le cas divergent réel utilise une commande d'autrui)
	st.Lock()
	dnsSeedOrder(st.Data(), "o2", "MCD-CCCC3333", "autre@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-CCCC3333/renew", claims,
		`{"planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("commande d'autrui : 404 attendu (anti-énumération), HTTP %d — %s", rec.Code, rec.Body.String())
	}

	// 3. Cible non active → 409 clair.
	st.Lock()
	if o := model.FindPublicDnsOrderByRef(st.Data(), "MCD-AAAA1111"); o != nil {
		o.Status = model.PublicDnsOrderExpired
	}
	// libère la pending créée en 1 pour isoler le cas
	if o := model.FindPublicDnsOrderByRef(st.Data(), out.Ref); o != nil {
		o.Status = model.PublicDnsOrderCancelled
	}
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-AAAA1111/renew", claims,
		`{"planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "target_not_active") {
		t.Fatalf("cible morte : 409 target_not_active attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// 4. Boutique fermée → 403 (le renouvellement suit l'ouverture) — sur
	// une cible VIVANTE du client (les gardes antérieures — 404/409 —
	// passent AVANT le contrôle de boutique).
	st.Lock()
	dnsSeedOrder(st.Data(), "o3", "MCD-DDDD4444", "ali@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	settings := ensureSettings(st.Data(), model.AccountMainID)
	off := false
	settings.Platform.PublicDnsShop = &off
	st.Data().SettingsByAccount[model.AccountMainID] = settings
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-DDDD4444/renew", claims,
		`{"planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "shop_disabled") {
		t.Fatalf("boutique fermée : 403 attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// 5. Honeypot : succès factice, zéro ligne.
	st.Lock()
	dnsEnableShop(st.Data())
	st.Save()
	st.Unlock()
	before := len(st.Data().PublicDnsOrders)
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-CCCC3333/renew", claims,
		`{"planId":"dns-month","payMethod":"manual","website":"spam"}`))
	if rec.Code != http.StatusOK || len(st.Data().PublicDnsOrders) != before {
		t.Fatalf("honeypot : succès factice sans création attendu — HTTP %d lignes %d→%d",
			rec.Code, before, len(st.Data().PublicDnsOrders))
	}

	// 6. Rôle non-tunnel → 403.
	rec = httptest.NewRecorder()
	a.handleTunnelDnsRenew(rec, tunnelAuthReq(http.MethodPost, "/api/tunnel/dns/orders/MCD-CCCC3333/renew",
		&auth.Claims{Sub: "tc-1", Role: "owner"}, `{"planId":"dns-month","payMethod":"manual"}`))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("rôle non-tunnel : 403 attendu, HTTP %d", rec.Code)
	}
}

func TestDnsShieldMeSubscription(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	dnsSeedClient(db, "tc-1", "ali@example.com")
	dnsSeedOrder(db, "o1", "MCD-AAAA1111", "Ali@Example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()

	rec := httptest.NewRecorder()
	a.handleDnsShieldMe(rec, tunnelAuthReq(http.MethodGet, "/api/dnsshield/me", &auth.Claims{Sub: "tc-1", Role: "tunnel"}, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("/me : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Subscription struct {
			Active    bool   `json:"active"`
			ExpiresAt string `json:"expiresAt"`
			Orders    []struct {
				Ref       string `json:"ref"`
				PlanLabel string `json:"planLabel"`
			} `json:"orders"`
		} `json:"subscription"`
		Limits struct {
			MaxProfiles int `json:"maxProfiles"`
			MaxRules    int `json:"maxRules"`
		} `json:"limits"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if !out.Subscription.Active || out.Subscription.ExpiresAt != "2999-01-01T00:00:00Z" {
		t.Fatalf("abonnement attendu actif jusqu'en 2999 : %+v", out.Subscription)
	}
	if len(out.Subscription.Orders) != 1 || out.Subscription.Orders[0].Ref != "MCD-AAAA1111" {
		t.Fatalf("cible de renouvellement attendue : %+v", out.Subscription.Orders)
	}
	if !strings.Contains(out.Subscription.Orders[0].PlanLabel, "TOURACO") {
		t.Fatalf("libellé de formule attendu : %+v", out.Subscription.Orders[0])
	}
	// Bornes EFFECTIVES : abonné → 25 profils / 600 règles.
	if out.Limits.MaxProfiles != 25 || out.Limits.MaxRules != 600 {
		t.Fatalf("bornes TOURACO attendues (25/600), obtenu %+v", out.Limits)
	}
}

func TestDnsQuotaEnforcementProfils(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(500, 2000)
	st.Lock()
	db := st.Data()
	dnsSeedClient(db, "tc-1", "ali@example.com")
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// Tier gratuit : le 11e profil est refusé, la limite annoncée est 10.
	for i := 0; i < 10; i++ {
		rec := httptest.NewRecorder()
		a.handleDnsShieldProfileCreate(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/profiles", claims,
			`{"name":"P`+itoa(i)+`","level":"threats"}`))
		if rec.Code != http.StatusCreated {
			t.Fatalf("profil gratuit %d : HTTP %d — %s", i, rec.Code, rec.Body.String())
		}
	}
	rec := httptest.NewRecorder()
	a.handleDnsShieldProfileCreate(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/profiles", claims,
		`{"name":"Onzieme","level":"threats"}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "10 profils") {
		t.Fatalf("11e profil gratuit : 409 « 10 profils » attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Abonnement TOURACO : la création reprend jusqu'à 25.
	st.Lock()
	dnsSeedOrder(st.Data(), "o1", "MCD-AAAA1111", "ali@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	for i := 10; i < 25; i++ {
		rec := httptest.NewRecorder()
		a.handleDnsShieldProfileCreate(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/profiles", claims,
			`{"name":"P`+itoa(i)+`","level":"threats"}`))
		if rec.Code != http.StatusCreated {
			t.Fatalf("profil TOURACO %d : HTTP %d — %s", i, rec.Code, rec.Body.String())
		}
	}
	rec = httptest.NewRecorder()
	a.handleDnsShieldProfileCreate(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/profiles", claims,
		`{"name":"VingtSixieme","level":"threats"}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "25 profils") {
		t.Fatalf("26e profil TOURACO : 409 « 25 profils » attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Listes de règles : 250 domaines refusés au gratuit, acceptés en
	// TOURACO (borne 600) — via la MISE À JOUR d'un profil existant (la
	// création est déjà au plafond de profils ci-dessus). Retombée au
	// gratuit d'abord : le droit o1 est échué.
	st.Lock()
	if o := model.FindPublicDnsOrderByRef(st.Data(), "MCD-AAAA1111"); o != nil {
		o.Status = model.PublicDnsOrderExpired
	}
	st.Data().DnsProfiles = append(st.Data().DnsProfiles, model.DnsProfile{
		ID: "dp-rules", PublicID: "pub-rules", OwnerEmail: "ali@example.com",
		Name: "Listes", Level: "threats", Status: model.DnsProfileActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()
	domains := make([]string, 250)
	for i := range domains {
		domains[i] = "s" + itoa(i) + ".example"
	}
	rulesReq := func() *http.Request {
		req := tunnelAuthReq(http.MethodPut, "/api/dnsshield/profiles/dp-rules", claims,
			`{"name":"Listes","level":"threats","blockRules":"`+strings.Join(domains, "\\n")+`"}`)
		req.SetPathValue("id", "dp-rules")
		return req
	}
	rec = httptest.NewRecorder()
	a.handleDnsShieldProfileUpdate(rec, rulesReq())
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "200 max") {
		t.Fatalf("250 règles au gratuit : 400 « 200 max » attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}
	st.Lock()
	dnsSeedOrder(st.Data(), "o2", "MCD-BBBB2222", "ali@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleDnsShieldProfileUpdate(rec, rulesReq())
	if rec.Code != http.StatusOK {
		t.Fatalf("250 règles en TOURACO : mise à jour attendue — HTTP %d %s", rec.Code, rec.Body.String())
	}
}

func TestDnsQuotaEnforcementLogements(t *testing.T) {
	a, st := newTunnelTest(t)
	a.tunnelAction = newSignupLimiterLimits(500, 2000)
	st.Lock()
	db := st.Data()
	dnsSeedClient(db, "tc-1", "ali@example.com")
	db.DnsProfiles = append(db.DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "pub-1", OwnerEmail: "ali@example.com",
		Name: "Maison", Level: "threats", Status: model.DnsProfileActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	st.Save()
	st.Unlock()
	claims := &auth.Claims{Sub: "tc-1", Role: "tunnel"}

	// Tier gratuit : le 6e logement est refusé (5 max).
	for i := 0; i < 5; i++ {
		rec := httptest.NewRecorder()
		a.handleDnsHomeClaim(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/home", claims,
			`{"profileId":"dp-1","label":"M`+itoa(i)+`","ip":"203.0.113.`+itoa(10+i)+`"}`))
		if rec.Code != http.StatusCreated {
			t.Fatalf("logement gratuit %d : HTTP %d — %s", i, rec.Code, rec.Body.String())
		}
	}
	rec := httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/home", claims,
		`{"profileId":"dp-1","label":"Sixieme","ip":"203.0.113.99"}`))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "5 logements") {
		t.Fatalf("6e logement gratuit : 409 « 5 logements » attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Abonné : la borne passe à 15 (domicile + bureau + maison de famille…).
	st.Lock()
	dnsSeedOrder(st.Data(), "o1", "MCD-AAAA1111", "ali@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	a.handleDnsHomeClaim(rec, tunnelAuthReq(http.MethodPost, "/api/dnsshield/home", claims,
		`{"profileId":"dp-1","label":"Sixieme","ip":"203.0.113.99"}`))
	if rec.Code != http.StatusCreated {
		t.Fatalf("6e logement abonné : création attendue — HTTP %d %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Console plateforme : file des commandes + resolve
// ---------------------------------------------------------------------------

func TestPlatformDnsOrders(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	dnsSeedOrder(db, "o-old", "MCD-OLD00001", "vieux@example.com", model.PublicDnsOrderExpired, "2000-01-01T00:00:00Z")
	dnsSeedOrder(db, "o-pend", "MCD-PEND0001", "buyer@example.com", model.PublicDnsOrderPending, "")
	st.Save()
	st.Unlock()

	// Non-admin → 403.
	rec := httptest.NewRecorder()
	a.handlePlatformDnsOrders(rec, httptest.NewRequest(http.MethodGet, "/api/admin/dns/orders", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin : 403 attendu, HTTP %d", rec.Code)
	}

	// Admin : la PENDING part en tête (le travail de la plateforme).
	adminReq := func(method, target, body string) *http.Request {
		req := dnsPubPost(target, body)
		if body == "" {
			req = httptest.NewRequest(method, target, nil)
		}
		return req.WithContext(withClaims(req.Context(), &auth.Claims{Sub: "admin", Role: model.RolePlatformAdmin}))
	}
	rec = httptest.NewRecorder()
	a.handlePlatformDnsOrders(rec, adminReq(http.MethodGet, "/api/admin/dns/orders", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("file admin : HTTP %d — %s", rec.Code, rec.Body.String())
	}
	var list struct {
		Orders []model.PublicDnsOrder `json:"orders"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("réponse illisible : %v", err)
	}
	if len(list.Orders) != 2 || list.Orders[0].Ref != "MCD-PEND0001" {
		t.Fatalf("pending en tête attendue : %+v", list.Orders)
	}

	// Resolve markPaid (canal manual) → provisioning AUTO, échéance posée.
	rec = httptest.NewRecorder()
	req := adminReq(http.MethodPost, "/api/admin/dns/orders/o-pend/resolve", `{"action":"markPaid"}`)
	req.SetPathValue("id", "o-pend")
	a.handlePlatformDnsOrderResolve(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "provisioned") {
		t.Fatalf("markPaid : provisioning auto attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Resolve cancel → annulation, idempotent.
	st.Lock()
	dnsSeedOrder(st.Data(), "o2", "MCD-AAAA2222", "b@example.com", model.PublicDnsOrderProvisioned, "2999-01-01T00:00:00Z")
	st.Save()
	st.Unlock()
	rec = httptest.NewRecorder()
	req = adminReq(http.MethodPost, "/api/admin/dns/orders/o2/resolve", `{"action":"cancel"}`)
	req.SetPathValue("id", "o2")
	a.handlePlatformDnsOrderResolve(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "droit retiré") {
		t.Fatalf("cancel : droit retiré attendu — HTTP %d %s", rec.Code, rec.Body.String())
	}

	// Action inconnue → 400.
	rec = httptest.NewRecorder()
	req = adminReq(http.MethodPost, "/api/admin/dns/orders/o-old/resolve", `{"action":"rever"}`)
	req.SetPathValue("id", "o-old")
	a.handlePlatformDnsOrderResolve(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("action inconnue : 400 attendu, HTTP %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Balayage horaire
// ---------------------------------------------------------------------------

func TestPublicDnsSweep(t *testing.T) {
	a, st := newTunnelTest(t)
	st.Lock()
	db := st.Data()
	// ① provisionnée échue → expired (le droit cesse, rien n'est supprimé).
	dnsSeedOrder(db, "o-exp", "MCD-EXPIRE01", "abo@example.com", model.PublicDnsOrderProvisioned,
		time.Now().UTC().AddDate(0, 0, -1).Format(time.RFC3339))
	db.DnsProfiles = append(db.DnsProfiles, model.DnsProfile{
		ID: "dp-1", PublicID: "pub-1", OwnerEmail: "abo@example.com",
		Name: "Maison", Level: "threats", Status: model.DnsProfileActive,
		CreatedAt: model.NowISO(), UpdatedAt: model.NowISO(),
	})
	// ② pending STALE (créée il y a plus de 48 h) → cancelled.
	dnsSeedOrder(db, "o-stale", "MCD-STALE001", "stale@example.com", model.PublicDnsOrderPending, "")
	db.PublicDnsOrders[len(db.PublicDnsOrders)-1].CreatedAt = time.Now().UTC().Add(-49 * time.Hour).Format(time.RFC3339)
	// ③ paid non provisionnée (échec au moment du paiement) → REJOUÉE.
	paid := dnsSeedOrder(db, "o-paid", "MCD-PAID0001", "paid@example.com", model.PublicDnsOrderPaid, "")
	paid.PaidAt = model.NowISO()
	// ④ pending FRAÎCHE : intacte.
	dnsSeedOrder(db, "o-fresh", "MCD-FRESH001", "fresh@example.com", model.PublicDnsOrderPending, "")
	st.Save()
	st.Unlock()

	a.RunPublicDnsSweep()

	st.Lock()
	db = st.Data()
	if o := model.FindPublicDnsOrderByID(db, "o-exp"); o.Status != model.PublicDnsOrderExpired {
		t.Fatalf("① terme : expired attendu, obtenu %s", o.Status)
	}
	if o := model.FindPublicDnsOrderByID(db, "o-stale"); o.Status != model.PublicDnsOrderCancelled {
		t.Fatalf("② stale : cancelled attendu, obtenu %s", o.Status)
	}
	if o := model.FindPublicDnsOrderByID(db, "o-paid"); o.Status != model.PublicDnsOrderProvisioned {
		t.Fatalf("③ retry : provisioned attendu (la promesse « activation auto » ne se perd jamais), obtenu %s", o.Status)
	}
	if o := model.FindPublicDnsOrderByID(db, "o-fresh"); o.Status != model.PublicDnsOrderPending {
		t.Fatalf("④ pending fraîche : intacte attendue, obtenue %s", o.Status)
	}
	// Le profil de l'abonné expiré reste SERVI (rien n'est supprimé).
	if len(db.DnsProfiles) != 1 || db.DnsProfiles[0].ID != "dp-1" {
		t.Fatalf("le profil doit rester après terme : %+v", db.DnsProfiles)
	}
	// Et les quotas ont retombé au gratuit.
	if q := model.DnsQuotasForEmail(db, "abo@example.com"); q.MaxProfiles != 10 {
		t.Fatalf("après terme : tier gratuit attendu, obtenu %+v", q)
	}
	st.Unlock()
}

// ---------------------------------------------------------------------------
// Routes : auth (bout en bout sur le mux réel — la vitrine est publique,
// la console et le registre sont gardés)
// ---------------------------------------------------------------------------

func TestPublicDnsRoutesAuth(t *testing.T) {
	a, _ := newTunnelTest(t)
	handler := a.Handler()

	// Vitrine PUBLIQUE : pas de JWT (le middleware whitelist le préfixe).
	for _, target := range []string{
		"/api/public/dns/offers",
		"/api/public/dns/order/MCD-TEST0001",
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
		if rec.Code == http.StatusUnauthorized {
			t.Fatalf("%s : la vitrine ne doit pas exiger de JWT — %d", target, rec.Code)
		}
	}

	// Console tunnel + registre plateforme : JWT exigé.
	for _, target := range []struct{ method, path string }{
		{http.MethodPost, "/api/tunnel/dns/orders/MCD-TEST0001/renew"},
		{http.MethodGet, "/api/admin/dns/orders"},
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(target.method, target.path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s : JWT attendu — HTTP %d", target.path, rec.Code)
		}
	}
}
