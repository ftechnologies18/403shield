import type { Metadata } from "next";
import { landingCopy } from "@/components/landing/landing-copy";
import { ProductJsonLd } from "@/components/landing/product-jsonld";

/* N°347 — /dns : métadonnées de la page produit Bouclier DNS TOURACO du
   site unifié 403Shield (miroir de /vpn, N°317). landing-copy.ts est un
   module de données pur (aucun hook, aucun import client) : importable
   côté serveur. Page marketing publique → indexable (pas de noindex).
   Les tarifs vivent dans pricing.segments (segment « dns ») — la page
   elle-même n'en porte aucun en dur (doctrine SOURCE UNIQUE N°332-B).
   N°347 — + JSON-LD Product/FAQPage (offres = formules TOURACO payées). */
const meta = landingCopy.fr.pages.dns.meta;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.description,
    type: "website",
  },
};

export default function DnsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <ProductJsonLd page="dns" />
    </>
  );
}
