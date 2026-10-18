import type { Metadata } from "next";
import { landingCopy } from "@/components/landing/landing-copy";
import { ProductJsonLd } from "@/components/landing/product-jsonld";

/* N°317 — /tunnels : métadonnées de la page produit Tunnels du site
   unifié 403Shield. landing-copy.ts est un module de données pur (aucun
   hook, aucun import client) : importable côté serveur. Page marketing
   publique → indexable (pas de noindex).
   N°332-B — + JSON-LD Product/FAQPage (même source que l'UI). */
const meta = landingCopy.fr.pages.tunnels.meta;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.description,
    type: "website",
  },
};

export default function TunnelsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <ProductJsonLd page="tunnels" />
    </>
  );
}
