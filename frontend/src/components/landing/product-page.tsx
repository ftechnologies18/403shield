"use client";

/* ============================================================
   403SHIELD « CLAY » — Pages produit du site unifié (N°317)
   ------------------------------------------------------------
   Composant client réutilisable monté par les routes marketing
   /hotspot, /vpn et /tunnels (voie Cloudflare/OVH : UN site
   multipage + UNE console transactionnelle). Réutilise le design
   system Clay de la vitrine (landing-clay.css, classes mkl-*) :
   grain + halos, topbar avec menu complet (Accueil en premier,
   lien actif souligné via usePathname), hero simplifié avec le
   bouclier clay, grille de cartes « super-pouvoirs », CTA final
   et footer partagé (LandingFooter).
   Contenu : UNIQUEMENT des fonctionnalités réelles (cf.
   landing-copy.ts — bloc pages.*) — les prix VPN viennent de la
   boutique, rien n'est codé en dur ici.
   Pages publiques : visitables même connecté (pas de garde de
   session/PWA — contrairement à la vitrine /).
   ============================================================ */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BarChart3,
  Cctv,
  CircleDollarSign,
  Cloud,
  Globe,
  KeyRound,
  Lock,
  Palette,
  Router,
  Send,
  ShieldCheck,
  Store,
  Ticket,
  type LucideProps,
} from "lucide-react";

import { useHotspotStore } from "@/lib/hotspot/store";
import { landingCopy, type Lang, type ProductPageCopy } from "./landing-copy";
import { LandingFooter } from "./landing-footer";
import { Reveal } from "./reveal";
import { fraunces, manrope } from "./landing-fonts";
import "./landing-clay.css";

export type ProductPageKey = "hotspot" | "vpn" | "tunnels";

/* ─── Icônes des cartes « ce que fait le produit » (par page) ─── */
const PAGE_ICONS: Record<ProductPageKey, ComponentType<LucideProps>[]> = {
  hotspot: [Palette, Ticket, Store, BarChart3],
  vpn: [Globe, Lock, CircleDollarSign, KeyRound],
  tunnels: [Send, Router, Cctv, KeyRound],
};

/* ─── Résolution des CTA (hero + CTA final) ───
   "#signup" → modale d'inscription ; "#signin" → /login ;
   URL http(s) → nouvel onglet ; sinon <Link> interne. */
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
      <button className={cls} onClick={onSignUp}>
        {label}
        {arrowIcon}
      </button>
    );
  }
  if (href === "#signin") {
    return (
      <button className={cls} onClick={onSignIn}>
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
  return (
    <Link href={href} className={cls}>
      {label}
      {arrowIcon}
    </Link>
  );
}

export interface ProductPageProps {
  page: ProductPageKey;
  /** Déclenche l'écran de connexion (/login). */
  onSignIn: () => void;
  /** Ouvre la modale d'inscription (SignupModal). */
  onSignUp: () => void;
}

export default function ProductPage({ page, onSignIn, onSignUp }: ProductPageProps) {
  const lang = useHotspotStore((s) => s.lang) as Lang;
  const setLang = useHotspotStore((s) => s.setLang);
  const copy = landingCopy[lang];
  const pageCopy: ProductPageCopy = copy.pages[page];
  const pathname = usePathname();
  const icons = PAGE_ICONS[page];

  const toggleLang = () => setLang(lang === "fr" ? "en" : "fr");

  /* Menu complet du site unifié : Accueil EN PREMIER, puis les pages
     produit — lien actif souligné (classe mkl-active, cf. landing-clay.css). */
  const navItems: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: copy.header.nav.home, active: pathname === "/" },
    { href: "/hotspot", label: copy.header.nav.hotspot, active: pathname === "/hotspot" },
    { href: "/vpn", label: copy.header.nav.vpn, active: pathname === "/vpn" },
    { href: "/tunnels", label: copy.header.nav.tunnels, active: pathname === "/tunnels" },
  ];
  const navAriaLabel = `${copy.header.brand} — ${copy.header.nav.home} · ${copy.header.nav.hotspot} · ${copy.header.nav.vpn} · ${copy.header.nav.tunnels}`;
  const navClass = (active: boolean) =>
    active ? "mkl-link-quiet mkl-active" : "mkl-link-quiet";

  return (
    <div className={`mkl-page ${fraunces.variable} ${manrope.variable}`}>
      {/* Grain + halos FreeTech */}
      <div className="mkl-grain" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-1" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-2" aria-hidden="true" />

      <div className="mkl-main">
        {/* ═══ TOPBAR (identique vitrine : brand → /, nav complète,
            lang, signIn, signUp — pas de rail vertical ici) ═══ */}
        <div className="mkl-topbar">
          <div className="mkl-wrap flex items-center justify-between py-5">
            <Link href="/" className="mkl-brand" aria-label={copy.header.homeLink}>
              <Image
                src="/logo.png"
                alt="Logo 403Shield"
                width={84}
                height={84}
                priority
                className="mkl-brand-logo"
              />
              {copy.header.brand}
            </Link>
            <div className="flex items-center gap-2">
              {/* N°317 — nav complète : Accueil en premier, page courante
                  soulignée. Cachée sous sm (et sous 860 px par la règle
                  .mkl-topbar .mkl-link-quiet de landing-clay.css) : la barre
                  secondaire ci-dessous prend le relais sur mobile. */}
              <nav className="hidden items-center gap-2 sm:flex" aria-label={navAriaLabel}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navClass(item.active)}
                    aria-current={item.active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/#tarifs" className="mkl-link-quiet">
                  {copy.header.nav.pricing}
                </Link>
              </nav>
              <button className="mkl-lang" onClick={toggleLang} aria-label="Switch language">
                {copy.header.langLabel}
              </button>
              <button className="mkl-link-quiet" onClick={onSignIn}>
                {copy.header.signIn}
              </button>
              <button className="mkl-btn mkl-btn-teal mkl-btn-sm" onClick={onSignUp}>
                {copy.header.signUp} <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
          {/* N°317 — barre secondaire fine (< sm) : Accueil · Hotspot ·
              VPN · Tunnels, scrollable horizontalement si besoin. Placée
              dans le topbar sticky (la règle .mkl-topbar .mkl-link-quiet
              du mobile est levée pour .mkl-subnav, cf. landing-clay.css). */}
          <nav
            className="mkl-subnav overflow-x-auto sm:hidden"
            aria-label={navAriaLabel}
          >
            <div className="mkl-wrap flex items-center gap-1 py-1.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navClass(item.active)}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* ═══ HERO ═══ */}
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
            </div>
            <Reveal delay={0.15}>
              {/* Mise en scène simplifiée du CloudStage : deux anneaux +
                  le bouclier clay — décoratif, conteneur aria-hidden. */}
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

        {/* ═══ CE QUE FAIT LE PRODUIT (cartes super-pouvoirs) ═══ */}
        <section id="features">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{pageCopy.features.eyebrow}</span>
              <h2>{pageCopy.features.title}</h2>
            </Reveal>
            {/* Grille 2×2 (adaptation N°317 de la grille 3 colonnes de la
                vitrine : mêmes cartes mkl-power, mêmes couleurs clay). */}
            <div className="grid gap-6 md:grid-cols-2">
              {pageCopy.features.cards.map((card, i) => {
                const Icon = icons[i] ?? ShieldCheck;
                return (
                  <Reveal key={card.title} delay={i * 0.08} className="h-full">
                    <article className={`mkl-power mkl-p${(i % 3) + 1} h-full`}>
                      <div className="mkl-icon" aria-hidden="true">
                        <Icon className="size-7" />
                      </div>
                      <h3>{card.title}</h3>
                      <p>{card.desc}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ NOTE (VPN uniquement : formules & boutique) ═══ */}
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

        {/* ═══ CTA FINAL (même pattern que la vitrine) ═══ */}
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
            </div>
          </Reveal>
        </section>

        {/* ═══ FOOTER (composant partagé — variante page produit) ═══ */}
        <LandingFooter copy={copy} variant="product" />
      </div>
    </div>
  );
}
