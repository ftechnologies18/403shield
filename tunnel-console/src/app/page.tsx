"use client";

// page.tsx — vitrine de la console tunnel (N°313, Pro N°315).
// Promesses HONNÊTES uniquement : la vente VPN grand public est DÉJÀ ouverte
// (vitrine MikCloud /vpn), l'espace client est livré (N°314), l'ACCÈS PRO à
// distance + LAN étendu (caméras/NAS) est DISPONIBLE depuis CETTE console
// (N°315 — page /pro). Footer collant (min-h-screen + mt-auto).

import Link from "next/link";
import { ArrowRight, KeyRound, Lock, Router, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "VPN WireGuard",
    desc: "Votre trafic, chiffré de bout en bout, sort par notre serveur de Marseille avec une IP fixe France. Activation en 30 secondes.",
    tag: "Disponible",
    href: "https://mikcloud.ftci.fr/vpn",
    cta: "Voir la vitrine MikCloud VPN",
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
      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-100">MikTunnel</p>
              <p className="text-[11px] text-slate-500">powered by FTech CI</p>
            </div>
          </div>
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
            Tunnels WireGuard sécurisés, sans configuration complexe
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
            Vos tunnels,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              simplement.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            MikTunnel bâtit des tunnels chiffrés WireGuard vers notre serveur de
            Marseille : un VPN pour vos voyages, un accès distant à votre réseau
            pour votre entreprise — le tout payable en Mobile Money, géré depuis
            cet espace, sans toucher à un fichier de configuration.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Accéder à mon espace
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="https://mikcloud.ftci.fr/vpn"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
            >
              Acheter un VPN
            </a>
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
                  <a
                    href={f.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    {f.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p>MikTunnel — powered by FTech CI · Tunnels WireGuard hébergés à Marseille</p>
          <div className="flex gap-4">
            <a href="https://mikcloud.ftci.fr/vpn" className="hover:text-slate-300">
              MikCloud VPN
            </a>
            <a href="https://mikcloud.ftci.fr" className="hover:text-slate-300">
              MikCloud
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
