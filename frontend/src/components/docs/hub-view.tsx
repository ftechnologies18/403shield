"use client";

// Hub /docs/guides (N°304, N°333-C) — recherche instantanée + cartes par
// section (liens hiérarchiques /docs/guides/<section>/<slug>, titres de
// section cliquables vers leur vue dédiée, filtre insensible aux accents).
// Client component : le filtrage est local (métadonnées légères uniquement,
// aucun contenu de guide n'entre dans le bundle client). La recherche
// full-text (corps, FAQ, pièges) vit dans la palette ⌘K du shell.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ChevronRight, Clock3, Search, UserRound } from "lucide-react";
import type { GuideMetaLight } from "@/lib/docs/catalog";

/** Minuscules + suppression des diacritiques (« pare-feu » ≈ « parfeu »). */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function HubView({ sections }: { sections: { id: string; title: string; description: string; guides: GuideMetaLight[] }[] }) {
  const [query, setQuery] = useState("");
  const q = norm(query.trim());

  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        guides: s.guides.filter(
          (g) =>
            norm(g.title).includes(q) ||
            norm(g.summary).includes(q) ||
            norm(g.roles).includes(q) ||
            norm(s.title).includes(q),
        ),
      }))
      .filter((s) => s.guides.length > 0);
  }, [q, sections]);

  const total = sections.reduce((n, s) => n + s.guides.length, 0);
  const found = filtered.reduce((n, s) => n + s.guides.length, 0);
  const searching = q.length > 0;

  return (
    <div className="docs-hub">
      <header className="hub-hero">
        <p className="text-sm font-medium text-primary">Documentation d'exploitation</p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Guides 403Shield
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-7 text-muted-foreground">
          Chaque fonction de la console expliquée pas à pas, avec captures d'écran réelles :
          ce que c'est, ce que ça reçoit, comment l'utiliser au comptoir, les usages de terrain
          et les pièges à éviter. {total} guides en {sections.length} sections.
        </p>

        <div className="relative mt-6 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un guide (vouchers, sessions, revendeurs…)"
            aria-label="Rechercher un guide"
            className="h-11 rounded-xl pl-9 text-[15px]"
          />
        </div>
        {searching ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {found} guide{found > 1 ? "s" : ""} {found > 0 ? "correspond" : "correspondent"} à « {query.trim()} »
          </p>
        ) : null}
      </header>

      <div className="mt-10 space-y-12">
        {filtered.map((s) => (
          <section key={s.id} aria-labelledby={`section-${s.id}`}>
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 id={`section-${s.id}`} className="text-lg font-semibold tracking-tight">
                  <Link
                    href={`/docs/guides/${s.id}`}
                    className="group inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s.title}
                    <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </Link>
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.description}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 tabular-nums">{s.guides.length}</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {s.guides.map((g) => (
                <Link
                  key={g.id}
                  href={`/docs/guides/${g.sectionId}/${g.id}`}
                  className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full border-border/60 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-4">
                      <h3 className="text-[15px] font-semibold leading-6 text-foreground group-hover:text-primary">
                        {g.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-[13.5px] leading-6 text-muted-foreground">
                        {g.summary}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserRound className="size-3" aria-hidden />
                          {g.roles}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                          <Clock3 className="size-3" aria-hidden />
                          {g.minutes} min
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {searching && found === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            Aucun guide ne correspond à « {query.trim()} ». Essayez « vouchers », « sessions »,
            « revendeurs », « portail »…
          </div>
        ) : null}
      </div>

      <div className="docs-hub-cta mt-12 rounded-xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-foreground">Prêt à démarrer ?</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Le parcours complet tient en 20 minutes : compte → routeur → première vente.
        </p>
        <Link
          href="/docs/guides/demarrer/premiers-pas"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Commencer par « Créer votre compte »
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
