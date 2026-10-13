import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MikTunnel — vos tunnels, simplement",
  description:
    "MikTunnel : VPN WireGuard et accès distant sécurisés, sans configuration complexe. Console client MikTunnel (powered by FTech CI).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  );
}
