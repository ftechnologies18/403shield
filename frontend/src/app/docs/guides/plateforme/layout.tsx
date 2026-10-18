// Layout du volet PLATEFORME (N°304, N°333-C) — noindex strict : la section
// est PRIVÉE (décision exploitant : accès uniquement via le menu profil de
// la sidebar, jamais référencée). N°333-C : le volet hérite du DocsShell
// (sidebar arborescente, palette ⌘K, TOC auto-caché) avec un groupe
// « Plateforme (privé) » — la garde de contenu (PlatformGate) reste dans
// les pages : le shell n'est que du chrome public, le contenu reste gated.

import type { Metadata } from "next";
import { DOC_SECTIONS, guidesBySection } from "@/lib/docs/catalog";
import { PLATFORM_GUIDES_META } from "@/lib/docs/platform-meta";
import { DocsShell } from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "Guides plateforme — 403Shield (privé)",
  robots: { index: false, follow: false, nocache: true },
};

export default function PlatformDocsLayout({ children }: { children: React.ReactNode }) {
  const sections = DOC_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    guides: guidesBySection(s.id).map((g) => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
      roles: g.roles,
      minutes: g.minutes,
      sectionId: g.sectionId,
      sectionTitle: s.title,
    })),
  }));

  const platformGuides = PLATFORM_GUIDES_META.map((g) => ({ id: g.id, title: g.title }));

  return (
    <DocsShell sections={sections} platformGuides={platformGuides} withToc>
      {children}
    </DocsShell>
  );
}
