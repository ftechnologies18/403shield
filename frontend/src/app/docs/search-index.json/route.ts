// ─────────────────────────────────────────────────────────────────────────────
// GET /docs/search-index.json — index de recherche plein texte des guides
// publics 403Shield (N°333-C, palette ⌘K du shell docs).
//
// Route handler STATIQUE : prérendu au build (dynamic = "force-static"),
// zéro API dynamique — la réponse est calculée une fois pour toutes à la
// compilation et servie telle quelle.
//
// Construction depuis les modules de contenu EXISTANTS (aucun catalog modifié)
// : PUBLIC_GUIDES (33 guides publics — le volet privé « plateforme » n'y
// figure pas et n'y figurera jamais) + GUIDE_ANCHORS (les 7 blocs Q&A du
// gabarit, ancre et intitulé exacts rendus par GuideView).
//
// Consommé par <DocsCommand /> (src/components/docs/docs-command.tsx) via
// fetch("/docs/search-index.json") à la première ouverture de la palette.
// Format : voir SearchIndex dans src/lib/docs/search-engine.ts (types miroir).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { DOC_SECTIONS, PUBLIC_GUIDES } from "@/lib/docs/catalog";
import type { Guide } from "@/lib/docs/types";
import type { SearchIndex } from "@/lib/docs/search-engine";
// guide-view.tsx est un module "use client" : côté serveur, ses exports
// deviennent des références client opaques (GUIDE_ANCHORS.map → TypeError,
// vérifié au dev server). On importe donc SEULEMENT son TYPE et on déclare un
// miroir local des 7 blocs — typé `typeof GUIDE_ANCHORS`, si le gabarit
// évolue dans guide-view.tsx sans mise à jour du miroir, typecheck échoue.
import type { GUIDE_ANCHORS } from "@/components/docs/guide-view";

/** Prérendu au build : aucun accès requête, réponse figée à la compilation. */
export const dynamic = "force-static";

/* ── Miroir des 7 blocs Q&A (cf. import type ci-dessus) ───────────────────── */

const SEARCH_BLOCKS: typeof GUIDE_ANCHORS = [
  { id: "cest-quoi", label: "C'est quoi ?" },
  { id: "differences", label: "Différences" },
  { id: "recoit", label: "Que recevez-vous ?" },
  { id: "etapes", label: "Comment l'utiliser ?" },
  { id: "usages", label: "Quels usages ?" },
  { id: "pieges", label: "Pièges & astuces" },
  { id: "faq", label: "Questions fréquentes" },
] as const;

/* ── Concaténation propre : espaces simples, sans vides ───────────────────── */

function squash(parts: ReadonlyArray<string | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Texte concaténé d'un bloc Q&A (bodies, titres d'étapes, tips, Q+A) —
 * les intitulés de captures ne font PAS partie du texte indexable.
 */
function blockText(guide: Guide, anchorId: string): string {
  switch (anchorId) {
    case "cest-quoi":
      return squash([guide.quoi]);
    case "differences":
      return squash(guide.difference.map((d) => `vs ${d.with} : ${d.body}`));
    case "recoit":
      return squash(guide.recoit);
    case "etapes":
      return squash(
        guide.etapes.map((step, i) =>
          squash([
            `Étape ${i + 1} : ${step.title}`,
            step.body,
            step.tip ? `Astuce : ${step.tip}` : undefined,
          ]),
        ),
      );
    case "usages":
      return squash(guide.usages.map((u) => `${u.title} : ${u.body}`));
    case "pieges":
      return squash(guide.pieges.map((p) => `${p.title} : ${p.body}`));
    case "faq":
      return squash(guide.faq.map((f) => `${f.q} : ${f.a}`));
    default:
      return "";
  }
}

/* ── Index ────────────────────────────────────────────────────────────────── */

const SECTION_TITLES = new Map(DOC_SECTIONS.map((s) => [s.id, s.title] as const));

function buildIndex(): SearchIndex {
  return {
    version: 1,
    // Évalué au build (force-static) : date ISO de compilation.
    generated: new Date().toISOString(),
    entries: PUBLIC_GUIDES.map((guide) => ({
      id: guide.id,
      title: guide.title,
      summary: guide.summary,
      sectionId: guide.sectionId,
      sectionTitle: SECTION_TITLES.get(guide.sectionId) ?? guide.sectionId,
      minutes: guide.minutes,
      updated: guide.updated,
      // URLs hiérarchiques N°333-C : /docs/guides/<sectionId>/<id>
      url: `/docs/guides/${guide.sectionId}/${guide.id}`,
      // Les 7 blocs Q&A du gabarit, dans l'ordre de GUIDE_ANCHORS
      // (ancre + intitulé exacts utilisés par GuideView).
      blocks: SEARCH_BLOCKS.map((anchor) => ({
        a: anchor.id,
        h: anchor.label,
        t: blockText(guide, anchor.id),
      })),
    })),
  };
}

export function GET(): NextResponse {
  return new NextResponse(JSON.stringify(buildIndex()), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Contenu figé au build : cache navigateur/CDN longue durée.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
