"use client";

// components/auth/auth-shell.tsx — N°326/N°329 — le gabarit partagé des parcours
// d'authentification (/login, /verify), au modèle dash.cloudflare.com/login :
// split-screen N°329 — COLONNE FORMULAIRE ivoire À GAUCHE + PANNEAU DE MARQUE
// ANIMÉ À DROITE (desktop ≥1024 — dégradé sarcelle en dérive lente, blobs
// menthe/crème, anneaux radar derrière le logo, constellation scintillante,
// lignes de données WireGuard qui circulent, chips flottantes, parallaxe qui
// suit le pointeur). Palette : le design system Clay de la vitrine (FreeTech
// — ivoire, crème, sarcelle, menthe, encre), porté sous le préfixe mka- dans
// globals.css. Décorations aria-hidden ; TOUT se fige sur prefers-reduced-motion
// (le calme reste un signe de confiance — le mouvement, un condiment).

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Banknote, KeyRound, Lock, ShieldCheck, Waypoints } from "lucide-react";

const FEATS = [
  { icon: KeyRound, label: "Code à 6 chiffres, valable 10 minutes" },
  { icon: ShieldCheck, label: "Sans mot de passe — votre e-mail est votre identité" },
  { icon: Lock, label: "Tunnels WireGuard chiffrés, IP fixe France" },
];

const CHIPS = [
  { icon: Waypoints, label: "VPN WireGuard", cls: "mka-chip-1" },
  { icon: Lock, label: "IP fixe France", cls: "mka-chip-2" },
  { icon: Banknote, label: "Mobile Money", cls: "mka-chip-3" },
];

/* Constellation décorative (≥1280, aria-hidden) : points menthe/crème qui
   scintillent — calés sur la moitié droite du panneau, JAMAIS sur le texte
   (bloc .mka-mid max-width 24rem ancré à gauche) ni sur les chips (bord
   droit 4-9 %). */
const STARS = [
  { top: "10%", right: "55%", size: 3, delay: "0s", cream: false },
  { top: "15%", right: "38%", size: 2.5, delay: "1.2s", cream: true },
  { top: "24%", right: "70%", size: 3.5, delay: "0.6s", cream: false },
  { top: "33%", right: "30%", size: 3, delay: "2s", cream: true },
  { top: "45%", right: "24%", size: 2.5, delay: "0.9s", cream: false },
  { top: "58%", right: "28%", size: 3, delay: "1.6s", cream: true },
  { top: "70%", right: "20%", size: 2.5, delay: "0.3s", cream: false },
  { top: "84%", right: "45%", size: 3, delay: "1.1s", cream: true },
] as const;

export function AuthShell({ children }: { children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  /* Parallaxe décorative : le pointeur déplace blobs (profondeur 1) et
   * chips (profondeur inverse) via --mka-px/--mka-py ∈ −0.5..0.5. Réduite
   * au panneau, amortie par la transition CSS, coupée en mouvement réduit. */
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mka-px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty("--mka-py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mka-page">
      <div className="mka-grain" aria-hidden="true" />
      <div className="mka-grid">
        {/* ── Colonne formulaire — À GAUCHE (N°329) ─────────────────────── */}
        <section className="mka-formcol">
          <header className="mka-mobile-head">
            <Image
              src="/logo.png"
              alt="403Shield"
              width={40}
              height={40}
              className="mka-logo h-10 w-10"
            />
            <p className="mka-brand-name">403Shield</p>
            <span className="mka-brand-badge">Console</span>
          </header>

          <div className="mka-center">
            <div className="mka-halo" aria-hidden="true" />
            {children}
          </div>

          <footer className="mka-foot">
            <p>403Shield · powered by FTech CI</p>
            <span className="mka-foot-sep" aria-hidden="true">·</span>
            <a href="https://403shield.ftci.fr" target="_blank" rel="noopener noreferrer">
              Vitrine
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
            <span className="mka-foot-sep" aria-hidden="true">·</span>
            <a
              href="https://403shield.ftci.fr/legal/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
            >
              Confidentialité
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </footer>
        </section>

        {/* ── Panneau de marque animé — À DROITE (masqué < 1024) ────────── */}
        <aside ref={panel} className="mka-brand" aria-label="403Shield — Console">
          <div className="mka-blobs mka-px" aria-hidden="true">
            <div className="mka-blob-a" />
            <div className="mka-blob-b" />
          </div>

          <div className="mka-stars" aria-hidden="true">
            {STARS.map((s, i) => (
              <span
                key={i}
                className={`mka-star${s.cream ? " is-cream" : ""}`}
                style={{ top: s.top, right: s.right, width: s.size, height: s.size, animationDelay: s.delay }}
              />
            ))}
          </div>

          <div className="mka-chips mka-px-soft" aria-hidden="true">
            {CHIPS.map((c) => (
              <span key={c.label} className={`mka-chip ${c.cls}`}>
                <c.icon className="h-4 w-4" aria-hidden="true" />
                {c.label}
              </span>
            ))}
          </div>

          <div className="mka-brand-head mka-in mka-in-1">
            <span className="mka-rings" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <Image
              src="/logo.png"
              alt=""
              width={44}
              height={44}
              className="mka-logo h-11 w-11"
            />
            <p className="mka-brand-name">403Shield</p>
            <span className="mka-brand-badge">Console</span>
          </div>

          <div className="mka-mid">
            <p className="mka-kick mka-in mka-in-2">
              <span className="mka-kick-dot" aria-hidden="true" />
              Connexion sécurisée
            </p>
            <h2 className="mka-brand-title mka-in mka-in-3">
              Vos tunnels, à <em className="mka-accent">un e-mail</em> d&apos;ici.
            </h2>
            <p className="mka-brand-lede mka-in mka-in-4">
              La console 403Shield s&apos;ouvre par un simple code&nbsp;: VPN
              WireGuard, tunnels chiffrés et Accès Pro — sans mot de passe à
              retenir.
            </p>
            <ul className="mka-feats mka-in mka-in-5">
              {FEATS.map((f) => (
                <li key={f.label} className="mka-feat">
                  <span className="mka-feat-dot">
                    <f.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Lignes de données WireGuard : trois flux en pointillés qui
              circulent entre les nœuds (maillage/tunnel), au-dessus du pied. */}
          <svg className="mka-flow" viewBox="0 0 420 84" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="4.5" className="mka-flow-node" />
            <circle cx="16" cy="42" r="4.5" className="mka-flow-node n2" />
            <circle cx="16" cy="68" r="4.5" className="mka-flow-node" />
            <path d="M16 16C120 16 140 42 220 42S320 68 404 68" className="mka-flow-line" />
            <path d="M16 42H404" className="mka-flow-line l2" />
            <path d="M16 68C120 68 140 42 220 42S320 16 404 16" className="mka-flow-line l3" />
            <circle cx="404" cy="68" r="3" className="mka-flow-node n2" />
            <circle cx="404" cy="42" r="3" className="mka-flow-node" />
            <circle cx="404" cy="16" r="3" className="mka-flow-node n2" />
          </svg>

          <p className="mka-brand-foot">
            powered by FTech CI · Wave &amp; carte acceptés
          </p>
        </aside>
      </div>
    </div>
  );
}
