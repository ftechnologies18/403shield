// N°7 — Rôles équipe : miroir CLIENT de la hiérarchie serveur (requireRole).
// L'UI masque ce que le serveur refuserait de toute façon (403/404) — le
// masquage est purement du confort, l'autorisation réelle vit côté Go.

import type { AccountUsage } from "./types";

export type TeamRole = "manager" | "owner" | "platform_admin" | "admin";

/** Rang : manager(2) < owner(3) ≈ platform admin(3). Inconnu → 0.
 * Le rôle « operator » a été retiré du produit (les comptes existants sont
 * promus manager par la migration store.migrateRemoveOperator côté serveur). */
export function roleRank(role: string): number {
  switch (role) {
    case "manager":
      return 2;
    case "owner":
    case "platform_admin":
    case "admin": // rôle historique (pré-renommage), toujours accepté
      return 3;
    default:
      return 0;
  }
}

/** Vues accessibles par rang minimal — reflet des routes requireRole côté API. */
const VIEW_MIN_RANK: Record<string, number> = {
  dashboard: 1,
  sessions: 1,
  protection: 2, // N°83 — vue Protection : statut + contrôles sécurité (miroir de l'ancien onglet Système de la fiche routeur, gérant+ ; PUT safewifi/shield/familyguard derrière le JWT + accountScope)
  users: 1,
  registrations: 2, // N°27 — file des demandes + liens (API requireRole(2) : manager+)
  vouchers: 1,
  // N°290 — module Cybercafé : lecture ouverte à tout rôle (registre) ;
  // écritures (attribution/pause/import) derrière requireRole(2) serveur,
  // activation rang 3 — la barrière réelle vit côté Go.
  cyber: 1,
  // N°291 — WireGuard vendable : lecture ouverte (registre des peers) ;
  // gestes (création/révocation/livraison) derrière requireRole(2) serveur,
  // activation rang 3 — la barrière réelle vit côté Go.
  vpn: 1,
  // N°294 — abonnés PPPoE : lecture ouverte (registre + sessions) ; gestes
  // (création/édition/suspension/renouvellement/suppression/renfort) derrière
  // requireRole(2) serveur — la barrière réelle vit côté Go.
  ppp: 1,
  stats: 1, // heatmap affluence (lecture)
  templates: 2, // gestion des modèles (l'impression reste accessible à tous)
  profiles: 2,
  resellers: 2,
  routers: 2, // outils routeur (config/diagnostics) — gérant+
  portal: 2, // N°35-d — portail captif (aperçu + re-déploiement) — gérant+
  reports: 2,
  logs: 2,
  notifications: 2,
  settings: 3,
  // N°100 — Abonnement : lecture ouverte à tout rôle authentifié (GET
  // /api/subscription sans restriction serveur, section partagée — une
  // entrée explicite évite que le repli default-open ci-dessous ne ferme
  // la vue.
  subscription: 1,
  // N°184 — plus de vue « hotspot » (onglet Expérience retiré — fusion
  // dans le hub, cf. settings-sections) : la section atterrit sur « portal ».
  security: 3, // N°57-d — mot de passe + 2FA (ex-onglet Avancé de la vue Paramètres, rang 3)
  team: 3,
  accounts: 3, // + vérification isPlatformAdmin côté vue
};

/** Vues de la CONSOLE PLATEFORME — réservées au super-admin 403Shield
 * (platform_admin, ou « admin » historique). Le reste de la navigation
 * appartient à la console client. */
const PLATFORM_VIEWS: ReadonlySet<string> = new Set(["platform", "platformFleet", "platformChat", "platformLogs", "platformTeam", "billingRequests", "platformSettings", "platformAnnouncements", "platformNotifications", "platformVpn"]); // N°153 — notifications du compte principal ; N°301 — VPN & Vente directe (grossiste)

/** Cette vue appartient-elle à la console plateforme ? */
export function isPlatformView(view: string): boolean {
  return PLATFORM_VIEWS.has(view) || view === "accounts";
}

/** Usage effectif d'un utilisateur de session — N°324 : mono-mode, la
 * fonction NORMALISE toute valeur legacy (« homenet » des sessions/JWT
 * antérieures à la retraite) vers « hotspot ». Comportement inchangé pour
 * absent/vide (admin plateforme, sessions antérieures à N°98). */
export function usageOf(usage: AccountUsage | "" | undefined): AccountUsage {
  return "hotspot";
}

/** L'utilisateur de ce rôle peut-il ouvrir cette vue ?
 * N°324 — mono-mode : plus de paramètre d'usage (la console foyer est
 * retirée — usageOf normalise les sessions legacy vers hotspot), le
 * comportement redevient le default-open historique de la console
 * hotspot : une vue non enregistrée est visible, la barrière réelle vit
 * côté serveur. */
export function canView(role: string | undefined, view: string): boolean {
  if (!role) return false;
  if (isPlatformView(view)) return role === "admin" || role === "platform_admin";
  const min = VIEW_MIN_RANK[view];
  if (min === undefined) return true; // default-open
  return roleRank(role) >= min;
}
