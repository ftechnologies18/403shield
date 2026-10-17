"use client";

// page.tsx — vitrine de la console (N°313, Pro N°315, boutique N°316, rebrand
// N°317). Promesses HONNÊTES uniquement. N°317 — pivot de marque exécuté :
// MikCloud et MikTunnel disparaissent au profit de la marque unifiée
// « 403Shield » (architecture Option A, modèle Cloudflare/OVH) — CETTE app
// (tunnel.ftci.fr) devient « 403Shield Console » : on y achète (/shop), gère
// (/me) et opère (/pro) les tunnels et VPN WireGuard. Maison-mère : FTech CI
// (ftci.fr), endossement « powered by FTech CI » ; le site marketing unifié
// vit sur 403shield.ftci.fr (ex mikcloud.ftci.fr — N°313-316 : la vitrine fut
// « MikTunnel by MikCloud », la boutique a déménagé ici en N°316).
// Footer collant (min-h-screen + mt-auto).

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Lock, Router, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "VPN WireGuard",
    desc: "Votre trafic, chiffré de bout en bout, sort par notre serveur de Marseille avec une IP fixe France. Activation en 30 secondes.",
    tag: "Disponible",
    href: "/shop",
    cta: "Acheter mon VPN",
  },
  {
    icon: ShieldCheck,
    title: "Chiffrement moderne",
    desc: "WireGuard : le protocole audité, plus rapide et plus léger que les VPN d'ancienne génération. Votre configuration reste votre propriété.",
    tag: "Cœur du service",
  },
  {
    icon: Router,
    title: "Accès distant Pro",
    desc: "Supervisez vos routeurs MikroTik — puis vos caméras et vos NAS — à travers le même tunnel chiffré, où que vous soyez.",
    tag: "Disponible",
    href: "/pro",
    cta: "Voir l'offre Accès Pro",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Barre écosystème — la maison racontée : FTech CI → 403Shield (site) → ici (console). */}
      <div className="border-b border-slate-800/60 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[10px] text-slate-500 sm:px-6">
          <span className="font-medium text-slate-400">Écosystème FTech CI</span>
          <a
            href="https://ftci.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition hover:text-slate-300"
          >
            ftci.fr
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <a
            href="https://403shield.ftci.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition hover:text-slate-300"
          >
            403Shield — site
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">
            Console &amp; boutique — vous êtes ici
          </span>
        </div>
      </div>

      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="403Shield" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div className="flex flex-wrap items-center gap-2 leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-100">403Shield</p>
              <span className="rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                Console
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex" aria-label="primary">
            <Link href="/shop" className="transition hover:text-slate-100">
              Boutique
            </Link>
            <Link href="/pro" className="transition hover:text-slate-100">
              Accès Pro
            </Link>
            <a
              href="https://403shield.ftci.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-slate-100"
            >
              Site 403Shield
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </nav>
          <Link
            href="/login"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Mon espace
          </Link>
        </div>
      </header>

      <main className="hero-glow flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            VPN WireGuard &amp; tunnels chiffrés — sans configuration complexe
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
            Vos tunnels,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              simplement.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            403Shield bâtit des tunnels chiffrés WireGuard vers notre serveur de
            Marseille : un VPN pour vos voyages, un accès distant à votre réseau
            pour votre entreprise — le tout payable en Mobile Money, acheté, géré
            et renouvelé depuis ce même endroit, sans toucher à un fichier de
            configuration.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Acheter un VPN
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
            >
              Accéder à mon espace
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Sans mot de passe : un code à 6 chiffres reçu par e-mail suffit.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
                  {f.tag}
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                {f.href && (
                  <Link
                    href={f.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    {f.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p>403Shield Console · powered by FTech CI · Tunnels WireGuard hébergés à Marseille</p>
          <div className="flex gap-4">
            <Link href="/shop" className="hover:text-slate-300">
              Boutique VPN
            </Link>
            <a
              href="https://403shield.ftci.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300"
            >
              Site 403Shield
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
