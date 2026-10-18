"use client";

/* ============================================================
   PRICING GRID — N°332-B : SOURCE UNIQUE DES CARTES TARIFAIRES
   ------------------------------------------------------------
   Refactor du bloc tarifs de landing-page.tsx (l.775-826) en
   composant partagé : la vitrine / (#tarifs, avec son sélecteur
   2 segments) ET les pages produits v2 (#tarifs par page) rendent
   LES MÊMES cartes à partir des MÊMES données (pricing.segments
   de landing-copy.ts) — fin de la double source de prix pointée
   par le plan N°332 (vigilance N°331).
   Les plans sans href (formules console hotspot) déclenchent le
   callback onCta (modale d'inscription sur /, même comportement
   que la home historique).
   ============================================================ */

import Link from "next/link";

import { Reveal } from "./reveal";

export interface PricingPlanData {
  name: string;
  price: string;
  period: string;
  tagline: string;
  cta: string;
  highlight: boolean;
  features: string[];
  badge?: string;
  href?: string;
}

export function PricingGrid({
  plans,
  currencyNote,
  onCta,
  reveal = true,
}: {
  plans: PricingPlanData[];
  currencyNote?: string;
  /** Action des plans sans href (modale signup sur la home et /hotspot). */
  onCta?: () => void;
  /** false sur les pages produit v2 : chaque section porte déjà son Reveal. */
  reveal?: boolean;
}) {
  const duo = plans.length === 2;
  return (
    <>
      <div className={`mkl-pricing${duo ? " mkl-pricing-duo" : ""}`}>
        {plans.map((plan, i) => {
          const card = (
            <article className={`mkl-price-card mkl-pc${i + 1} h-full`}>
              {plan.highlight && plan.badge ? <span className="mkl-pop">{plan.badge}</span> : null}
              <h3>{plan.name}</h3>
              <p className="mkl-tagline">{plan.tagline}</p>
              <div className="mkl-amount">
                {plan.price} <small>{plan.period}</small>
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {plan.href ? (
                plan.href.startsWith("http") ? (
                  <a
                    className={`mkl-btn ${plan.highlight ? "mkl-btn-cream" : "mkl-btn-teal"}`}
                    style={{ justifyContent: "center" }}
                    href={plan.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {plan.cta}
                    <span className="sr-only"> — nouvel onglet</span>
                  </a>
                ) : (
                  <Link
                    className={`mkl-btn ${plan.highlight ? "mkl-btn-cream" : "mkl-btn-teal"}`}
                    style={{ justifyContent: "center" }}
                    href={plan.href}
                  >
                    {plan.cta}
                  </Link>
                )
              ) : (
                <button
                  className={`mkl-btn ${plan.highlight ? "mkl-btn-cream" : "mkl-btn-teal"}`}
                  style={{ justifyContent: "center" }}
                  onClick={onCta}
                  type="button"
                >
                  {plan.cta}
                </button>
              )}
            </article>
          );
          return reveal ? (
            <Reveal key={plan.name} delay={i * 0.08} className="h-full">
              {card}
            </Reveal>
          ) : (
            <div key={plan.name} className="h-full">
              {card}
            </div>
          );
        })}
      </div>
      {currencyNote ? <p className="mkl-currency-note">{currencyNote}</p> : null}
    </>
  );
}
