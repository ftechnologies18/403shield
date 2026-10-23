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
// commande (?order=MCV-…/MCD-…, préservée par les 308 GeniusPay et le
// redirect console → site), la formule présélectionnée (?plan=, liens des
// cartes tarifs de la vitrine) et le produit (?product=) au composant
// client. Next 16 : searchParams est une Promise.
//
// N°347 — la caisse devient BIPRODUIT : ?product=dns ouvre l'onglet
// bouclier DNS TOURACO (les cartes tarifs de /dns pointent ici avec
// ?product=dns&plan=dns-month|dns-year) ; le retour GeniusPay DNS
// (?order=MCD-…) est reconnu par PRÉFIXE côté client. Les métadonnées
// suivent le produit demandé — SEO honnête : jamais un titre VPN sur une
// caisse DNS.
import type { Metadata } from "next";
import CheckoutPage from "@/components/checkout/checkout-page";

/* Métadonnées VPN (N°323 — inchangées, produit historique de la caisse). */
const VPN_META: Metadata = {
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

/* N°347 — métadonnées DNS : l'abonnement TOURACO étend le bouclier DNS
   (utilisable gratuitement) — 1 000 FCFA/mois ou 10 000 FCFA/an. */
const DNS_META: Metadata = {
  title:
    "Souscrire TOURACO — 403Shield Bouclier DNS (publicité, traçage et malware bloqués)",
  description:
    "L'abonnement TOURACO étend votre bouclier DNS 403Shield : 25 profils de filtrage, 600 règles par liste, 15 logements et 90 jours de journal — 1 000 FCFA/mois ou 10 000 FCFA/an, payable Wave ou carte, sans compte à créer.",
  openGraph: {
    title: "403Shield Bouclier DNS — abonnement TOURACO",
    description:
      "25 profils de filtrage, 600 règles par liste, 15 logements, journal 90 jours — la box comprise, payable Wave ou carte.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

type CheckoutSearchParams = Promise<{
  order?: string | string[];
  plan?: string | string[];
  product?: string | string[];
}>;

/* N°347 — le titre décrit le produit demandé (défaut VPN : la caisse
   historique reste la première porte). */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: CheckoutSearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params.product;
  const product = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  return product === "dns" ? DNS_META : VPN_META;
}

export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: CheckoutSearchParams;
}) {
  const params = await searchParams;
  const pick = (raw?: string | string[]): string =>
    ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
  return (
    <CheckoutPage
      initialOrderRef={pick(params.order)}
      initialPlanId={pick(params.plan)}
      initialProduct={pick(params.product)}
    />
  );
}
