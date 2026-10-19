// middleware.go — authentification JWT, garde de rôles et contexte de claims.

package api

import (
	"context"
	"net/http"
	"strings"

	"mikcloud/hotspot-api/internal/auth"
	"mikcloud/hotspot-api/internal/model"
)

type claimsCtxKey struct{}

func claimsFrom(r *http.Request) *auth.Claims {
	if c, ok := r.Context().Value(claimsCtxKey{}).(*auth.Claims); ok {
		return c
	}
	return nil
}

// accountScope — identifiant du compte SaaS du porteur du token. Les tokens
// émis avant la migration multi-tenant ne portent pas de compte : ils ne
// peuvent provenir que de l'unique tenant historique → compte principal.
func accountScope(r *http.Request) string {
	if c := claimsFrom(r); c != nil && c.Acc != "" {
		return c.Acc
	}
	return model.AccountMainID
}

// isPlatformAdminClaims — variante sur des claims déjà vérifiés, utilisable
// partout où la requête ne porte pas encore le contexte (authMiddleware pose
// le contexte APRÈS les gardes — cf. appel de la garde de suspension).
func isPlatformAdminClaims(c *auth.Claims) bool {
	return c != nil && (c.Role == model.RolePlatformAdmin || c.Role == "admin")
}

// isPlatformAdmin — true si le porteur du token a le rôle super-admin
// plateforme 403Shield (RolePlatformAdmin ; « admin » historique accepté pour
// les tokens émis avant le renommage N°7).
func isPlatformAdmin(r *http.Request) bool {
	return isPlatformAdminClaims(claimsFrom(r))
}

// roleRank — hiérarchie des rôles d'équipe (N°7) :
// manager(2) < owner(3). Le super-admin plateforme est traité
// comme owner sur le compte consulté. Rôle inconnu → 0 (aucun droit, défensif).
// Le rôle « operator » a été retiré du produit : les comptes existants sont
// promus manager au démarrage (store.migrateRemoveOperator).
func roleRank(role string) int {
	switch role {
	case model.RoleManager:
		return 2
	case model.RoleOwner, model.RolePlatformAdmin, "admin":
		return 3
	}
	return 0
}

// requireRole — autorisation SERVEUR (défense en profondeur : l'UI masque,
// le serveur refuse). Le porteur du token doit avoir un rang ≥ min pour
// accéder au handler. Ex. : PUT /api/settings → requireRole(3, …).
func (a *API) requireRole(min int, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c := claimsFrom(r); c != nil && roleRank(c.Role) >= min {
			next(w, r)
			return
		}
		writeErr(w, http.StatusForbidden, "Accès refusé — rôle insuffisant pour cette action")
	}
}

func (a *API) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// N°27 — formulaire public d'inscription : /api/join/{token} est
		// public, le token du lien fait l'authentification (PAS /api/join-links,
		// qui reste derrière le JWT console — le préfixe avec « / » exclut ce nom).
		// N°28 — WiFi jetable : la page publique est résolue par slug (sans
		// authentification) ; /api/wifi/sites|guests (console) RESTE protégée.
		publicWifi := strings.HasPrefix(path, "/api/wifi/site/") && !strings.HasSuffix(path, "/sites") && !strings.HasSuffix(path, "/guests")
		// N°53 — Média R2 : la LECTURE d'image est publique (le portail
		// captif charge ses images pré-authentification — même hôte que
		// apiBase) ; le POST (téléversement) reste derrière le JWT gérant.
		publicMedia := r.Method == http.MethodGet && strings.HasPrefix(path, "/api/media/")
		// N°56 — analytics du portail : POST /api/portal/track est
		// public (la page du portail dépose ses impressions/clics
		// pré-authentification). La résolution du compte passe par la
		// clé publique portalKey (non secrète, aucun droit de lecture)
		// et le dépôt est borné : dédup journalière, quotas IP,
		// plafond journalier (cf. handlers_promo_events.go). Uniquement
		// ce POST exact — GET /api/promos/stats reste console.
		publicPromoTrack := r.Method == http.MethodPost && path == "/api/portal/track"
		// N°68 — « Mot de passe oublié ? » : demande de lien e-mail et
		// consommation du lien sont publics (le secret du parcours
		// voyage dans le token du lien, hashé en base — jamais de JWT
		// puisqu'on a oublié... le mot de passe). Le quota IP (S3) et
		// l'expiration/usage unique bornent l'abus.
		publicPasswordReset := path == "/api/auth/forgot-password" || path == "/api/auth/reset-password"
		// N°127 — assistant conversationnel public : le secret visiteur
		// (hashé en base) fait l'authentification, les POST sont bornés par
		// le quota IP a.chat. Le préfixe « /api/chat/ » ne peut pas capter
		// les routes admin (/api/admin/chat/… ne partage pas ce préfixe).
		publicChat := strings.HasPrefix(path, "/api/chat/")
		// N°301 — vitrine B2C MikCloud VPN : 4 routes publiques (GET
		// catalogue, POST commande, GET statut par ref, POST récupération
		// self-service). L'appariement e-mail+référence et les quotas IP
		// dédiés (a.vpnOrder / a.vpnStatus / a.vpnRecover) bornent l'abus ;
		// le préfixe ne capte RIEN de console (/api/admin/vpn/* et
		// /api/vpn/* ne partagent pas ce préfixe).
		publicVpnShop := strings.HasPrefix(path, "/api/public/vpn/")
		// N°313 — module tunnel (console séparée, Programme Tunnel) :
		// les DEUX routes d'authentification par code e-mail sont
		// publiques (passwordless — l'e-mail fait l'identité, le code
		// est le secret ; quotas IP + honeypot côté handlers). Le
		// préfixe « /api/tunnel/auth/ » ne peut capter NI /api/tunnel/me
		// (garde rôle « tunnel » ci-dessous) NI quelque route console
		// que ce soit.
		publicTunnelAuth := strings.HasPrefix(path, "/api/tunnel/auth/")
		if path == "/api/auth/login" || path == "/api/auth/register" || path == "/api/reseller/login" || path == "/api/webhooks/wave" || path == "/api/webhooks/geniuspay" || path == "/api/webhooks/telegram" || path == "/api/vitals" || strings.HasPrefix(path, "/api/join/") || publicWifi || publicMedia || publicPromoTrack || publicPasswordReset || publicChat || publicVpnShop || publicTunnelAuth || !strings.HasPrefix(path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeErr(w, http.StatusUnauthorized, "Token d'authentification manquant")
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims, err := auth.Verify(a.secret, token)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "Token invalide ou expiré")
			return
		}
		// Sécurité S1-A3 — révocation de session : le porteur du token
		// doit TOUJOURS exister ET porter l'époque de session courante
		// (claim « ver »). Un membre supprimé de l'équipe, ou dont la
		// session a été révoquée (mot de passe changé ou réinitialisé,
		// rôle modifié), perd l'accès IMMÉDIATEMENT — sans attendre
		// l'expiration naturelle du token (24 h). Compatibilité : les
		// tokens antérieurs au correctif se décodent ver=0 et restent
		// valables tant que SessionEpoch vaut 0. Les revendeurs (Mode
		// Vente) ne sont pas des AdminUser : hors périmètre de ce garde.
		// N°313 — les clients légers tunnel (rôle « tunnel ») non plus :
		// ils vivent dans tunnel_clients, leur blocage se vérifie dans
		// handleTunnelMe (lecture à chaque appel d'espace).
		if claims.Role != "reseller" && claims.Role != "tunnel" {
			a.store.Lock()
			found, epoch := false, 0
			for i := range a.store.Data().Users {
				if u := &a.store.Data().Users[i]; u.ID == claims.Sub {
					found, epoch = true, u.SessionEpoch
					break
				}
			}
			a.store.Unlock()
			if !found {
				writeErr(w, http.StatusUnauthorized, "Compte utilisateur supprimé — reconnectez-vous")
				return
			}
			if claims.Ver != epoch {
				writeErr(w, http.StatusUnauthorized, "Session révoquée — reconnectez-vous")
				return
			}
		}
		// Compte désactivé ou supprimé : le token reste signé mais n'autorise plus
		// aucun accès (effet immédiat de POST /api/admin/accounts/{id}/status).
		if claims.Acc != "" {
			a.store.Lock()
			active := false
			for i := range a.store.Data().Accounts {
				if acc := &a.store.Data().Accounts[i]; acc.ID == claims.Acc && acc.Status == "active" {
					active = true
					break
				}
			}
			a.store.Unlock()
			if !active {
				writeErr(w, http.StatusUnauthorized, "Compte désactivé — contactez le support")
				return
			}
		}
		// Sécurité P0 — liste blanche du rôle revendeur : le token PIN (rang 0)
		// n'atteint que le Mode Vente (/api/sell/*), conformément au contrat N°8
		// documenté en tête de handlers_sell.go (« seul le trio /api/sell/* lui
		// répond »). Toute autre route est refusée par défaut — ferme notamment la
		// génération de vouchers gratuits (canal direct non débité) et la lecture
		// des codes/mots de passe du compte par les routes sans requireRole.
		if claims.Role == "reseller" && !strings.HasPrefix(path, "/api/sell/") {
			writeErr(w, http.StatusForbidden, "Accès réservé au Mode Vente")
			return
		}
		// N°313 — liste blanche du rôle « tunnel » (clients légers de la
		// console tunnel) : le token n'atteint QUE /api/tunnel/* — AUCUNE
		// route console SaaS, miroir exact du garde reseller ci-dessus.
		// N°339 — le bouclier DNS vit sous /api/dnsshield/* (même frontière
		// d'identité : l'e-mail du client tunnel EST le propriétaire des
		// profils — miroir de l'Accès Pro N°315).
		if claims.Role == "tunnel" && !strings.HasPrefix(path, "/api/tunnel/") && !strings.HasPrefix(path, "/api/dnsshield/") {
			writeErr(w, http.StatusForbidden, "Accès réservé à la console tunnel")
			return
		}
		// Suspension (P5) : au-delà de PeriodEnd + 30 jours de grâce, le compte
		// est suspendu. Seules les routes d'identification (/api/auth/me) et de
		// paiement (/api/subscription — DEMANDE de renouvellement, /api/settings)
		// restent accessibles — le reste est bloqué pour forcer le règlement.
		// Exemption : administrateurs plateforme.
		if claims.Acc != "" && !isPlatformAdminClaims(claims) {
			view := a.subscriptionGuardState(claims.Acc)
			if view.Status == "suspended" {
				allowed := path == "/api/auth/me" || path == "/api/subscription" || path == "/api/settings" || strings.HasPrefix(path, "/api/subscription/pay") || strings.HasPrefix(path, "/api/subscription/stripe") || strings.HasPrefix(path, "/api/billing")
				if !allowed {
					writeErrCode(w, http.StatusPaymentRequired, "account_suspended",
						"Compte suspendu — réglez votre abonnement pour reprendre l'accès",
						map[string]any{"status": "suspended"})
					return
				}
			}
		}
		// N°75 — veille adaptative : une requête console AUTHENTIFIÉE
		// marque le compte « sous attention » — ses routeurs restent en
		// mode rapide (45 s) tant que quelqu'un l'utilise (fenêtre 10 min
		// après le DERNIER signal). Les endpoints publics du portail
		// marquent le routeur du site directement dans leurs handlers.
		// Verrou dédié, aucune section critique tenue ici.
		if claims.Acc != "" {
			a.markAttention("acc:" + claims.Acc)
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsCtxKey{}, claims)))
	})
}
