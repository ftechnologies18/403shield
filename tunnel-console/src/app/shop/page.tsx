// shop/page.tsx — N°316 — route PUBLIQUE de la vitrine d'achat « MikTunnel
// VPN » : le canal B2C déménage de mikcloud.ftci.fr/vpn (301 permanent
// posé côté Vercel du frontend MikCloud) vers CE foyer — achat, gestion,
// renouvellement et Accès Pro vivent désormais sous UNE seule marque
// (arbitrage N°316 — option C : maison MikCloud, sous-marque MikTunnel).
// Composant serveur minimal (SEO : title + description + indexation
// OUVERTE — la vitrine DOIT être référencée) qui passe la référence de
// commande éventuelle (?order=MCV-…, préservée par le 301) au composant
// client. Next 16 : searchParams est une Promise.
import type { Metadata } from "next";
import ShopPage from "@/components/shop/shop-page";

export const metadata: Metadata = {
  title: "Acheter un VPN WireGuard — MikTunnel (IP fixe France, activation en 30 s)",
  description:
    "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail, paiement Wave ou carte. Sans compte, activation en 30 secondes — MikTunnel, by MikCloud.",
  openGraph: {
    title: "MikTunnel VPN — WireGuard, IP fixe France",
    description:
      "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default async function ShopRoute({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.order;
  const ref = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <ShopPage initialOrderRef={ref.trim()} />;
}
