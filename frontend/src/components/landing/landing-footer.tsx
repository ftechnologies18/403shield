"use client";

/* ============================================================
   LANDING FOOTER 403SHIELD « CLAY » (N°317)
   ------------------------------------------------------------
   Pied de page partagé entre la vitrine (landing-page.tsx) et les
   pages produit du site unifié (product-page.tsx — /hotspot, /vpn,
   /tunnels). Rend la tagline, les colonnes (copy.footer.columns),
   le lien légal et le crédit FTech (comportement FtciCredit
   inchangé : lien externe ftci.fr, nouvel onglet).

   Résolution des liens :
   - href commençant par « http »          → <a target="_blank" rel="noopener noreferrer"> ↗
   - href interne (ex. « /hotspot »)       → <Link>
   - ancre interne « /#protection »        → <Link> ; depuis la page d'accueil,
     le scroll est intercepté pour rester doux (comportement historique du
     footer vitrine) ; depuis une page produit, le lien navigue vers « / »
     puis saute à l'ancre — les ancres fonctionnent partout.
   ============================================================ */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";

import { FtciCredit } from "@/components/ftci-credit";
import type { LandingCopy } from "./landing-copy";

export interface LandingFooterProps {
  copy: LandingCopy;
  /**
   * « landing » (défaut) : le bloc de marque scrolle en douceur vers #top
   * (comportement historique du footer vitrine) ; « product » : il renvoie
   * vers la racine du site via <Link>.
   */
  variant?: "landing" | "product";
}

export function LandingFooter({ copy, variant = "landing" }: LandingFooterProps) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const onHome = pathname === "/";

  /* Scroll doux vers le haut de la vitrine (variante landing). */
  const goToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById("top")
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  /* Ancres « /#section » : sur la page d'accueil on scrolle sans naviguer
     (la page est déjà là) ; ailleurs, le <Link> fait la navigation.
     Les liens internes classiques (/login, /hotspot…) ne sont JAMAIS
     interceptés — seule la forme « /#… » l'est. */
  const anchorOnHome = (href: string) => (e: React.MouseEvent) => {
    if (!onHome || !href.startsWith("/#")) return;
    e.preventDefault();
    document
      .getElementById(href.slice(2))
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <footer className="mkl-footer">
      <div className="mkl-wrap">
        <div className="mkl-foot-grid">
          <div>
            {variant === "landing" ? (
              <a href="#top" onClick={goToTop} className="mkl-brand" style={{ marginBottom: 14 }}>
                <Image
                  src="/logo.png"
                  alt="Logo 403Shield"
                  width={84}
                  height={84}
                  className="mkl-brand-logo"
                />
                {copy.header.brand}
              </a>
            ) : (
              <Link href="/" className="mkl-brand" style={{ marginBottom: 14 }}>
                <Image
                  src="/logo.png"
                  alt="Logo 403Shield"
                  width={84}
                  height={84}
                  className="mkl-brand-logo"
                />
                {copy.header.brand}
              </Link>
            )}
            <p className="mkl-foot-tagline">{copy.footer.tagline}</p>
          </div>
          {copy.footer.columns.map((col) => (
            <div key={col.title}>
              <h5>{col.title}</h5>
              {col.links.map((link) =>
                link.href.startsWith("http") ? (
                  // N°317 — liens écosystème externes (ftci.fr, console, boutique).
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label} ↗
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={anchorOnHome(link.href)}
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mkl-foot-bottom">
          <FtciCredit className="text-xs" />
        </div>
      </div>
    </footer>
  );
}
