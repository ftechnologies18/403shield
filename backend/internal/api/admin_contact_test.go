package api

import (
	"net/http"
	"strings"

	"mikcloud/hotspot-api/internal/model"
	"testing"
)

// TestAdminAccountContact — PUT /api/admin/accounts/{id}/contact (N°305) :
// correction valide (fiche mise à jour, trace d'activité), validations 400
// (e-mail mal formé, WhatsApp hors bornes, contact vide), dédoublonnage S5
// (409 e-mail pris / 409 WhatsApp pris — l'anti-fermage n'est pas contourné),
// compte inconnu, non-admin refusé, idempotence (re-PUT identique + exclusion
// de soi du dédoublonnage).
func TestAdminAccountContact(t *testing.T) {
	ts := newTestServer(t)
	adminToken := adminLogin(t, ts)
	accID, ownerToken := createAdminAccount(t, ts, adminToken, "contact-correction", model.AccountUsageHotspot)
	otherID, _ := createAdminAccount(t, ts, adminToken, "contact-autre", model.AccountUsageHotspot)

	// Non-admin (owner du compte) → 403.
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", ownerToken,
		map[string]string{"email": "detourne@example.ci"}); status != http.StatusForbidden {
		t.Fatalf("correction par un client : statut %d, attendu 403", status)
	}
	// Compte inconnu → 404.
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/acc-fantome/contact", adminToken,
		map[string]string{"email": "x@example.ci"}); status != http.StatusNotFound {
		t.Fatalf("compte inconnu : statut %d, attendu 404", status)
	}
	// E-mail mal formé → 400.
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": "pas-un-email"}); status != http.StatusBadRequest {
		t.Fatalf("e-mail invalide : statut %d, attendu 400", status)
	}
	// WhatsApp hors bornes → 400.
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": "corrige@example.ci", "phone": "123"}); status != http.StatusBadRequest {
		t.Fatalf("WhatsApp trop court : statut %d, attendu 400", status)
	}
	// Contact vide (ni e-mail ni WhatsApp) → 400 : annonces, récupération et
	// rappels perdraient toute destination.
	if status, _ := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": "", "phone": ""}); status != http.StatusBadRequest {
		t.Fatalf("contact vide : statut %d, attendu 400", status)
	}

	// Dédoublonnage S5 — lire le contact du second compte via sa fiche.
	status, out := doJSON(t, ts, "GET", "/api/admin/accounts/"+otherID, adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("fiche du second compte : statut %d", status)
	}
	contact, _ := out["contact"].(map[string]any)
	if contact == nil {
		t.Fatalf("la fiche doit exposer le contact (N°305) : %v", out)
	}
	otherEmail, _ := contact["email"].(string)
	otherPhone, _ := contact["phone"].(string)
	if otherEmail == "" || otherPhone == "" {
		t.Fatalf("second compte sans contact complet : email=%q phone=%q", otherEmail, otherPhone)
	}
	// L'e-mail du second compte → 409 email_taken.
	if status, out := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": otherEmail, "phone": "0707070707"}); status != http.StatusConflict {
		t.Fatalf("e-mail déjà pris : statut %d, corps %v", status, out)
	}
	// Le WhatsApp du second compte → 409 phone_taken.
	if status, out := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": "corrige@example.ci", "phone": otherPhone}); status != http.StatusConflict {
		t.Fatalf("WhatsApp déjà pris : statut %d, corps %v", status, out)
	}

	// Correction valide → 200, fiche à jour (e-mail, WhatsApp, pays, ville).
	const newEmail = "nouveau@example.ci"
	const newPhone = "0102030405"
	if status, out := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": newEmail, "phone": newPhone, "country": "sn", "city": "Dakar"}); status != http.StatusOK {
		t.Fatalf("correction valide : statut %d, corps %v", status, out)
	}
	status, out = doJSON(t, ts, "GET", "/api/admin/accounts/"+accID, adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("fiche après correction : statut %d", status)
	}
	contact, _ = out["contact"].(map[string]any)
	if contact["email"] != newEmail || contact["phone"] != newPhone || contact["country"] != "sn" || contact["city"] != "Dakar" {
		t.Fatalf("contact non répercuté : %v", contact)
	}

	// Idempotence + exclusion de soi : re-PUT avec SES PROPRES valeurs → 200
	// (le dédoublonnage ne doit pas se déclencher contre le compte modifié).
	if status, out := doJSON(t, ts, "PUT", "/api/admin/accounts/"+accID+"/contact", adminToken,
		map[string]string{"email": newEmail, "phone": newPhone, "country": "sn", "city": "Dakar"}); status != http.StatusOK {
		t.Fatalf("re-PUT idempotent (soi exclu du dédoublonnage) : statut %d, corps %v", status, out)
	}

	// Trace d'activité : la correction est journalisée sur le compte.
	status, out = doJSON(t, ts, "GET", "/api/admin/accounts/"+accID, adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("fiche pour journal : statut %d", status)
	}
	rows, _ := out["activity"].([]any)
	found := false
	for _, row := range rows {
		if m, ok := row.(map[string]any); ok {
			if msg, _ := m["message"].(string); strings.Contains(msg, "corrigé par la plateforme") {
				found = true
				break
			}
		}
	}
	if !found {
		t.Fatalf("trace d'activité absente : %v", out["activity"])
	}
}
