import type { Metadata } from "next";
import "./globals.css";

// N°317 — rebrand : tunnel.ftci.fr devient « 403Shield Console » (marque
// unifiée 403Shield, maison-mère FTech CI) : la vitrine DOIT être référencée.
// L'indexation reste OUVERTE ici ; les routes PRIVÉES (login, verify, me,
// pro) posent leur propre robots noindex via un mini-layout serveur (elles
// sont des composants clients, incapables d'exporter des metadata).
export const metadata: Metadata = {
  title: "403Shield Console — VPN & tunnels chiffrés",
  description:
    "403Shield Console : achetez votre VPN WireGuard à IP fixe France, gérez vos tunnels et votre Accès Pro (routeurs, caméras, NAS) — sans mot de passe, payable en Mobile Money. Powered by FTech CI.",
  openGraph: {
    title: "403Shield Console · VPN & accès distants",
    description:
      "VPN WireGuard IP fixe France et accès distant Pro — la console 403Shield, payable en Mobile Money.",
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
