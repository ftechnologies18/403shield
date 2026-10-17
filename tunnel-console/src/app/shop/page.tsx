// shop/page.tsx — N°316 — route PUBLIQUE de la vitrine d'achat (le canal B2C
// a déménagé de mikcloud.ftci.fr/vpn — 301 permanent posé côté Vercel du
// frontend — vers CE foyer : achat, gestion, renouvellement et Accès Pro
// vivent sous une seule marque). N°317 — rebrand « 403Shield » : la boutique
// s'appelle « 403Shield VPN » et vit dans la console 403Shield (tunnel.ftci.fr).
// Composant serveur minimal (SEO : title + description + indexation
// OUVERTE — la vitrine DOIT être référencée) qui passe la référence de
// commande éventuelle (?order=MCV-…, préservée par le 301) au composant
// client. Next 16 : searchParams est une Promise.
import type { Metadata } from "next";
import ShopPage from "@/components/shop/shop-page";

export const metadata: Metadata = {
  title: "Acheter un VPN WireGuard — 403Shield VPN (IP fixe France, activation en 30 s)",
  description:
    "Tunnel WireGuard chiffré vers Marseille : IP française fixe, Wi-Fi public blindé, configuration livrée par e-mail, paiement Wave ou carte. Sans compte, activation en 30 secondes — la console 403Shield, powered by FTech CI.",
  openGraph: {
    title: "403Shield VPN — WireGuard, IP fixe France",
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
