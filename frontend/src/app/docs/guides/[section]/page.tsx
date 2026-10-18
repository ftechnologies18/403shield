// Index de section /docs/guides/[section] (N°333-C) — SSG sur les 9
// sections publiques : entête de section (titre, description, compte) +
// cartes des guides + maillage (hub, premier guide). Le volet plateforme
// reste sous /docs/guides/plateforme (privé, layout dédié).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DOC_SECTIONS, guidesBySection } from "@/lib/docs/catalog";
import { DocsShell } from "@/components/docs/docs-shell";

interface Params {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return DOC_SECTIONS.map((s) => ({ section: s.id }));
}

function getSection(id: string) {
  return DOC_SECTIONS.find((s) => s.id === id);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  const s = getSection(section);
  if (!s) return { title: "Section introuvable — 403Shield" };
  return {
    title: `${s.title} — Guides 403Shield`,
    description: s.description,
    openGraph: { title: s.title, description: s.description, type: "website" },
  };
}

export default async function SectionPage({ params }: Params) {
  const { section: sectionId } = await params;
  const section = getSection(sectionId);
  if (!section) notFound();

  const sections = DOC_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    guides: guidesBySection(s.id).map((g) => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
      roles: g.roles,
      minutes: g.minutes,
      sectionId: g.sectionId,
      sectionTitle: s.title,
    })),
  }));

  const guides = guidesBySection(section.id);
  const totalMinutes = guides.reduce((n, g) => n + g.minutes, 0);
  const first = guides[0];

  return (
    <DocsShell sections={sections}>
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <Link href="/docs/guides" className="inline-flex items-center gap-1.5 rounded hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Guides
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground/80">{section.title}</span>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="tabular-nums">{guides.length} guides</Badge>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" aria-hidden />
            {totalMinutes} min au total
          </span>
        </div>
        <h1 className="mt-3 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {section.title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-7 text-muted-foreground">
          {section.description}
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {guides.map((g) => (
          <Link
            key={g.id}
            href={`/docs/guides/${g.sectionId}/${g.id}`}
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full border-border/60 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col p-4">
                <h2 className="text-[15px] font-semibold leading-6 text-foreground group-hover:text-primary">
                  {g.title}
                </h2>
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

      {first ? (
        <div className="mt-10 rounded-xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
          <p className="text-[15px] font-semibold text-foreground">Par où commencer dans cette section ?</p>
          <Link
            href={`/docs/guides/${first.sectionId}/${first.id}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {first.title}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {first.summary}
          </p>
        </div>
      ) : null}
    </DocsShell>
  );
}
