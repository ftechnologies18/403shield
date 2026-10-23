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

/* N°347 — dns rejoint les pages produit (vitrine du bouclier DNS
   TOURACO) : le segment dns ne vit que dans landing-copy. */
type ProductPageKey = "hotspot" | "vpn" | "tunnels" | "dns";

const PRICING_SEGMENT: Record<ProductPageKey, "hotspot" | "tunnels" | "dns"> = {
  hotspot: "hotspot",
  vpn: "tunnels",
  tunnels: "tunnels",
  dns: "dns",
};

export function ProductJsonLd({ page }: { page: ProductPageKey }) {
  const copy = landingCopy.fr;
  const pageCopy = copy.pages[page];
  const segment =
    copy.pricing.segments.find((s) => s.id === PRICING_SEGMENT[page]) ??
    copy.pricing.segments[0];
  /* N°347 — dns : le tiers Gratuit (0 F) n'est pas une OFFRE du produit
     TOURACO — les données structurées ne portent que les formules payées
     (mensuel/annuel), comme le VPN n'expose que ses deux formules. */
  const plans =
    page === "vpn"
      ? segment.plans.slice(0, 2)
      : page === "dns"
        ? segment.plans.filter((p) => (Number(p.price.replace(/[^\d]/g, "")) || 0) > 0)
        : segment.plans;

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
