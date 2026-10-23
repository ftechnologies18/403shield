// Entités multi-tenant : tenant, plans SaaS, abonnement, paramètres, configuration plateforme.
// Extrait du monolithe models.go (N°88) — même package, contenu inchangé.
package model

// Tenant — infos du tenant.
type Tenant struct {
	Name     string `json:"name"`
	Currency string `json:"currency"`
	Timezone string `json:"timezone"`
	// Wave CI — lien marchand pay.wave.com (ex. https://pay.wave.com/m/M_xxx/c/ci/)
	// composé avec /amount/<montant>/ pour les demandes de paiement.
	WaveLink string `json:"waveLink,omitempty"`
	// P0 (audit Mikhmon) — F2 : personnalisation voucher.
	DNSName string `json:"dnsName,omitempty"` // ex. wifi.mondomaine.ci
	LogoURL string `json:"logoUrl,omitempty"` // data URL image ≤ 300 Ko
	// Bannière du portail captif (N°45) : image affichée en tête de la page
	// de login. Deux formes acceptées — data URL `data:image/…` ≤ 500 Ko
	// (upload console) ou URL https:// (Cloudflare R2, session suivante).
	// Vide = aucune bannière (portail sans image tête).
	BannerURL string `json:"bannerUrl,omitempty"`
	// Bouton « S'inscrire » du portail captif (N°46) : quand activé (valeur
	// effective par défaut : nil OU true), la page de login affiche le
	// bouton « S'inscrire » pointant vers le lien d'inscription publique
	// actif lié au routeur (quota MAC N°33). Quand désactivé (false),
	// AUCUN bouton d'inscription n'est rendu — le reliquat Mikhmon
	// « Scanner un QR Code » (lien externe sans fonction métier) est
	// retiré de la page. Pointeur : nil = défaut ON sans écrire le champ
	// dans le JSON renvoyé (compatibilité zéro-migration, même pattern
	// que Settings.AutoImportRouterUsers) ; la colonne Neon
	// `settings.join_button` (NOT NULL DEFAULT TRUE) reporte la valeur
	// explicite au premier Save.
	JoinButton *bool `json:"joinButton,omitempty"`
	// N°55 — mode hospitalité du portail captif. MikCloud sert deux usages :
	// la vente de tickets (commercial, défaut — grille tarifaire + Wave) ET
	// l'offre gratuite de fidélisation (hôtel, maquis, café-glacier, salon…)
	// où le portail devient une vitrine des produits/services de
	// l'établissement. "" OU "commercial" = portail historique ;
	// "hospitality" = grille tarifaire/Wave masquée, remplacée par le
	// message de bienvenue, les promos produits (images R2 via N°53) et
	// les liens réseaux sociaux.
	PortalStyle string `json:"portalStyle,omitempty"` // "" | "commercial" | "hospitality"
	// Message de bienvenue affiché en tête du mode hospitalité (≤ 200 car.).
	PortalWelcome string `json:"portalWelcome,omitempty"`
	// Promos produits — JSON [{title,desc,imageUrl,priceLabel}] ≤ 6 items
	// (structurés, persistés en string : pattern N°55, pas de table dédiée).
	PortalPromos string `json:"portalPromos,omitempty"`
	// N°136 — slides du carrousel commercial — JSON ["url", …] ≤ 3 URLs https
	// (images R2 via /api/media). Remplace les 3 images génériques pub1/2/3
	// du portail captif ; vide = images par défaut du template.
	PortalSlides string `json:"portalSlides,omitempty"`
	// Liens réseaux sociaux — JSON [{label,url}] ≤ 4 (WhatsApp, Facebook…).
	PortalSocials string `json:"portalSocials,omitempty"`
	// N°137 — services de l'établissement affichés dans la section
	// « Nos Services » du portail captif (mode commercial) : JSON
	// [{icon,label}] ≤ 6 items, icônes Font Awesome curées (whitelist
	// serveur côté validation settings — pattern N°55, pas de table dédiée).
	// Vide = section masquée (repli neutre : les 4 services historiques
	// du template étaient ceux du site pilote — même chasse que le
	// logo N°135).
	PortalServices string `json:"portalServices,omitempty"`
	// N°138 — messages du bandeau animé sous le logo du portail captif
	// (effet Typed.js) : JSON ["msg", …] ≤ 5 messages, 1-80 car. chacun
	// (texte brut trimé — pas d'URL ni de HTML, le portail échappe au
	// rendu). Vide = les 3 messages historiques du template (messages
	// WiFi génériques — « Wifi haut débit ! », etc.).
	PortalTicker string `json:"portalTicker,omitempty"`
	// N°139 — numéro WhatsApp SUPPORT du portail captif : JSON
	// {"number","label"} — number au format international sans + ni
	// espaces (8-15 chiffres, ex. 2250708091012), label optionnel
	// affiché à l'écran (≤ 30 car. ; défaut = le number brut). Vide =
	// le numéro du support 403Shield (repli historique : le support
	// plateforme, comme le crédit FTCI du footer — PAS la carte de
	// visite du site pilote).
	PortalWhatsapp string `json:"portalWhatsapp,omitempty"`
	// N°56 — clé publique du portail (16 hex, générée une fois par compte) :
	// identifiant NON secret embarqué dans la config du portail captif
	// (bloc mikcloud-config, visible de chaque invité par design) qui
	// permet au track analytics (POST /api/portal/track) de résoudre le
	// compte SANS authentification (pré-auth du hotspot). Elle n'ouvre
	// AUCUN droit de lecture : uniquement le dépôt d'événements
	// impressions/clics, dédupliqués et bornés côté serveur.
	PortalKey string `json:"portalKey,omitempty"`
	// P0 (audit Mikhmon) — F5 : politique de nettoyage des expirés.
	ExpiryPolicyMode      string `json:"expiryPolicyMode"`      // "keep" (défaut) | "remove"
	ExpiryPolicyAfterDays int    `json:"expiryPolicyAfterDays"` // défaut 30
	// N°65 — rétention du journal utilisateurs PAR COMPTE (30/60/90 jours,
	// défaut 90). Pointeur : nil = défaut 90 sans écrire le champ dans le JSON
	// renvoyé (compatibilité zéro-migration pour les comptes existants, même
	// pattern que JoinButton) ; la colonne Neon settings.log_retention_days
	// (NOT NULL DEFAULT 90) reporte la valeur explicite au premier Save.
	LogRetentionDays *int `json:"logRetentionDays,omitempty"`
	// N°290 — module Cybercafé (registre des postes + codes-temps + caisse
	// du cybercafé). Pointeur : nil = DÉSACTIVÉ (module opt-in — décision
	// D6 de N°289 : un flag, pas un nouvel usage ; l'enum hotspot|homenet
	// reste inchangé). La colonne settings.cyber_enabled (NOT NULL DEFAULT
	// FALSE) reporte la valeur explicite au premier Save.
	CyberEnabled *bool `json:"cyberEnabled,omitempty"`
	// N°291 — module VPN WireGuard vendable (peers clients sur le wg0 de la
	// VM, via le mini-service wg-mini — cf. model/vpnpeer.go). Même doctrine
	// D6 : un flag, PAS un nouvel usage (l'enum hotspot|homenet reste
	// inchangé). Pointeur : nil = DÉSACTIVÉ (module opt-in) ; la colonne
	// settings.wg_vpn_enabled (NOT NULL DEFAULT FALSE) reporte la valeur
	// explicite au premier Save.
	WgVpnEnabled *bool `json:"wgVpnEnabled,omitempty"`
	// N°301 — verrou GROSSISTE du module VPN : posé par l'admin plateforme
	// depuis la console « VPN & Vente directe » (PUT /api/admin/vpn/
	// accounts/{id}/module). Retirer le module = WgVpnEnabled=false +
	// verrou : le gérant ne peut plus le réactiver seul (PUT /api/vpn/
	// settings refuse avec 403 wg_vpn_locked) — l'octroi devient un geste
	// de la plateforme, la revente un droit accordé. Pointeur : nil = NON
	// verrouillé (comportement N°291 inchangé, zéro migration) ; la colonne
	// settings.wg_vpn_locked (NOT NULL DEFAULT FALSE) reporte la valeur
	// explicite au premier Save.
	WgVpnLocked *bool `json:"wgVpnLocked,omitempty"`
}

// DefaultLogRetentionDays — rétention par défaut du journal utilisateurs
// (F3), en jours. N°65 : chaque compte peut resserrer à 30/60 via
// tenant.logRetentionDays ; 90 reste le comportement historique (N°64).

// DefaultLogRetentionDays — rétention par défaut du journal utilisateurs
// (F3), en jours. N°65 : chaque compte peut resserrer à 30/60 via
// tenant.logRetentionDays ; 90 reste le comportement historique (N°64).
const DefaultLogRetentionDays = 90

// LogRetentionDaysEffective — valeur EFFECTIVE de la rétention du journal
// pour un compte (nil ou valeur hors 30/60/90 = 90 jours : le comportement
// N°64 est préservé pour les comptes existants — une valeur invalide glissée
// en base ne peut jamais ouvrir une rétention illimitée).

// LogRetentionDaysEffective — valeur EFFECTIVE de la rétention du journal
// pour un compte (nil ou valeur hors 30/60/90 = 90 jours : le comportement
// N°64 est préservé pour les comptes existants — une valeur invalide glissée
// en base ne peut jamais ouvrir une rétention illimitée).
func (t Tenant) LogRetentionDaysEffective() int {
	if t.LogRetentionDays == nil {
		return DefaultLogRetentionDays
	}
	switch *t.LogRetentionDays {
	case 30, 60, 90:
		return *t.LogRetentionDays
	default:
		return DefaultLogRetentionDays
	}
}

// Plan — plan d'abonnement SaaS (libellé hérité de l'ère pré-facturation ;
// maintenu pour compatibilité d'affichage, l'état réel vit dans Subscription).

// Plan — plan d'abonnement SaaS (libellé hérité de l'ère pré-facturation ;
// maintenu pour compatibilité d'affichage, l'état réel vit dans Subscription).
type Plan struct {
	Name       string `json:"name"`
	MaxRouters string `json:"maxRouters"`
	MaxUsers   string `json:"maxUsers"`
}

// Subscription — état d'abonnement SaaS d'un compte. PlanID vide = ère bêta
// (aucune formule souscrite). PeriodEnd vide = non expirant.

// Subscription — état d'abonnement SaaS d'un compte. PlanID vide = ère bêta
// (aucune formule souscrite). PeriodEnd vide = non expirant.
type Subscription struct {
	PlanID      string `json:"planId"`      // "" (bêta) | essentiel | illimite
	Status      string `json:"status"`      // active | expired
	PeriodStart string `json:"periodStart"` // RFC3339
	PeriodEnd   string `json:"periodEnd"`   // RFC3339 — "" = non expirant
	// LastAmountFcfa — montant de la période en cours : Essentiel =
	// 1 250 F × routeurs enregistrés au moment de la souscription, Illimité = forfait.
	LastAmountFcfa int `json:"lastAmountFcfa"`
	// P2/P3 (console plateforme) — RouterSlots : nombre de routeurs couverts
	// par une période Essentiel (quota réel vérifié côté serveur à la
	// création de routeur ; 0 = non plafonné : bêta, illimité, plateforme).
	// LastPaidAt : date RFC3339 du dernier paiement marqué par la plateforme
	// (vide = période en attente de paiement — indicatif, sans blocage).
	RouterSlots int    `json:"routerSlots,omitempty"`
	LastPaidAt  string `json:"lastPaidAt,omitempty"`
}

// SaasPlan — formule d'abonnement 403Shield (catalogue public de la console).

// SaasPlan — formule d'abonnement 403Shield (catalogue public de la console).
type SaasPlan struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	PriceFcfa int    `json:"priceFcfa"`
	Period    string `json:"period"`    // mois | an
	PerRouter bool   `json:"perRouter"` // true : prix × routeurs enregistrés
	Unlimited bool   `json:"unlimited"` // routeurs illimités
	// Usage — segment N°122 de la formule : « hotspot » (réseaux publics
	// payants) ou « homenet » (foyers résidentiels). Le catalogue est
	// SEGMENTÉ par mode : chaque compte ne voit et ne souscrit que les
	// formules de SON usage (validé serveur, cf. ResolvePlan).
	Usage   string `json:"usage"`
	Tagline string `json:"tagline"`
	Badge   string `json:"badge,omitempty"`
}

// SaasPlans — catalogue des formules 403Shield (marché FCFA concurrentiel).
// N°324 — MONO-MODE : les formules foyer (homenet-mensuel 1 250 F,
// homenet-annuel 12 000 F) sont RETIRÉES du catalogue avec le mode HomeNet
// (décision propriétaire, suite de la vitrine N°322). La grille est unique
// (historique N°122 : segmentation hotspot|foyer) :
//   - HOTSPOT (réseaux publics payants — cybercafé, maquis, boutique) :
//     Mensuel 2 500 F/mois/routeur (acquisition, sans engagement) ; Annuel
//     25 000 F/an routeurs illimités (verrouille 12 mois, consolide tous
//     les sites du réseau).
//
// Compat facturation : les identifiants homenet-* HISTORIQUES restent
// résolus par ResolvePlan vers les formules hotspot équivalentes (période
// et quota-routeurs identiques) — les abonnements GeniusPay récurrents en
// vol gardent leur PlanID d'origine et leur MONTANT souscrit ; seuls les
// renouvellements futurs basculent sur la grille unique.
//
// N°123 — le badge « 2 mois offerts » est RETIRÉ des formules annuelles
// (l'argument prix est porté par le tarif affiché, pas par une promesse de
// gratuité relative). Seules les mensuelles gardent un badge (« Sans
// engagement ») ; les annuelles s'affichent sans badge.
//
// Identifiants historiques (« essentiel », « illimite ») : ils ne sont PLUS
// dans le catalogue mais restent résolus par ResolvePlan (à l'usage du compte)
// pour les abonnements antérieurs au N°122 — la migration store les réécrit
// vers les identifiants segmentés au démarrage.
var SaasPlans = []SaasPlan{
	{
		ID: "hotspot-mensuel", Name: "Hotspot Mensuel", PriceFcfa: 2500, Period: "mois",
		PerRouter: true, Usage: AccountUsageHotspot,
		Tagline: "Payez au fil de votre croissance", Badge: "Sans engagement",
	},
	{
		ID: "hotspot-annuel", Name: "Hotspot Annuel", PriceFcfa: 25000, Period: "an",
		Unlimited: true, Usage: AccountUsageHotspot,
		Tagline: "Tous vos routeurs, un seul prix", // N°123 : sans badge
	},
}

// PlanByID — retrouve une formule du catalogue par son identifiant EXACT
// (identifiants segmentés N°122 uniquement). Pour les identifiants
// historiques ou la résolution à l'usage du compte, voir ResolvePlan.

// PlanByID — retrouve une formule du catalogue par son identifiant.
func PlanByID(id string) (SaasPlan, bool) {
	for _, p := range SaasPlans {
		if p.ID == id {
			return p, true
		}
	}
	return SaasPlan{}, false
}

// PlansForUsage — les DEUX formules du catalogue (mensuel puis annuel),
// dans l'ordre d'affichage de la console. N°324 — mono-mode : tout usage
// (y compris « homenet » léger résiduel) lit la grille Hotspot unique.
func PlansForUsage(usage string) []SaasPlan {
	out := make([]SaasPlan, 0, 2)
	for _, p := range SaasPlans {
		if p.Usage == AccountUsageHotspot {
			out = append(out, p)
		}
	}
	return out
}

// ResolvePlan — résout un identifiant de formule :
//   - identifiant du CATALOGUE (« hotspot-mensuel»…) → la formule exacte ;
//   - identifiant HISTORIQUE foyer (« homenet-mensuel », « homenet-annuel »
//     — N°324 : formules retirées du catalogue) → la formule hotspot de la
//     MÊME PÉRIODE (mensuel par routeur / annuel illimité) : les abonnements
//     GeniusPay récurrents en vol gardent leur PlanID d'origine et leur
//     montant souscrit — seuls les renouvellements basculent sur la grille
//     unique ;
//   - identifiant HISTORIQUE (« essentiel », « illimite » — abonnements
//     posés avant le N°122) → la formule du même rang (mensuel/annuel) ;
//   - « essai » et tout identifiant inconnu → pas de formule (false).
//
// Source unique du pricing : applySubscriptionLocked, la demande
// client, le webhook Wave et le prélèvement carte passent tous par ici.
func ResolvePlan(id, usage string) (SaasPlan, bool) {
	if p, ok := PlanByID(id); ok {
		return p, true
	}
	// N°324 — alias foyer retirés : mappés sur la formule hotspot de la même
	// période (facturation en vol, classification IsAnnual/IsPerRouter via
	// les littéraux homenet-* qui restent listés plus bas).
	switch id {
	case "homenet-mensuel":
		if p, ok := PlanByID("hotspot-mensuel"); ok {
			return p, true
		}
	case "homenet-annuel":
		if p, ok := PlanByID("hotspot-annuel"); ok {
			return p, true
		}
	}
	plans := PlansForUsage(usage)
	switch id {
	case "essentiel":
		if len(plans) > 0 {
			return plans[0], true
		}
	case "illimite":
		if len(plans) > 1 {
			return plans[1], true
		}
	}
	return SaasPlan{}, false
}

// IsAnnualPlanID — true pour les formules ANNUELLES (période « an »),
// identifiants historiques compris (défense en profondeur : les demandes de
// facturation et les prélèvements créés avant le N°122 gardent « illimite »).
func IsAnnualPlanID(id string) bool {
	switch id {
	case "hotspot-annuel", "homenet-annuel", "illimite":
		return true
	}
	return false
}

// IsPerRouterPlanID — true pour les formules MENSUELLES par routeur (quota
// RouterSlots vérifié à la création de routeur), identifiant historique
// compris. L'essai est géré à part (1 routeur, hors catalogue payant).
func IsPerRouterPlanID(id string) bool {
	switch id {
	case "hotspot-mensuel", "homenet-mensuel", "essentiel":
		return true
	}
	return false
}

// Settings — paramètres du tenant (tenant + plan + abonnement).

// Settings — paramètres du tenant (tenant + plan + abonnement).
type Settings struct {
	Tenant       Tenant       `json:"tenant"`
	Plan         Plan         `json:"plan"`
	Subscription Subscription `json:"subscription"`
	// I (paramètres plateforme) — N'EST UTILISÉ QUE SUR LE COMPTE PRINCIPAL
	// (AccountMainID) : configuration globale du SaaS vue par l'admin
	// plateforme. Ignoré pour les comptes clients.
	Platform *PlatformConfig `json:"platform,omitempty"`
	// AutoImportRouterUsers — réglage par compte (audit purge/résurgence) :
	// quand activé (valeur effective par défaut : nil OU true), les
	// utilisateurs hotspot présents sur un routeur AGENT mais inconnus du
	// cloud sont importés automatiquement à chaque read_state (découverte
	// des comptes créés dans Winbox). Quand désactivé (false), le read_state
	// ne crée RIEN : les comptes hors 403Shield sont comptés dans
	// Router.UnknownOnRouter pour adoption manuelle (outil d'import).
	// Pointeur : nil = défaut ON sans écrire le champ dans le JSON persisté
	// (compatibilité zéro-migration pour les comptes existants).
	AutoImportRouterUsers *bool `json:"autoImportRouterUsers,omitempty"`
}

// ImportAutoEnabled — valeur EFFECTIVE du réglage d'import automatique pour un
// compte (nil = ON : comportement historique préservé, zéro surprise).

// ImportAutoEnabled — valeur EFFECTIVE du réglage d'import automatique pour un
// compte (nil = ON : comportement historique préservé, zéro surprise).
func (s Settings) ImportAutoEnabled() bool {
	return s.AutoImportRouterUsers == nil || *s.AutoImportRouterUsers
}

// JoinButtonEnabled — valeur EFFECTIVE du réglage du bouton « S'inscrire »
// du portail captif (N°46) pour un compte (nil = ON : comportement historique
// préservé, zéro-migration pour les comptes existants).

// JoinButtonEnabled — valeur EFFECTIVE du réglage du bouton « S'inscrire »
// du portail captif (N°46) pour un compte (nil = ON : comportement historique
// préservé, zéro-migration pour les comptes existants).
func (t Tenant) JoinButtonEnabled() bool {
	return t.JoinButton == nil || *t.JoinButton
}

// CyberModuleEnabled — valeur EFFECTIVE du module Cybercafé (N°290) pour un
// compte (nil = OFF : module opt-in, activable en un clic depuis la vue
// Cybercafé — décision D6 de N°289).
func (t Tenant) CyberModuleEnabled() bool {
	return t.CyberEnabled != nil && *t.CyberEnabled
}

// WgVpnModuleEnabled — valeur EFFECTIVE du module VPN WireGuard vendable
// (N°291) pour un compte (nil = OFF : module opt-in, activable en un clic
// depuis la vue VPN — même doctrine D6 que le Cybercafé).
func (t Tenant) WgVpnModuleEnabled() bool {
	return t.WgVpnEnabled != nil && *t.WgVpnEnabled
}

// WgVpnModuleLocked — valeur EFFECTIVE du verrou grossiste (N°301) : nil =
// NON verrouillé (comportement N°291 préservé pour tous les comptes
// existants). Vrai = le module est retiré par la plateforme ET le gérant ne
// peut plus le réactiver seul.
func (t Tenant) WgVpnModuleLocked() bool {
	return t.WgVpnLocked != nil && *t.WgVpnLocked
}

// PlatformConfig — configuration globale de la plateforme 403Shield (vivante
// sur les settings du compte principal). Gérée depuis la console plateforme
// (vue Paramètres plateforme), persistée en PostgreSQL — plus besoin de
// redéployer Render pour ouvrir/fermer les inscriptions.

// PlatformConfig — configuration globale de la plateforme 403Shield (vivante
// sur les settings du compte principal). Gérée depuis la console plateforme
// (vue Paramètres plateforme), persistée en PostgreSQL — plus besoin de
// redéployer Render pour ouvrir/fermer les inscriptions.
type PlatformConfig struct {
	// Nom affiché du SaaS (login, footer) — défaut "403Shield".
	Name string `json:"name"`
	// RegisterOpen : auto-inscription publique autorisée sans clé.
	// Priorité de handleRegister : env REGISTER_KEY (si définie) > cette clé.
	RegisterOpen bool `json:"registerOpen"`
	// RegisterKey : clé d'invitation requise quand RegisterOpen = false
	// ("" = pas de clé → inscriptions totalement fermées).
	RegisterKey string `json:"registerKey,omitempty"`
	// N°301 — vitrine B2C MikCloud VPN (vente directe plateforme, hors
	// zone des gérants) : canal opt-in OFF par défaut (même doctrine D6
	// — un flag, pas un nouvel usage ; l'ouverture est un geste de
	// l'exploitant pour ne pas se mettre en concurrence avec ses
	// revendeurs sans l'avoir décidé). Colonne
	// settings.platform_public_vpn_shop (NOT NULL DEFAULT FALSE, nom
	// aligné sur la famille platform_* — N°302) sur le compte principal
	// uniquement.
	PublicVpnShop *bool `json:"publicVpnShop,omitempty"`
	// N°347 — vitrine DNS « TOURACO » (/dns — l'abonnement du bouclier DNS
	// TOURACO : capacités étendues, jamais une coupure du gratuit) : canal
	// opt-in OFF par défaut (même doctrine que PublicVpnShop — un flag, pas
	// un nouvel usage ; l'ouverture est un geste de l'exploitant). Colonne
	// settings.platform_public_dns_shop (NOT NULL DEFAULT FALSE) sur le
	// compte principal uniquement.
	PublicDnsShop *bool `json:"publicDnsShop,omitempty"`
	// WgVpnMonthlyQuotaGB — N°311 — quota mensuel de trafic par peer VPN
	// vendu, en Go (rx+tx confondus) : le garde-fou egress du tier Always
	// Free OCI (N°289 §3.1 — ~10 To/mois TOUTE la plateforme). Nil = défaut
	// DefaultWgVpnMonthlyQuotaGB (50 Go), 0 = illimité. Le balayage
	// api/vpnquota_sweep.go révoque le peer au dépassement (D-b) et la
	// console affiche le cumul par peer (D-a). Colonne
	// settings.platform_wg_vpn_quota_gb (INTEGER NOT NULL DEFAULT 50) sur
	// le compte principal uniquement — nom aligné sur la famille platform_*.
	WgVpnMonthlyQuotaGB *int `json:"wgVpnMonthlyQuotaGB,omitempty"`
}

// PublicVpnShopEnabled — valeur EFFECTIVE d'ouverture de la vitrine B2C
// (nil = fermée : opt-in strict).
func (p PlatformConfig) PublicVpnShopEnabled() bool {
	return p.PublicVpnShop != nil && *p.PublicVpnShop
}

// PublicDnsShopEnabled — N°347 — valeur EFFECTIVE d'ouverture de la
// vitrine DNS /dns (nil = fermée : opt-in strict, miroir PublicVpnShop).
func (p PlatformConfig) PublicDnsShopEnabled() bool {
	return p.PublicDnsShop != nil && *p.PublicDnsShop
}

// WgVpnMonthlyQuotaEffective — N°311 — valeur EFFECTIVE du quota mensuel
// VPN (Go) : nil = défaut 50 Go (DefaultWgVpnMonthlyQuotaGB), 0 = illimité.
// Consommée par le balayage vpnquota_sweep.go (borne de révocation) et par
// les vues console (denominateur de la jauge par peer).
func (p PlatformConfig) WgVpnMonthlyQuotaEffective() int {
	if p.WgVpnMonthlyQuotaGB != nil {
		return *p.WgVpnMonthlyQuotaGB
	}
	return DefaultWgVpnMonthlyQuotaGB
}

// AdminUser — compte d'accès à la console (login), rattaché à un compte SaaS.
