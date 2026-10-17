// Page de guide public /docs/guides/[slug] (N°304) — SSG sur les 30 guides
// console. Le volet plateforme vit sous /docs/guides/plateforme/* (privé).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DOC_SECTIONS, PUBLIC_GUIDES, getPublicGuide, guideNeighbors, guidesBySection } from "@/lib/docs/catalog";
import { DocsShell } from "@/components/docs/docs-shell";
import { GuideView } from "@/components/docs/guide-view";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // « plateforme » est explicitement absent : segment statique réservé au
  // volet privé (Next privilégie la route statique de toute façon).
  return PUBLIC_GUIDES.map((g) => ({ slug: g.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide) return { title: "Guide introuvable — 403Shield" };
  return {
    title: `${guide.title} — Guides 403Shield`,
    description: guide.summary,
    openGraph: {
      title: guide.title,
      description: guide.summary,
      type: "article",
    },
  };
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide) notFound();

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

  const { prev, next } = guideNeighbors(guide.id);

  return (
    <DocsShell sections={sections} currentId={guide.id} withToc>
      <nav aria-label="Fil d'Ariane" className="mb-6 text-[13px] text-muted-foreground">
        <Link href="/docs/guides" className="inline-flex items-center gap-1.5 rounded hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Guides
        </Link>
        <span className="mx-2" aria-hidden>/</span>
        <span>{guide.roles}</span>
      </nav>

      <GuideView guide={guide} />

      <nav aria-label="Guides précédent et suivant" className="mt-10 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/docs/guides/${prev.id}`}
            className="group rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-primary/40"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ArrowLeft className="size-3" aria-hidden />
              Précédent
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-primary">{prev.title}</p>
          </Link>
        ) : (
          <span aria-hidden />
        )}
        {next ? (
          <Link
            href={`/docs/guides/${next.id}`}
            className="group rounded-xl border border-border/60 bg-card/70 p-4 text-right transition-colors hover:border-primary/40"
          >
            <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Suivant
              <ArrowRight className="size-3" aria-hidden />
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-primary">{next.title}</p>
          </Link>
        ) : null}
      </nav>
    </DocsShell>
  );
}
