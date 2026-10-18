import { Fraunces, Manrope } from "next/font/google";

/* ─── Polices display (serif Fraunces) & texte (Manrope) — N°326 ───
   Mêmes instances que la vitrine (frontend/src/components/landing/
   landing-fonts.ts) : les layouts d'auth (/login, /verify) posent les
   variables CSS --font-fraunces / --font-manrope pour le design system
   Clay (.mka-*) — /me et /pro conservent la police système sombre, les
   feuilles ne sont chargées que sur ces deux parcours. */
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
