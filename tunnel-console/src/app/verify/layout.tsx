// verify/layout.tsx — N°317 — route privée : JAMAIS indexée (noindex posé dès
// N°316, conservé ; titre rebrandé « 403Shield Console »).
// N°326 — pose les polices du design system Clay (Manrope + Fraunces),
// comme login/layout.tsx : le parcours d'auth garde UNE seule peau.
import type { Metadata } from "next";
import { fraunces, manrope } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "403Shield Console — vérification du code",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.variable} ${fraunces.variable}`}>{children}</div>;
}
