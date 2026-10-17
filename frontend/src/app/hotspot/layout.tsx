import type { Metadata } from "next";
import { landingCopy } from "@/components/landing/landing-copy";

/* N°317 — /hotspot : métadonnées de la page produit Hotspot du site
   unifié 403Shield. landing-copy.ts est un module de données pur (aucun
   hook, aucun import client) : importable côté serveur. Page marketing
   publique → indexable (pas de noindex). */
const meta = landingCopy.fr.pages.hotspot.meta;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.description,
    type: "website",
  },
};

export default function HotspotLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
