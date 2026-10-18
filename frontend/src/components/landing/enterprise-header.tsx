"use client";

/* ============================================================
   ENTERPRISE HEADER — MegaMenu Produits/Solutions/Tarifs + drawer
   ------------------------------------------------------------
   N°325 — composant du PR #70 « Enterprise Multi-Page Landing Page
   Redesign » (Jules), intégré par le tuteur avec renforcements.
   N°331 — RÉORGANISATION DEMANDÉE PAR LE PROPRIÉTAIRE (« le logo et le
   nom du site semblent collés au menu » + « Tarifs en mega menu où
   chaque service affiche ses tarifs ») :
   (1) RESPIRATIONS GARANTIES — la nav desktop passe de lg (1024) à
   xl (1280) : à 1024-1279 le rail latéral fixe mange déjà 104 px
   (.mkl-main padding-left) et la rangée était SATURÉE (gaps mesurés
   0 px à 1024, 14 px à 1280 en prod) → hamburger + drawer complet
   jusqu'à 1279, nav + « Se connecter » ≥ 1280 où l'air existe enfin
   (gaps cible ~50 px à 1280, ~72 px à 1440) ; plancher de gap
   xl:gap-[clamp(12px,1.5vw,24px)] sur la rangée (jamais < xl : le
   mobile 390 doit garder son rangement actuel) ; liens de nav
   resserrés par la règle CSS scopée .mkl-topbar nav .mkl-link-quiet
   (padding 14 → 11 px — les classes Tailwind px-3 étaient des
   no-op : .mkl-link-quiet non-layeré gagne la cascade) ; wrap
   1180 → 1216 px (landing-clay.css).
   (2) MEGA MENU TARIFS — le lien plat /#tarifs devient bouton +
   chevron (même mécanique que Produits/Solutions : intention hover
   150 ms, clic, Escape, fermeture route, aria-expanded, panneau
   clampé min(780px, 100vw-3rem)) affichant 3 cartes de service avec
   leurs PRIX RÉELS (Hotspot & Cybercafé dès 2 500 F/mois · 25 000
   F/an ; VPN 1 500 F/mois · 15 000 F/an ; Accès Pro 3 500 F/mois ·
   35 000 F/an) + pied « Comparer toutes les formules » → /#tarifs
   (la section complète reste la référence). Copy :
   header.megaMenu.pricing (FR/EN) — valeurs synchronisées sur
   pricing.segments et les constantes produit publiques.
   (3) DRAWER EN ACCORDÉON — < 1280 : Accueil · Produits ▾ (6 items
   par catégories) · Solutions ▾ (4 items) · Tarifs ▾ (3 services
   avec prix + comparer) · Guides & Docs + boutons auth — parité
   complète avec la nav desktop (le drawer n'avait ni Produits ni
   Solutions : à 1024-1279 ils seraient devenus inaccessibles).
   ============================================================ */

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Wifi,
  Router,
  Monitor,
  Server,
  Globe,
  Building2,
  Users,
  Cctv,
} from "lucide-react";
import { landingCopy, type Lang } from "./landing-copy";

export interface HeaderProps {
  lang: Lang;
  toggleLang: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export function EnterpriseHeader({ lang, toggleLang, onSignIn, onSignUp }: HeaderProps) {
  const copy = landingCopy[lang];
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<"products" | "solutions" | "pricing" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /* N°331 — section ouverte du drawer accordéon (Produits/Solutions/Tarifs). */
  const [mobileSection, setMobileSection] = useState<"products" | "solutions" | "pricing" | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (menu: "products" | "solutions" | "pricing") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /* N°325 — fermeture au changement de route : pattern « ajustement pendant
      le rendu » (React) — pas de setState direct dans un effet. */
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
    setActiveMenu(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeMenus = () => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
    setMobileSection(null);
  };

  /* N°331 — bascule d'une section du drawer accordéon. */
  const toggleMobileSection = (section: "products" | "solutions" | "pricing") => {
    setMobileSection(mobileSection === section ? null : section);
  };

  const getItemIcon = (title: string) => {
    if (title.includes("Hotspot") || title.includes("WiFi")) return Wifi;
    if (title.includes("Cybercafé")) return Monitor;
    if (title.includes("PPPoE") || title.includes("ISP")) return Server;
    if (title.includes("Protection") || title.includes("Shield")) return ShieldCheck;
    /* N°332-A — scission de l'item fusionné : le VPN personnel et
       l'Accès Pro deviennent deux promesses distinctes du méga menu. */
    if (title.includes("VPN")) return Globe;
    if (title.includes("Accès Pro") || title.includes("Pro Access")) return Cctv;
    if (title.includes("Flotte") || title.includes("MikroTik")) return Router;
    if (title.includes("Hôtellerie") || title.includes("Hospitality")) return Building2;
    if (title.includes("Nomades") || title.includes("Nomads")) return Globe;
    return Users;
  };

  /* N°331 — icônes des cartes tarifaires du mega menu Tarifs. */
  const getPricingIcon = (title: string) => {
    if (title.includes("Hotspot")) return Wifi;
    if (title.includes("VPN")) return Globe;
    return Router;
  };

  return (
    <header className="mkl-topbar relative z-50">
      {/* N°331 — plancher de gap UNIQUEMENT ≥ xl : sous 1280 la rangée
          est celle du hamburger (le mobile 390 garde son rangement
          historique, mesuré au plus juste). */}
      <div className="mkl-wrap flex items-center justify-between xl:gap-[clamp(12px,1.5vw,24px)] py-4">
        {/* Brand */}
        <Link href="/" className="mkl-brand flex items-center gap-2.5" aria-label={copy.header.homeLink} onClick={closeMenus}>
          <Image
            src="/logo.png"
            alt="Logo 403Shield"
            width={76}
            height={76}
            priority
            className="mkl-brand-logo size-10 object-contain"
          />
          <span className="font-extrabold text-xl tracking-tight text-[#123b3a]">{copy.header.brand}</span>
        </Link>

        {/* Navigation Desktop Mega-Menu — N°331 : xl (≥ 1280) et non lg :
            le rail latéral fixe réserve 104 px (.mkl-main padding-left)
            dès 1024 — la rangée était saturée à 1024-1279 (gaps mesurés
            0 px). Le hamburger (xl:hidden) + drawer accordéon couvrent
            tout l'intervalle < 1280, la nav et « Se connecter » vivent
            où l'air existe enfin. Le padding des liens vient de la règle
            CSS scopée .mkl-topbar nav .mkl-link-quiet (les classes
            Tailwind px-* sont des no-op : .mkl-link-quiet non-layeré
            gagne la cascade). */}
        <nav className="hidden xl:flex items-center gap-1.5" aria-label="Main Navigation">
          <Link
            href="/"
            onClick={closeMenus}
            className={`mkl-link-quiet rounded-lg text-sm font-medium transition-colors ${
              pathname === "/" ? "mkl-active text-[#123b3a]" : "text-[#123b3a]/80 hover:text-[#123b3a]"
            }`}
          >
            {copy.header.nav.home}
          </Link>

          {/* Menu Produit Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("products")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className={`mkl-link-quiet rounded-lg text-sm font-medium inline-flex items-center gap-1 transition-colors ${
                activeMenu === "products" ? "text-[#123b3a] bg-[#123b3a]/5" : "text-[#123b3a]/80 hover:text-[#123b3a]"
              }`}
              onClick={() => setActiveMenu(activeMenu === "products" ? null : "products")}
              aria-expanded={activeMenu === "products"}
            >
              {copy.header.nav.products}
              <ChevronDown className={`size-4 transition-transform duration-200 ${activeMenu === "products" ? "rotate-180" : ""}`} />
            </button>

            {/* Mega Menu Dropdown Panel — N°325 : largeur clampée au
                viewport (zéro débordement horizontal — .mkl-page a
                overflow-x: clip). */}
            {activeMenu === "products" && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[min(720px,calc(100vw-3rem))] bg-[#fbf9f1] border border-[#123b3a]/15 rounded-2xl shadow-2xl p-6 grid grid-cols-2 gap-6 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                {copy.header.megaMenu.products.map((cat) => (
                  <div key={cat.title} className="flex flex-col gap-3">
                    <span className="text-xs font-extrabold tracking-wider uppercase text-[#123b3a]/60 px-2">
                      {cat.title}
                    </span>
                    <div className="flex flex-col gap-1">
                      {cat.items.map((item) => {
                        const Icon = getItemIcon(item.title);
                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={closeMenus}
                            className="p-2.5 rounded-xl hover:bg-[#123b3a]/5 transition-all group flex items-start gap-3"
                          >
                            <div className="p-2 rounded-lg bg-[#123b3a]/10 text-[#123b3a] group-hover:bg-[#123b3a] group-hover:text-white transition-colors mt-0.5">
                              <Icon className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#123b3a] group-hover:text-[#1a5351]">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#238b81]/15 text-[#1a5351]">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#123b3a]/70 line-clamp-2 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menu Solutions Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("solutions")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className={`mkl-link-quiet rounded-lg text-sm font-medium inline-flex items-center gap-1 transition-colors ${
                activeMenu === "solutions" ? "text-[#123b3a] bg-[#123b3a]/5" : "text-[#123b3a]/80 hover:text-[#123b3a]"
              }`}
              onClick={() => setActiveMenu(activeMenu === "solutions" ? null : "solutions")}
              aria-expanded={activeMenu === "solutions"}
            >
              {copy.header.nav.solutions}
              <ChevronDown className={`size-4 transition-transform duration-200 ${activeMenu === "solutions" ? "rotate-180" : ""}`} />
            </button>

            {/* Mega Menu Dropdown Panel — N°325 : largeur clampée au viewport. */}
            {activeMenu === "solutions" && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[min(480px,calc(100vw-3rem))] bg-[#fbf9f1] border border-[#123b3a]/15 rounded-2xl shadow-2xl p-6 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                {copy.header.megaMenu.solutions.map((cat) => (
                  <div key={cat.title} className="flex flex-col gap-3">
                    <span className="text-xs font-extrabold tracking-wider uppercase text-[#123b3a]/60 px-2">
                      {cat.title}
                    </span>
                    <div className="flex flex-col gap-1">
                      {cat.items.map((item) => {
                        const Icon = getItemIcon(item.title);
                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={closeMenus}
                            className="p-2.5 rounded-xl hover:bg-[#123b3a]/5 transition-all group flex items-start gap-3"
                          >
                            <div className="p-2 rounded-lg bg-[#123b3a]/10 text-[#123b3a] group-hover:bg-[#123b3a] group-hover:text-white transition-colors mt-0.5">
                              <Icon className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm text-[#123b3a] group-hover:text-[#1a5351]">
                                {item.title}
                              </span>
                              <p className="text-xs text-[#123b3a]/70 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menu Tarifs Dropdown — N°331 : chaque service affiche ses
              tarifs réels au survol (modèle Plans & Pricing cloudflare).
              Mécanique identique à Produits/Solutions : hover 150 ms,
              clic, Escape, fermeture route, panneau clampé au viewport. */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("pricing")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className={`mkl-link-quiet rounded-lg text-sm font-medium inline-flex items-center gap-1 transition-colors ${
                activeMenu === "pricing" ? "text-[#123b3a] bg-[#123b3a]/5" : "text-[#123b3a]/80 hover:text-[#123b3a]"
              }`}
              onClick={() => setActiveMenu(activeMenu === "pricing" ? null : "pricing")}
              aria-expanded={activeMenu === "pricing"}
            >
              {copy.header.nav.pricing}
              <ChevronDown className={`size-4 transition-transform duration-200 ${activeMenu === "pricing" ? "rotate-180" : ""}`} />
            </button>

            {/* Mega Menu Tarifs — 3 cartes de service avec prix réels +
                pied « comparer » vers la section complète /#tarifs. */}
            {activeMenu === "pricing" && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[min(780px,calc(100vw-3rem))] bg-[#fbf9f1] border border-[#123b3a]/15 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-3 gap-3">
                  {copy.header.megaMenu.pricing.cards.map((card) => {
                    const Icon = getPricingIcon(card.title);
                    return (
                      <Link
                        key={card.title}
                        href={card.href}
                        onClick={closeMenus}
                        className="group flex flex-col gap-2 p-3.5 rounded-xl border border-[#123b3a]/10 hover:border-[#238b81]/40 hover:bg-[#238b81]/[0.06] transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg bg-[#123b3a]/10 text-[#123b3a] group-hover:bg-[#238b81] group-hover:text-white transition-colors shrink-0">
                            <Icon className="size-4" />
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-bold text-[13px] leading-tight text-[#123b3a] group-hover:text-[#1a5351]">
                              {card.title}
                            </span>
                            {card.badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#238b81]/15 text-[#1a5351] w-fit">
                                {card.badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#123b3a]/70 leading-relaxed line-clamp-2">{card.desc}</p>
                        <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-[#123b3a]/15">
                          {card.lines.map((line) => (
                            <span key={line} className="text-xs font-bold text-[#0a5c5b] leading-snug">
                              {line}
                            </span>
                          ))}
                          <span className="text-[11px] text-[#123b3a]/60 leading-snug">{card.note}</span>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#238b81] transition-all group-hover:gap-2">
                          {card.cta} <ArrowRight className="size-3.5" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href="/#tarifs"
                  onClick={closeMenus}
                  className="mt-3 pt-3 border-t border-[#123b3a]/10 flex items-center justify-center gap-1 text-xs font-bold text-[#123b3a]/70 hover:text-[#123b3a] transition-colors"
                >
                  {copy.header.megaMenu.pricing.compare}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* N°325 — Guides publics d'exploitation (docs/guides, N°304). */}
          <Link
            href="/docs/guides"
            onClick={closeMenus}
            className={`mkl-link-quiet rounded-lg text-sm font-medium transition-colors ${
              pathname?.startsWith("/docs") ? "mkl-active text-[#123b3a]" : "text-[#123b3a]/80 hover:text-[#123b3a]"
            }`}
          >
            {copy.header.nav.docs}
          </Link>
        </nav>

        {/* Actions Header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="mkl-lang font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-[#123b3a]/20 hover:bg-[#123b3a]/10 transition-colors"
            onClick={toggleLang}
            aria-label="Switch language"
          >
            {copy.header.langLabel}
          </button>

          {/* N°331 — « Se connecter » vit ≥ 1280 uniquement (là où la
              rangée respire) ; sous 1280 le drawer accordéon porte le
              bouton — aucune zone morte. */}
          <button
            type="button"
            className="mkl-link-quiet hidden xl:inline-flex text-sm font-semibold text-[#123b3a] hover:opacity-80 transition-opacity"
            onClick={onSignIn}
          >
            {copy.header.signIn}
          </button>

          <button
            type="button"
            className="mkl-btn mkl-btn-teal mkl-btn-sm text-xs sm:text-sm font-bold flex items-center gap-1.5 px-4 py-2"
            onClick={onSignUp}
          >
            {copy.header.signUp} <ArrowRight className="size-4" />
          </button>

          {/* Toggle Mobile Menu Button — N°331 : xl:hidden (couvre tout
              l'intervalle < 1280 où la nav desktop est repliée). */}
          <button
            type="button"
            className="xl:hidden p-2 rounded-lg text-[#123b3a] hover:bg-[#123b3a]/10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`w-full h-0.5 bg-[#123b3a] rounded transition-transform ${mobileMenuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`w-full h-0.5 bg-[#123b3a] rounded transition-opacity ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`w-full h-0.5 bg-[#123b3a] rounded transition-transform ${mobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer — N°331 : < 1280, EN ACCORDÉON (parité
          complète avec la nav desktop : Accueil · Produits ▾ · Solutions ▾ ·
          Tarifs ▾ · Guides & Docs + boutons auth). Le drawer n'avait ni
          Produits ni Solutions : à 1024-1279, intervalle désormais couvert
          par le hamburger, ils seraient devenus inaccessibles. */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#fbf9f1] border-b border-[#123b3a]/15 px-4 py-6 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              className="px-3 py-2.5 text-base font-bold text-[#123b3a]"
              onClick={closeMenus}
            >
              {copy.header.nav.home}
            </Link>

            {/* Accordéon Produits — 6 items groupés par catégorie. */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 text-base font-bold text-[#123b3a]"
              onClick={() => toggleMobileSection("products")}
              aria-expanded={mobileSection === "products"}
            >
              {copy.header.nav.products}
              <ChevronDown className={`size-4 transition-transform duration-200 ${mobileSection === "products" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "products" && (
              <div className="flex flex-col gap-3 pl-3 pr-1 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {copy.header.megaMenu.products.map((cat) => (
                  <div key={cat.title} className="flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-[#123b3a]/50 px-2">
                      {cat.title}
                    </span>
                    {cat.items.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={closeMenus}
                        className="px-2 py-1.5 rounded-lg hover:bg-[#123b3a]/5 text-sm font-semibold text-[#123b3a]/90 leading-snug transition-colors"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Accordéon Solutions — 4 items. */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 text-base font-bold text-[#123b3a]"
              onClick={() => toggleMobileSection("solutions")}
              aria-expanded={mobileSection === "solutions"}
            >
              {copy.header.nav.solutions}
              <ChevronDown className={`size-4 transition-transform duration-200 ${mobileSection === "solutions" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "solutions" && (
              <div className="flex flex-col gap-1 pl-3 pr-1 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {copy.header.megaMenu.solutions.map((cat) =>
                  cat.items.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={closeMenus}
                      className="px-2 py-1.5 rounded-lg hover:bg-[#123b3a]/5 text-sm font-semibold text-[#123b3a]/90 leading-snug transition-colors"
                    >
                      {item.title}
                    </Link>
                  )),
                )}
              </div>
            )}

            {/* Accordéon Tarifs — N°331 : chaque service avec son prix
                d'entrée + lien « comparer » vers la section complète. */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 text-base font-bold text-[#123b3a]"
              onClick={() => toggleMobileSection("pricing")}
              aria-expanded={mobileSection === "pricing"}
            >
              {copy.header.nav.pricing}
              <ChevronDown className={`size-4 transition-transform duration-200 ${mobileSection === "pricing" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "pricing" && (
              <div className="flex flex-col gap-1 pl-3 pr-1 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {copy.header.megaMenu.pricing.cards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    onClick={closeMenus}
                    className="px-2 py-2 rounded-lg hover:bg-[#123b3a]/5 flex flex-col gap-0.5 transition-colors"
                  >
                    <span className="text-sm font-semibold text-[#123b3a]/90 leading-snug">{card.title}</span>
                    <span className="text-xs font-bold text-[#0a5c5b]">{card.lines[0]}</span>
                  </Link>
                ))}
                <Link
                  href="/#tarifs"
                  onClick={closeMenus}
                  className="px-2 py-1.5 text-xs font-bold text-[#238b81] inline-flex items-center gap-1"
                >
                  {copy.header.megaMenu.pricing.compare}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            <Link
              href="/docs/guides"
              className="px-3 py-2.5 text-base font-bold text-[#123b3a]"
              onClick={closeMenus}
            >
              {copy.header.nav.docs}
            </Link>
          </div>

          <div className="pt-4 border-t border-[#123b3a]/10 flex flex-col gap-3">
            <button
              type="button"
              className="w-full text-center py-2.5 font-bold text-[#123b3a] bg-[#123b3a]/5 rounded-xl"
              onClick={() => {
                closeMenus();
                onSignIn();
              }}
            >
              {copy.header.signIn}
            </button>
            {/* N°325 — CTA principal du drawer (l'inscription ouvre la
                modale, jamais un lien mort). */}
            <button
              type="button"
              className="w-full text-center py-2.5 font-bold rounded-xl bg-[#238b81] text-white"
              onClick={() => {
                closeMenus();
                onSignUp();
              }}
            >
              {copy.header.signUp}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
