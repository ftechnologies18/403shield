"use client";

// Index du volet PLATEFORME /docs/guides/plateforme (N°304) — PRIVÉ.
// Garde : session + rôle admin plateforme (PlatformGate). Le contenu
// complet des guides n'est chargé que par les pages [slug] après la garde ;
// ici ne vivent que les métadonnées (titres — platform-meta.ts).

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3, ShieldCheck } from "lucide-react";
import { PLATFORM_GUIDES_META, PLATFORM_SECTION } from "@/lib/docs/platform-meta";
import { PlatformGate } from "@/components/docs/platform-gate";

export default function PlatformDocsIndexPage() {
  return (
    <PlatformGate>
      <div className="docs-platform-index">
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
            {PLATFORM_GUIDES_META.length} guides · accès réservé, entrée unique : menu profil de la
            sidebar de la console.
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
                  <h2 className="text-[15px] font-semibold leading-6 text-foreground group-hover:text-primary">
                    {g.title}
                  </h2>
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

        <p className="mt-8 text-xs text-muted-foreground">
          Les guides d'exploitation (console gérant/propriétaire) restent publics :{" "}
          <Link href="/docs/guides" className="underline-offset-2 hover:underline">
            /docs/guides
          </Link>
          . Captures de la console super-admin : à venir (compte dédié requis).
        </p>
      </div>
    </PlatformGate>
  );
}
