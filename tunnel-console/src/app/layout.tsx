import type { Metadata } from "next";
import "./globals.css";

// N°316 — tunnel.ftci.fr devient LE foyer VPN (achat + espace + Pro) : la
// vitrine DOIT être référencée. L'indexation est OUVERTE ici ; les routes
// PRIVÉES (login, verify, me, pro) posent leur propre robots noindex via un
// mini-layout serveur (elles sont des composants clients, incapables
// d'exporter des metadata).
export const metadata: Metadata = {
  title: "MikTunnel — vos tunnels, simplement",
  description:
    "MikTunnel — by MikCloud : VPN WireGuard IP fixe France et accès distant Pro (routeurs, caméras, NAS), payables en Mobile Money. Achat, gestion et renouvellement au même endroit, sans mot de passe.",
  openGraph: {
    title: "MikTunnel — by MikCloud · VPN & accès distants",
    description:
      "VPN WireGuard IP fixe France et accès distant Pro — la connectivité chiffrée de la maison MikCloud, payable en Mobile Money.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  );
}
