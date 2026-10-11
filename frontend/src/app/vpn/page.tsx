// N°301 — route PUBLIQUE de la vitrine « MikCloud VPN » (vente directe
// plateforme, hors zone des gérants) : composant serveur minimal (SEO :
// title + description + indexation OUVERTE — contrairement aux pages
// kiosque, la vitrine DOIT être référencée) qui passe la référence de
// commande éventuelle (?order=MCV-…) au composant client. Next 16 :
// searchParams est une Promise.
import type { Metadata } from "next";
import VpnShopPage from "@/components/vpn-shop/vpn-shop-page";

export const metadata: Metadata = {
  title: "MikCloud VPN — WireGuard, IP fixe France, activation en 30 secondes",
  description:
    "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail, paiement Wave ou carte. Sans compte, activation en 30 secondes.",
  openGraph: {
    title: "MikCloud VPN — VPN WireGuard, IP fixe France",
    description:
      "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default async function VpnShopRoute({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.order;
  const ref = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <VpnShopPage initialOrderRef={ref.trim()} />;
}
