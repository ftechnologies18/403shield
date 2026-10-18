// og:image du hub des guides (N°333-D) — image de marque du centre.

import { renderDocsOg, OG_SIZE } from "@/components/docs/docs-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Guides 403Shield — documentation d'exploitation";

export default function HubOgImage() {
  return renderDocsOg({
    kicker: "Documentation",
    title: "Guides 403Shield",
    sub: "Chaque fonction de la console expliquée pas à pas, captures réelles.",
  });
}
