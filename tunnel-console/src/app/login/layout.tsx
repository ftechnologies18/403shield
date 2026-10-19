// login/layout.tsx — N°317 — route privée : JAMAIS indexée (noindex posé dès
// N°316, conservé ; titre rebrandé « 403Shield Console »).
// N°326 — pose les polices du design system Clay (Manrope + Fraunces,
// mêmes instances que la vitrine) pour CE parcours uniquement : /me
// (N°334-B) et /pro (N°337), mondes clairs « console », gardent la
// police système.
import type { Metadata } from "next";
import { fraunces, manrope } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "403Shield Console — connexion",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.variable} ${fraunces.variable}`}>{children}</div>;
}
