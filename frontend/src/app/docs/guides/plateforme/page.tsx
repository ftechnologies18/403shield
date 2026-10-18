"use client";

// Index du volet PLATEFORME /docs/guides/plateforme (N°304, N°333-D) —
// PRIVÉ mais vitriné : les TITRES et résumés (déjà publics dans le bundle
// platform-meta.ts et le RSC payload du layout) s'affichent pour tous —
// pattern « gated content » des grandes docs (Stripe/Twilio) : le mur
// devient une vitrine, le CONTENU reste gardé par PlatformGate sur chaque
// page [slug] (session + rôle admin plateforme). La page reste noindex
// (layout) : aucune découverte publique par les moteurs — la décision
// exploitant d'origine (« pas d'accessibilité publique au volet ») est
// respectée dans l'esprit : pas d'indexation, contenu protégé, entrée
// naturelle toujours le menu profil de la sidebar.

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock3, Lock, ShieldCheck } from "lucide-react";
import { PLATFORM_GUIDES_META, PLATFORM_SECTION } from "@/lib/docs/platform-meta";

export default function PlatformDocsIndexPage() {
  return (
    <div className="docs-platform-index">
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <Link href="/docs/guides" className="inline-flex items-center gap-1.5 rounded hover:text-foreground">
          Guides
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground/80">Plateforme (privé)</span>
      </nav>

      <header>
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <ShieldCheck className="size-4" aria-hidden />
          Documentation plateforme
        </p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight">
          {PLATFORM_SECTION.title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-7 text-muted-foreground">
          {PLATFORM_SECTION.description}
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {PLATFORM_GUIDES_META.length} guides · lecture réservée aux administrateurs de la plateforme
          (connexion administrateur requise).
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PLATFORM_GUIDES_META.map((g) => (
          <Link
            key={g.id}
            href={`/docs/guides/plateforme/${g.id}`}
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full border-border/60 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-semibold leading-6 text-foreground group-hover:text-primary">
                    {g.title}
                  </h2>
                  <span
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                    title="Contenu réservé — connexion administrateur plateforme requise"
                  >
                    <Lock className="size-3" aria-hidden />
                    privé
                  </span>
                </div>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-6 text-muted-foreground">
                  {g.summary}
                </p>
                <p className="mt-3 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden />
                  {g.minutes} min
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-foreground">Administrateur de la plateforme ?</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Connectez-vous avec un compte admin plateforme : la garde de chaque guide vérifie la session
          et le rôle avant d&apos;en charger le contenu.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Se connecter
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Les guides d&apos;exploitation (console gérant/propriétaire) restent publics :{" "}
        <Link href="/docs/guides" className="underline-offset-2 hover:underline">
          /docs/guides
        </Link>
        . Captures de la console super-admin : à venir (compte dédié requis).
      </p>
    </div>
  );
}
