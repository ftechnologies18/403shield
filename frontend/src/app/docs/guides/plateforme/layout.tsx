// Layout du volet PLATEFORME (N°304) — noindex strict : la section est
// PRIVÉE (décision exploitant : accès uniquement via le menu profil de la
// sidebar, jamais référencée).

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides plateforme — 403Shield (privé)",
  robots: { index: false, follow: false, nocache: true },
};

export default function PlatformDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
