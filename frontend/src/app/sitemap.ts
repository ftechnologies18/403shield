// Sitemap public du site (N°333-D) — vitrine + centre de guides.
//
// Les pages docs participent avec leur VRAIE date de mise à jour (guide.updated,
// la même que celle affichée en tête de page — doctrine : aucune fausse
// fraîcheur). Le volet plateforme est EXCLU (noindex, privé). /login, /sell
// et /join restent hors sitemap (surfaces transactionnelles, pas des
// destinations de recherche).

import type { MetadataRoute } from "next";
import { DOC_SECTIONS, PUBLIC_GUIDES } from "@/lib/docs/catalog";

const SITE = "https://403shield.ftci.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const vitrine: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/hotspot`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/vpn`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/tunnels`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/checkout`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/legal/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const hub: MetadataRoute.Sitemap = [
    { url: `${SITE}/docs/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const sections: MetadataRoute.Sitemap = DOC_SECTIONS.map((s) => ({
    url: `${SITE}/docs/guides/${s.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const guides: MetadataRoute.Sitemap = PUBLIC_GUIDES.map((g) => ({
    url: `${SITE}/docs/guides/${g.sectionId}/${g.id}`,
    lastModified: new Date(g.updated),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...vitrine, ...hub, ...sections, ...guides];
}
