// JSON-LD des pages de guide (N°333-D) — un seul bloc @graph :
//   · BreadcrumbList — reflète le fil d'Ariane VISIBLE (Guides › Section ›
//     Page, exigence Google : le markup doit correspondre à la nav réelle) ;
//   · TechArticle — headline, description, dateModified (la VRAIE date du
//     guide, celle affichée en tête de page), langue, éditeur ;
//   · FAQPage — le gabarit Q&A est du vrai contenu question→réponse visible
//     (marquage sémantique quasi gratuit — Google ne montre plus les rich
//     results FAQ que pour les sites gouvernementaux/santé, aucun gain SERP
//     garanti, zéro risque).
// HowTo volontairement absent : rich results retirés par Google (2023).

import type { Guide } from "@/lib/docs/types";

const SITE = "https://403shield.ftci.fr";

export function DocsJsonLd({ guide, sectionTitle }: { guide: Guide; sectionTitle: string }) {
  const pageUrl = `${SITE}/docs/guides/${guide.sectionId}/${guide.id}`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Guides", item: `${SITE}/docs/guides` },
        { "@type": "ListItem", position: 2, name: sectionTitle, item: `${SITE}/docs/guides/${guide.sectionId}` },
        { "@type": "ListItem", position: 3, name: guide.title, item: pageUrl },
      ],
    },
    {
      "@type": "TechArticle",
      headline: guide.title,
      description: guide.summary,
      inLanguage: "fr",
      dateModified: guide.updated,
      author: { "@type": "Organization", name: "FTech CI" },
      publisher: { "@type": "Organization", name: "403Shield — FTech CI" },
      mainEntityOfPage: pageUrl,
    },
  ];

  if (guide.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: guide.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
