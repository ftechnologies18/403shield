// checkout/page.tsx — N°323 — caisse publique du site unifié 403Shield :
// le canal B2C (vitrine d'achat N°316, ex mikcloud.ftci.fr/vpn → console
// /shop en N°316-322) RETOURNE au site marketing — modèle OVH : on
// commande sur www (403shield.ftci.fr), on gère dans le manager
// (console.403shield.ftci.fr, dont la racine redirige désormais vers
// /login — pattern dash.cloudflare.com). Une seule landing (le site), une
// seule caisse (cette page), une seule entrée console (/login).
//
// Composant serveur minimal (SEO : title + description + indexation
// OUVERTE — l'ancienne /shop de la console était référencée ; son 308
// permanent transfère l'équité vers ICI) qui passe la référence de
// commande (?order=MCV-…, préservée par les 308 GeniusPay et le redirect
// console → site) et la formule présélectionnée (?plan=, liens des cartes
// tarifs de la vitrine) au composant client. Next 16 : searchParams est
// une Promise.
import type { Metadata } from "next";
import CheckoutPage from "@/components/checkout/checkout-page";

export const metadata: Metadata = {
  title: "Acheter un VPN WireGuard — 403Shield VPN (IP fixe France, activation en 30 s)",
  description:
    "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail, paiement Wave ou carte. Sans compte, activation en 30 secondes — 403Shield, powered by FTech CI.",
  openGraph: {
    title: "403Shield VPN — WireGuard, IP fixe France",
    description:
      "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[]; plan?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawOrder = params.order;
  const rawPlan = params.plan;
  const pick = (raw?: string | string[]): string =>
    ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  return <CheckoutPage initialOrderRef={pick(rawOrder)} initialPlanId={pick(rawPlan)} />;
}
