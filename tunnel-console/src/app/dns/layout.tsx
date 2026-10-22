// dns/layout.tsx — N°345 — route privée : JAMAIS indexée (miroir de /pro).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "403Shield Console — Bouclier DNS",
  robots: { index: false, follow: false },
};

export default function DnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
