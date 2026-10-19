// ─────────────────────────────────────────────────────────────────────────────
// /docs/guides — catalogue des sections & agrégation (N°304, N°333-B).
//
// 33 guides console PUBLICS (statiques, /public/docs/<module>/ — dont la
// section Tunnels & Accès Pro) + le volet plateforme PRIVÉ (6 guides :
// métadonnées ici, contenu chargé à la demande par la route gated — voir
// platform-meta.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { DocSection, Guide } from "./types";
import { DEMARRER_GUIDES } from "./content/demarrer";
import { SUPERVISION_GUIDES } from "./content/supervision";
import { HOTSPOT_GUIDES } from "./content/hotspot";
import { TUNNELS_GUIDES } from "./content/tunnels";
import { PERSONNES_GUIDES } from "./content/personnes";
import { INFRASTRUCTURE_GUIDES } from "./content/infrastructure";
import { ANALYSE_GUIDES } from "./content/analyse";
import { PARAMETRES_GUIDES } from "./content/parametres";
import { ANNEXES_GUIDES } from "./content/annexes";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "demarrer",
    title: "Démarrer",
    description:
      "Le parcours d'installation complète : créer le compte, connecter le premier routeur, encaisser la première vente.",
    icon: "rocket",
  },
  {
    id: "supervision",
    title: "Supervision",
    description:
      "Voir et agir en direct : tableau de bord, sessions actives, protections du réseau.",
    icon: "gauge",
  },
  {
    id: "hotspot",
    title: "Hotspot — vendre l'accès",
    description:
      "Le moteur commercial : vouchers, profils, modules Cybercafé / VPN / PPPoE et WiFi offert.",
    icon: "ticket",
  },
  {
    id: "tunnels",
    title: "Tunnels & Accès Pro",
    description:
      "Le pont privé WireGuard : VPN personnel à IP fixe France, Accès Pro pour routeurs, caméras et NAS — et l'espace client sans mot de passe.",
    icon: "shield",
  },
  {
    id: "personnes",
    title: "Personnes",
    description:
      "Clients à compte, inscriptions publiques et réseau de revendeurs en Mode Vente.",
    icon: "users",
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    description:
      "Routeurs, outils de pilotage, sites multi-établissements et portail captif de marque.",
    icon: "router",
  },
  {
    id: "analyse",
    title: "Analyse & audit",
    description:
      "Chiffres d'exploitation : comptabilité, marge, activité et journal des événements.",
    icon: "chart",
  },
  {
    id: "parametres",
    title: "Paramètres & compte",
    description:
      "Réglages du compte : général, sécurité 2FA, notifications, abonnement, équipe.",
    icon: "settings",
  },
  {
    id: "annexes",
    title: "Annexes — surfaces client final",
    description:
      "Ce que voient vos clients : Mode Vente, portail captif, vitrine VPN, WiFi jetable.",
    icon: "smartphone",
  },
];

/** Guides publics (32) — servables en statique, jamais de contenu plateforme ici. */
export const PUBLIC_GUIDES: Guide[] = [
  ...DEMARRER_GUIDES,
  ...SUPERVISION_GUIDES,
  ...HOTSPOT_GUIDES,
  ...TUNNELS_GUIDES,
  ...PERSONNES_GUIDES,
  ...INFRASTRUCTURE_GUIDES,
  ...ANALYSE_GUIDES,
  ...PARAMETRES_GUIDES,
  ...ANNEXES_GUIDES,
];

export function getPublicGuide(slug: string): Guide | undefined {
  return PUBLIC_GUIDES.find((g) => g.id === slug);
}

export function guidesBySection(sectionId: string): Guide[] {
  return PUBLIC_GUIDES.filter((g) => g.sectionId === sectionId);
}

/** Guide suivant / précédent (ordre du catalogue) — navigation de fin de page. */
export function guideNeighbors(slug: string): { prev?: Guide; next?: Guide } {
  const i = PUBLIC_GUIDES.findIndex((g) => g.id === slug);
  if (i < 0) return {};
  return { prev: PUBLIC_GUIDES[i - 1], next: PUBLIC_GUIDES[i + 1] };
}

/** Métadonnées légères pour la recherche côté client (hub). */
export interface GuideMetaLight {
  id: string;
  title: string;
  summary: string;
  roles: string;
  minutes: number;
  sectionId: string;
  sectionTitle: string;
}

export const PUBLIC_GUIDES_LIGHT: GuideMetaLight[] = DOC_SECTIONS.flatMap((s) =>
  guidesBySection(s.id).map((g) => ({
    id: g.id,
    title: g.title,
    summary: g.summary,
    roles: g.roles,
    minutes: g.minutes,
    sectionId: s.id,
    sectionTitle: s.title,
  })),
);
