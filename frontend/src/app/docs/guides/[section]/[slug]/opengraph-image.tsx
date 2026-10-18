// og:image des pages de guide (N°333-D) — une image par guide, rendue au
// build avec la page (les params viennent du generateStaticParams de la
// page parente — aucune liste locale à maintenir).

import { getPublicGuide } from "@/lib/docs/catalog";
import { renderDocsOg, OG_SIZE } from "@/components/docs/docs-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Guides 403Shield — documentation d'exploitation";

export default async function GuideOgImage({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  const guide = getPublicGuide(slug);
  const kicker = guide && guide.sectionId === section ? "Guide" : "Guides 403Shield";
  return renderDocsOg({
    kicker,
    title: guide ? guide.title : "Guides 403Shield",
    sub: guide ? `${guide.minutes} min de lecture · mis à jour le ${guide.updated}` : "Documentation d'exploitation",
  });
}
