import type { Metadata } from "next";
import { landingCopy } from "@/components/landing/landing-copy";

/* N°317 — /vpn : métadonnées de la page produit VPN du site unifié
   403Shield. landing-copy.ts est un module de données pur (aucun hook,
   aucun import client) : importable côté serveur. Page marketing
   publique → indexable (pas de noindex). Les prix VPN ne sont PAS dans
   la copie : la page renvoie à la boutique pour les prix live. */
const meta = landingCopy.fr.pages.vpn.meta;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.description,
    type: "website",
  },
};

export default function VpnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
