import { Fraunces, Manrope } from "next/font/google";

/* ─── Polices display (serif Fraunces) & texte (Manrope) ───
   N°317 — instances partagées entre la vitrine (landing-page.tsx) et les
   pages produit du site unifié (product-page.tsx) : une seule déclaration
   de variable CSS (--font-fraunces / --font-manrope) pour tout le design
   system Clay. */
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
