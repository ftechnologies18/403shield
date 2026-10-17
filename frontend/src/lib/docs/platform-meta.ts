// ─────────────────────────────────────────────────────────────────────────────
// Métadonnées du volet PLATEFORME (privé) — N°304.
//
// SÛR À BUNDLER : titres et résumés seuls (aucun contenu de guide). Le
// contenu complet vit dans content/plateforme.ts, importé dynamiquement
// uniquement par la route gated /docs/guides/plateforme/[slug].
// Entrée unique : menu profil de la sidebar (admins plateforme).
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformGuideMeta {
  id: string;
  title: string;
  summary: string;
  minutes: number;
}

export const PLATFORM_SECTION = {
  id: "plateforme",
  title: "Console plateforme (super-admin)",
  description:
    "Pilotage du service 403Shield : comptes SaaS, flotte de routeurs, offre VPN grossiste, support, facturation et réglages. Réservé aux administrateurs de la plateforme.",
};

export const PLATFORM_GUIDES_META: PlatformGuideMeta[] = [
  {
    id: "plateforme-cockpit",
    title: "Cockpit & comptes SaaS",
    summary:
      "Santé du service, comptes clients (impersonation support, suspensions) et gestes de premier niveau.",
    minutes: 5,
  },
  {
    id: "plateforme-flotte",
    title: "Flotte routeurs & MAJ RouterOS",
    summary:
      "Le parc matériel global et les campagnes de mise à jour RouterOS coordonnées par vagues.",
    minutes: 4,
  },
  {
    id: "plateforme-vpn-grossiste",
    title: "VPN & vente directe (grossiste)",
    summary:
      "Pool VPN global, octroi aux comptes, verrous modules et commandes de la vitrine B2C.",
    minutes: 5,
  },
  {
    id: "plateforme-support",
    title: "Conversations & annonces",
    summary:
      "Chat support avec les comptes et diffusion d'annonces à toute la clientèle exploitants.",
    minutes: 4,
  },
  {
    id: "plateforme-facturation",
    title: "Demandes de renouvellement",
    summary:
      "Le flux administratif de facturation SaaS : demandes déposées, validation, reprise.",
    minutes: 3,
  },
  {
    id: "plateforme-reglages",
    title: "Journal, équipe & paramètres plateforme",
    summary:
      "Journal global multi-comptes, équipe des super-admins et réglages du service.",
    minutes: 4,
  },
];
