"use client";

/* ============================================================
   403SHIELD « CLAY » — PAGES PRODUIT v2 (N°332-B)
   ------------------------------------------------------------
   Le plan N°332 volet B fait de chaque page produit une page
   AUTONOME et deep-linkable : la promesse de chaque item des
   méga menus atterrit sur une section entière qui la développe
   (règle d'or : une ancre = une section vendable).
   Ordre : hero (+ badges de confiance VÉRIFIABLES — doctrine :
   aucun faux chiffre, aucun témoignage, consigne propriétaire
   N°332 « éviter témoignages ») → sous-nav sticky d'ancres →
   4 sections features alternées avec ancres (mkl-split) → note
   (VPN) → « comment ça marche » #demarrer → tarifs #tarifs
   (PricingGrid partagé : SOURCE UNIQUE pricing.segments — la
   double source N°331 est morte) → FAQ #faq (objections réelles,
   accordéon natif <details> : zéro JS) → guides liés (maillage
   bidirectionnel avec /docs/guides) → CTA final + partage
   WhatsApp (Web Share API + fallback wa.me — canal n°1 du
   marché ivoirien) → footer + chat widget (monté ici désormais :
   une question sans réponse = visiteur perdu).
   N°325 — EnterpriseHeader + drawer mobile conservés.
   N°332-A — hrefs des méga menus vers /hotspot#portail,
   /hotspot#cybercafe, /vpn#ip-fixe, /tunnels#acces-pro… : le
   composant scroll vers le hash cross-page au montage (le
   routeur App Router gère l'ancre, le timeout couvre les Reveal
   qui décalent le layout).
   ============================================================ */

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Cctv,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Globe,
  KeyRound,
  Lock,
  MessageCircle,
  Palette,
  Router,
  ShieldCheck,
  Store,
  Ticket,
  type LucideProps,
} from "lucide-react";

import { useHotspotStore } from "@/lib/hotspot/store";
import { landingCopy, type Lang, type ProductPageCopy } from "./landing-copy";
import { EnterpriseHeader } from "./enterprise-header";
import { LandingChatWidget } from "./chat-widget";
import { LandingFooter } from "./landing-footer";
import { PricingGrid } from "./pricing-grid";
import { Reveal } from "./reveal";
import { fraunces, manrope } from "./landing-fonts";
import "./landing-clay.css";

export type ProductPageKey = "hotspot" | "vpn" | "tunnels";

/* N°332-B — table statique demandée par le plan : champ icon
   EXPLICITE dans la copy (fin du title.includes fragile — le
   refactor complet de getItemIcon du header suivra en volet D). */
const SECTION_ICONS: Record<ProductPageCopy["features"]["sections"][number]["icon"], ComponentType<LucideProps>> = {
  palette: Palette,
  ticket: Ticket,
  store: Store,
  chart: BarChart3,
  globe: Globe,
  lock: Lock,
  card: CircleDollarSign,
  key: KeyRound,
  router: Router,
  cctv: Cctv,
  console: ShieldCheck,
};

/* N°332-B — chaque page puise SES plans dans pricing.segments
   (source unique) : hotspot → segment console ; vpn → les deux
   formules VPN du segment tunnels ; tunnels → le segment complet
   (VPN + Accès Pro — « un tunnel, deux usages »). */
const PRICING_SEGMENT: Record<ProductPageKey, "hotspot" | "tunnels"> = {
  hotspot: "hotspot",
  vpn: "tunnels",
  tunnels: "tunnels",
};

function PageCta({
  href,
  label,
  variant,
  onSignIn,
  onSignUp,
  arrow = false,
}: {
  href: string;
  label: string;
  variant: "teal" | "cream";
  onSignIn: () => void;
  onSignUp: () => void;
  arrow?: boolean;
}) {
  const cls = `mkl-btn mkl-btn-${variant}`;
  const arrowIcon = arrow ? <ArrowRight className="size-4" /> : null;
  if (href === "#signup") {
    return (
      <button className={cls} onClick={onSignUp} type="button">
        {label}
        {arrowIcon}
      </button>
    );
  }
  if (href === "#signin") {
    return (
      <button className={cls} onClick={onSignIn} type="button">
        {label}
        {arrowIcon}
      </button>
    );
  }
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
        {arrowIcon}
        <span className="sr-only"> — nouvel onglet</span>
      </a>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls}>
        {label}
        {arrowIcon}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {label}
      {arrowIcon}
    </Link>
  );
}

/* N°332-B — partage WhatsApp / Web Share : dans ce marché la
   recommandation se fait par forward WhatsApp ; chaque visiteur
   convaincu devient un canal d'acquisition. */
function ShareButton({ label, title }: { label: string; title: string }) {
  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* annulé par l'utilisateur : silencieux */
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <button type="button" className="mkl-share" onClick={onShare}>
      <MessageCircle className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export interface ProductPageProps {
  page: ProductPageKey;
  onSignIn: () => void;
  onSignUp: () => void;
}

export default function ProductPage({ page, onSignIn, onSignUp }: ProductPageProps) {
  const lang = useHotspotStore((s) => s.lang) as Lang;
  const setLang = useHotspotStore((s) => s.setLang);
  const copy = landingCopy[lang];
  const pageCopy: ProductPageCopy = copy.pages[page];
  const reduce = useReducedMotion();

  const segment =
    copy.pricing.segments.find((s) => s.id === PRICING_SEGMENT[page]) ?? copy.pricing.segments[0];
  const plans = page === "vpn" ? segment.plans.slice(0, 2) : segment.plans;

  const toggleLang = () => setLang(lang === "fr" ? "en" : "fr");

  /* N°332-B — ancre cross-page : les méga menus pointent
     /hotspot#cybercafe, /vpn#ip-fixe… ; on scrobble la cible
     après montage (le routeur gère déjà l'ancre, ce timeout
     couvre le décalage des Reveal). */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [page]);

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const subnavItems = [
    ...pageCopy.features.sections.map((s) => ({ href: `#${s.id}`, label: s.kicker })),
    { href: "#demarrer", label: pageCopy.steps.eyebrow },
    { href: "#tarifs", label: pageCopy.pricing.navLabel },
    { href: "#faq", label: pageCopy.faq.navLabel },
  ];

  return (
    <div className={`mkl-page ${fraunces.variable} ${manrope.variable}`}>
      <div className="mkl-grain" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-1" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-2" aria-hidden="true" />

      <div className="mkl-main">
        {/* Unified Enterprise Header with MegaMenu */}
        <EnterpriseHeader
          lang={lang}
          toggleLang={toggleLang}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
        />

        {/* HERO (+ badges de confiance vérifiables) */}
        <section id="top" className="mkl-hero">
          <div className="mkl-wrap mkl-hero-grid">
            <div>
              <Reveal>
                <span className="mkl-eyebrow">
                  <span className="mkl-pulse" aria-hidden="true" />
                  {pageCopy.hero.badge}
                </span>
              </Reveal>
              <Reveal delay={0.06}>
                <h1>
                  {pageCopy.hero.title1}
                  <br />
                  <em>{pageCopy.hero.titleAccent}</em> {pageCopy.hero.title2}
                </h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mkl-lead">{pageCopy.hero.subtitle}</p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mkl-hero-actions">
                  <PageCta
                    href={pageCopy.hero.ctaPrimaryHref}
                    label={pageCopy.hero.ctaPrimary}
                    variant="teal"
                    onSignIn={onSignIn}
                    onSignUp={onSignUp}
                    arrow
                  />
                  <PageCta
                    href={pageCopy.hero.ctaSecondaryHref}
                    label={pageCopy.hero.ctaSecondary}
                    variant="cream"
                    onSignIn={onSignIn}
                    onSignUp={onSignUp}
                  />
                </div>
              </Reveal>
              {pageCopy.hero.trust?.length ? (
                <Reveal delay={0.24}>
                  <ul className="mkl-trust" aria-label={pageCopy.guides.eyebrow}>
                    {pageCopy.hero.trust.map((t) => (
                      <li key={t}>
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ) : null}
            </div>
            <Reveal delay={0.15}>
              <div className="mkl-cloud-stage" aria-hidden="true">
                <div className="mkl-ring mkl-ring-1" />
                <div className="mkl-ring mkl-ring-2" />
                <div className="mkl-cloud-body">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={280}
                    height={280}
                    priority
                    className="mkl-hero-logo"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* SOUS-NAV STICKY D'ANCRES (pattern Vercel/Linear — le
            visiteur voit toute la page d'un coup d'œil) */}
        <nav className="mkl-pagenav" aria-label={pageCopy.features.eyebrow}>
          <div className="mkl-wrap">
            {subnavItems.map((item) => (
              <a key={item.href} href={item.href} onClick={goTo(item.href.slice(1))}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* FEATURES — 4 sections deep-linkables alternées */}
        <div id="features">
          {pageCopy.features.sections.map((sec, i) => {
            const Icon = SECTION_ICONS[sec.icon] ?? ShieldCheck;
            return (
              <section key={sec.id} id={sec.id}>
                <div className={`mkl-wrap mkl-split${i % 2 === 1 ? " mkl-split-rev" : ""}`}>
                  <Reveal>
                    <span className="mkl-kicker">{sec.kicker}</span>
                    <h2>{sec.title}</h2>
                    <p className="mkl-body">{sec.body}</p>
                    <ul className="mkl-feat-list">
                      {sec.bullets.map((b) => (
                        <li key={b} className="mkl-feat">
                          <div className="mkl-fi" aria-hidden="true">
                            <CheckCircle2 className="size-5" />
                          </div>
                          <p>{b}</p>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                  <Reveal delay={0.1} className="mkl-split-visual">
                    <div className="mkl-panel mkl-feature-panel">
                      <div className="mkl-panel-top" aria-hidden="true">
                        <i /><i /><i />
                      </div>
                      <div className="mkl-feature-icon" aria-hidden="true">
                        <Icon className="size-14" />
                      </div>
                      <p className="mkl-feature-kicker">{sec.kicker}</p>
                    </div>
                  </Reveal>
                </div>
              </section>
            );
          })}
        </div>

        {/* NOTE (VPN) — conservée de la v1 */}
        {pageCopy.note ? (
          <section style={{ paddingTop: 0 }}>
            <div className="mkl-wrap">
              <Reveal>
                <div className="mkl-panel">
                  <div className="mkl-panel-top" aria-hidden="true">
                    <i /><i /><i />
                  </div>
                  <h3 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>
                    {pageCopy.note.title}
                  </h3>
                  <p style={{ color: "rgba(18, 59, 58, 0.72)", margin: 0 }}>
                    {pageCopy.note.body}
                  </p>
                </div>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* COMMENT ÇA MARCHE — le parcours AVANT l'argent */}
        <section id="demarrer">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{pageCopy.steps.eyebrow}</span>
              <h2>{pageCopy.steps.title}</h2>
            </Reveal>
            <Reveal>
              <ol className="mkl-steps">
                {pageCopy.steps.items.map((step, i) => (
                  <li key={step.title} className="mkl-step">
                    <span className="mkl-step-num" aria-hidden="true">{i + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        {/* TARIFS — PricingGrid partagé (source unique pricing.segments) */}
        <section id="tarifs">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{pageCopy.pricing.eyebrow}</span>
              <h2>{pageCopy.pricing.title}</h2>
              <p>{pageCopy.pricing.subtitle}</p>
            </Reveal>
            <PricingGrid
              plans={plans}
              currencyNote={copy.pricing.currencyNote}
              onCta={onSignUp}
            />
          </div>
        </section>

        {/* FAQ — objections réelles, accordéon natif zéro JS */}
        <section id="faq">
          <div className="mkl-wrap mkl-faq-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{pageCopy.faq.eyebrow}</span>
              <h2>{pageCopy.faq.title}</h2>
            </Reveal>
            <div className="mkl-faq">
              {pageCopy.faq.items.map((item, i) => (
                <Reveal key={item.q} delay={Math.min(i, 3) * 0.05}>
                  <details className="mkl-faq-item">
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* GUIDES LIÉS — maillage bidirectionnel avec /docs/guides */}
        <section id="guides">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{pageCopy.guides.eyebrow}</span>
              <h2>{pageCopy.guides.title}</h2>
            </Reveal>
            <div className="mkl-guides">
              {pageCopy.guides.items.map((g, i) => (
                <Reveal key={g.href} delay={i * 0.06} className="h-full">
                  <Link href={g.href} className="mkl-guide">
                    <span className="mkl-guide-title">{g.title}</span>
                    <span className="mkl-guide-desc">{g.desc}</span>
                    <span className="mkl-guide-arrow" aria-hidden="true">
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                </Reveal>
              ))}
              <Reveal delay={0.2} className="h-full">
                <Link href="/docs/guides" className="mkl-guide mkl-guide-all">
                  <span className="mkl-guide-title">{pageCopy.guides.allLabel}</span>
                  <span className="mkl-guide-arrow" aria-hidden="true">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA FINAL + partage */}
        <section id="cta" style={{ paddingTop: 0 }}>
          <Reveal>
            <div className="mkl-cta">
              <Cloud className="mkl-mini-cloud mkl-mc1 size-10" aria-hidden="true" />
              <Cloud className="mkl-mini-cloud mkl-mc2 size-12" aria-hidden="true" />
              <Cloud className="mkl-mini-cloud mkl-mc3 size-7" aria-hidden="true" />
              <span className="mkl-kicker">{pageCopy.cta.kicker}</span>
              <h2>{pageCopy.cta.title}</h2>
              <p>{pageCopy.cta.body}</p>
              <div className="mkl-cta-actions">
                <PageCta
                  href={pageCopy.cta.primaryHref}
                  label={pageCopy.cta.primary}
                  variant="teal"
                  onSignIn={onSignIn}
                  onSignUp={onSignUp}
                  arrow
                />
                <PageCta
                  href={pageCopy.cta.secondaryHref}
                  label={pageCopy.cta.secondary}
                  variant="cream"
                  onSignIn={onSignIn}
                  onSignUp={onSignUp}
                />
              </div>
              <ShareButton label={pageCopy.share} title={pageCopy.meta.title} />
            </div>
          </Reveal>
        </section>

        {/* FOOTER + CHAT (monté ici désormais — N°332-B) */}
        <LandingFooter copy={copy} variant="product" />
      </div>

      <LandingChatWidget />
    </div>
  );
}
