// og:image des index de section (N°333-D) — une image par section.

import { DOC_SECTIONS } from "@/lib/docs/catalog";
import { renderDocsOg, OG_SIZE } from "@/components/docs/docs-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Guides 403Shield — documentation d'exploitation";

export default async function SectionOgImage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = DOC_SECTIONS.find((x) => x.id === section);
  return renderDocsOg({
    kicker: "Section",
    title: s ? s.title : "Guides 403Shield",
    sub: s ? s.description.slice(0, 72) : "Documentation d'exploitation",
  });
}
