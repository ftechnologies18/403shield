// Hub public /docs/guides (N°304) — 30 guides d'exploitation console
// gérant/propriétaire. Le volet plateforme (6 guides) n'est PAS référencé
// ici : privé, accessible uniquement via le menu profil de la sidebar.

import type { Metadata } from "next";
import { DOC_SECTIONS, guidesBySection } from "@/lib/docs/catalog";
import { DocsShell } from "@/components/docs/docs-shell";
import { HubView } from "@/components/docs/hub-view";

export const metadata: Metadata = {
  title: "Guides MikCloud — documentation d'exploitation",
  description:
    "30 guides illustrés pour exploiter MikCloud : compte, routeurs MikroTik (mode Agent), vouchers & ventes, sessions, revendeurs, rapports, protections — chaque fonction expliquée pas à pas avec captures d'écran.",
  keywords: [
    "MikCloud",
    "guide MikroTik",
    "hotspot",
    "vouchers",
    "documentation hotspot",
    "FAI Abidjan",
    "cybercafé",
  ],
  openGraph: {
    title: "Guides MikCloud — documentation d'exploitation",
    description:
      "Chaque fonction de la console expliquée pas à pas, avec captures d'écran réelles.",
    type: "website",
  },
};

export default function DocsGuidesHubPage() {
  const sections = DOC_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
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

  return (
    <DocsShell sections={sections}>
      <HubView sections={sections} />
    </DocsShell>
  );
}
