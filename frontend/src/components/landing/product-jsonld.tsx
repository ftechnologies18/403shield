import { landingCopy } from "./landing-copy";

/* ============================================================
   PRODUCT JSON-LD — N°332-B (composant SERVEUR, aucun "use client")
   ------------------------------------------------------------
   Données structurées Product + FAQPage pour les pages produit
   (SEO long-tail « quel routeur pour hotspot Abidjan »…) —
   tirées de la MÊME source que l'UI : landing-copy.ts
   (pricing.segments pour les offres, pages.*.faq pour les
   questions). Aucune double source : le FR est la langue de
   référence des données structurées (marché primaire).
   ============================================================ */

type ProductPageKey = "hotspot" | "vpn" | "tunnels";

const PRICING_SEGMENT: Record<ProductPageKey, "hotspot" | "tunnels"> = {
  hotspot: "hotspot",
  vpn: "tunnels",
  tunnels: "tunnels",
};

export function ProductJsonLd({ page }: { page: ProductPageKey }) {
  const copy = landingCopy.fr;
  const pageCopy = copy.pages[page];
  const segment =
    copy.pricing.segments.find((s) => s.id === PRICING_SEGMENT[page]) ??
    copy.pricing.segments[0];
  const plans = page === "vpn" ? segment.plans.slice(0, 2) : segment.plans;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pageCopy.meta.title.split("—")[0].trim(),
    description: pageCopy.meta.description,
    brand: { "@type": "Brand", name: "403Shield" },
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: Number(p.price.replace(/[^\d]/g, "")) || 0,
      priceCurrency: "XOF",
      availability: "https://schema.org/InStock",
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pageCopy.faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}
