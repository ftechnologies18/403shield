// ─────────────────────────────────────────────────────────────────────────────
// /docs/guides — modèle de contenu des guides MikCloud (N°304).
//
// Un guide documente UNE surface de la console selon le gabarit Q&A validé
// avec l'exploitant (Tâche 4) :
//   1. C'est quoi ?            → `quoi`
//   2. Quelle différence ?     → `difference[]`
//   3. Que reçoit-on ?         → `recoit[]`
//   4. Comment l'utiliser ?    → `etapes[]` (1 capture par étape quand utile)
//   5. Quels usages ?          → `usages[]`
//   6. Pièges & astuces        → `pieges[]`
//   7. Questions fréquentes    → `faq[]`
//
// Les 30 guides « console » sont PUBLICS (pages statiques, captures sous
// /public/docs/<module>/). Les 6 guides « plateforme » sont PRIVÉS : leurs
// métadonnées vivent dans platform-meta.ts (titres seuls) et leur contenu
// complet dans content/plateforme.ts, chargé UNIQUEMENT par la route gated
// /docs/guides/plateforme/[slug] après vérification de session + rôle
// admin plateforme — entrée unique : menu profil de la sidebar (décision
// exploitant, pas d'accessibilité publique pour ce volet).
// ─────────────────────────────────────────────────────────────────────────────

export interface GuideCapture {
  /** Chemin public (ex. « /docs/hotspot/vouchers.png »). */
  src: string;
  /** Description accessible obligatoire (WCAG). */
  alt: string;
  /** Légende affichée sous la capture. */
  caption?: string;
  /** Largeur intrinsèque px (ratio réservé avant chargement, zéro CLS). */
  width: number;
  /** Hauteur intrinsèque px. */
  height: number;
}

export interface GuideStep {
  title: string;
  /** Explication de l'étape (paragraphes séparés par \n\n). */
  body: string;
  capture?: GuideCapture;
  /** Astuce encadrée attachée à l'étape. */
  tip?: string;
}

export interface GuideDifference {
  /** « … » dans « Quelle différence avec … ? » */
  with: string;
  body: string;
}

export interface GuideUsage {
  title: string;
  body: string;
}

export interface GuidePitfall {
  title: string;
  body: string;
  /** warn = rouge (risque réel), info = neutre (bonne pratique). */
  severity?: "warn" | "info";
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  id: string;
  title: string;
  /** Résumé d'une phrase (cartes du hub + métadonnées). */
  summary: string;
  /** Rôles concernés, affiché (« Propriétaire · Gérant »). */
  roles: string;
  /** Temps de lecture estimé (minutes). */
  minutes: number;
  /** Date de dernière mise à jour (ISO court « 2026-10-12 »). */
  updated: string;
  /** Section d'appartenance (id dans DOC_SECTIONS). */
  sectionId: string;
  /** Vague du plan initial (V1/V2/V3 — suivi interne, non affiché). */
  vague: "V1" | "V2" | "V3";
  quoi: string;
  difference: GuideDifference[];
  recoit: string[];
  etapes: GuideStep[];
  usages: GuideUsage[];
  pieges: GuidePitfall[];
  faq: GuideFaq[];
  /** Guides liés (ids) affichés en fin de page. */
  related?: string[];
}

export interface DocSection {
  id: string;
  title: string;
  /** Phrase de présentation de la section (hub + nav). */
  description: string;
  /** Icône de section (nom lucide mappé dans le composant). */
  icon: string;
}
