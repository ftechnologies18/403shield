// verify/layout.tsx — N°317 — route privée : JAMAIS indexée (noindex posé dès
// N°316, conservé ; titre rebrandé « 403Shield Console »).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "403Shield Console — vérification du code",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
