// shop/page.tsx — N°323 — la boutique RETOURNE au site marketing : /shop
// redirige (308 permanent, query ?order= préservée) vers la caisse du site
// 403shield.ftci.fr/checkout. Historique du canal B2C (doctrine N°301 :
// UN seul canal, il déménage sans se dédoubler) : mikcloud.ftci.fr/vpn
// (N°301) → ICI (N°316) → 403shield.ftci.fr/checkout (N°323, modèle OVH :
// on commande sur www, on gère dans le manager). Le composant d'achat vit
// désormais dans frontend/src/components/checkout/ (porté de
// tunnel-console/src/components/shop/, supprimé).
// Les retours GeniusPay en vol (success_url {TUNNEL_PUBLIC_URL}/shop?order=)
// et les liens/e-mails historiques atterrissent ici → 308 → la caisse, avec
// la référence de commande intacte (le suivi y reprend).
import { permanentRedirect } from "next/navigation";

export default async function ShopRoute({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.order;
  const ref = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  permanentRedirect(
    `https://403shield.ftci.fr/checkout${ref ? `?order=${encodeURIComponent(ref)}` : ""}`
  );
}
