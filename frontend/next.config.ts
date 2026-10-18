import type { NextConfig } from "next";
import { PUBLIC_GUIDES } from "./src/lib/docs/catalog";

const nextConfig: NextConfig = {
  /* N°38 — suppression de output: "standalone" : sur Vercel, le builder
     attend .next/next-server.js.nft.json (traçage Node) que le build
     Turbopack + standalone ne produit plus au bon emplacement → ENOENT
     systématique en fin de build (8 déploiements production en échec
     depuis le 06/09 01:00, même avec cache purgé). Standalone n'a aucune
     utilité ici : le frontend est servi par le runtime géré Vercel (aucun
     Dockerfile frontend) et l'E2E Playwright démarre via `next start`.
     Le mode dev (`bun run dev`) n'est pas impacté. */
  /* N°84 — ignoreBuildErrors retiré (héritage du template initial 8cd2e40,
     jamais une décision du projet — N°38 l'avait laissé « intact » sans le
     questionner) : or le webhook Vercel déploie dès le push `main`,
     indépendamment de la CI — avec ce flag, une régression de types
     atteignait la production avant même que le job tsgo de la CI ne
     rougisse. Le build type-check désormais (tsc), en plus du tsgo de la
     CI — triple barrière locale + CI + build. */
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "localhost", "127.0.0.1"],
  /* POC refonte UI (N°298) — proxy API local uniquement : activé par
     MIKCLOUD_DEV_API_PROXY=1 (dev local / sandbox). En production Vercel,
     la variable est absente → aucune réécriture (mode direct via
     NEXT_PUBLIC_API_BASE inchangé). Aucun impact contrat d'API. */
  /* N°333-C — URLs hiérarchiques des guides : les 32 anciennes URLs à plat
     /docs/guides/<slug> redirigent en 301 vers /docs/guides/<section>/<slug>
     (plan de réorganisation du centre de guides — map dérivée du catalogue,
     zéro maintenance manuelle : un guide déplacé met à jour la redirection au
     rebuild). /docs nu rejoint le hub. Les 301 préservent le capital SEO et
     les deep-links partagés par le support (règle d'or N°333). */
  async redirects() {
    return [
      { source: "/docs", destination: "/docs/guides", statusCode: 301 },
      ...PUBLIC_GUIDES.map((g) => ({
        source: `/docs/guides/${g.id}`,
        destination: `/docs/guides/${g.sectionId}/${g.id}`,
        statusCode: 301,
      })),
    ];
  },

  async rewrites() {
    if (process.env.MIKCLOUD_DEV_API_PROXY !== "1") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
