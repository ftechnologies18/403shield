import type { NextConfig } from "next";

// tunnel-console — N°313 — console « tunnel » séparée (Programme Tunnel,
// décision D-T3) : app Next.js DÉDIÉE dans le monorepo (projet Vercel séparé,
// root = tunnel-console/ — le projet mikcloud existant, root frontend/, n'est
// pas touché par ce dossier). L'API est appelée EN DIRECT via
// NEXT_PUBLIC_API_BASE (CORS ouverte côté backend — cf. corsMiddleware de
// routes.go) ; le proxy dev ci-dessous ne sert qu'au développement local.
const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    if (process.env.TUNNEL_DEV_API_PROXY !== "1") return [];
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

export default nextConfig;
