// Page de guide public /docs/guides/[section]/[slug] (N°304, URLs
// hiérarchiques N°333-C) — SSG sur les 33 guides console. Le volet
// plateforme vit sous /docs/guides/plateforme/* (privé).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DOC_SECTIONS, PUBLIC_GUIDES, getPublicGuide, guideNeighbors, guidesBySection } from "@/lib/docs/catalog";
import { DocsShell } from "@/components/docs/docs-shell";
import { GuideView, type RelatedGuideCard } from "@/components/docs/guide-view";
import { DocsJsonLd } from "@/components/docs/docs-jsonld";
import { DocsFeedback } from "@/components/docs/docs-feedback";

interface Params {
  params: Promise<{ section: string; slug: string }>;
}

export function generateStaticParams() {
  // « plateforme » est explicitement absent : segment statique réservé au
  // volet privé (Next privilégie la route statique de toute façon).
  return PUBLIC_GUIDES.map((g) => ({ section: g.sectionId, slug: g.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section, slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide || guide.sectionId !== section) return { title: "Guide introuvable — 403Shield" };
  return {
    metadataBase: new URL("https://403shield.ftci.fr"),
    alternates: { canonical: `/docs/guides/${guide.sectionId}/${guide.id}` },
    title: `${guide.title} — Guides 403Shield`,
    description: guide.summary,
    openGraph: {
      title: guide.title,
      description: guide.summary,
      type: "article",
      modifiedTime: guide.updated,
    },
  };
}

export default async function GuidePage({ params }: Params) {
  const { section, slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide || guide.sectionId !== section) notFound();

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

  const sectionTitle = DOC_SECTIONS.find((s) => s.id === guide.sectionId)?.title ?? "";
  const { prev, next } = guideNeighbors(guide.id);

  // « À lire ensuite » : le champ related (maintenu depuis N°304, rendu
  // depuis N°333-C) — 3 cartes max, résolues contre le catalogue public.
  const related: RelatedGuideCard[] = (guide.related ?? [])
    .map((id) => {
      const g = getPublicGuide(id);
      if (!g) return null;
      return {
        href: `/docs/guides/${g.sectionId}/${g.id}`,
        title: g.title,
        sectionTitle: DOC_SECTIONS.find((s) => s.id === g.sectionId)?.title ?? "",
        minutes: g.minutes,
      };
    })
    .filter((c): c is RelatedGuideCard => c !== null)
    .slice(0, 3);

  return (
    <DocsShell sections={sections} currentId={guide.id} withToc>
      {/* JSON-LD (N°333-D) : BreadcrumbList conforme au fil visible +
          TechArticle + FAQPage — og:image vient d'opengraph-image.tsx. */}
      <DocsJsonLd guide={guide} sectionTitle={sectionTitle} />

      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <Link href="/docs/guides" className="inline-flex items-center gap-1.5 rounded hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Guides
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/docs/guides/${guide.sectionId}`} className="rounded hover:text-foreground">
          {sectionTitle}
        </Link>
        <span aria-hidden>/</span>
        <span className="max-w-[46ch] truncate text-foreground/80" title={guide.title}>
          {guide.title}
        </span>
      </nav>

      <GuideView guide={guide} related={related} />

      <nav aria-label="Guides précédent et suivant" className="mt-10 grid gap-3 sm:grid-cols-2 print:hidden">
        {prev ? (
          <Link
            href={`/docs/guides/${prev.sectionId}/${prev.id}`}
            className="group rounded-xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-primary/40"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ArrowLeft className="size-3" aria-hidden />
              Précédent · {DOC_SECTIONS.find((s) => s.id === prev.sectionId)?.title}
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-primary">{prev.title}</p>
          </Link>
        ) : (
          <span aria-hidden />
        )}
        {next ? (
          <Link
            href={`/docs/guides/${next.sectionId}/${next.id}`}
            className="group rounded-xl border border-border/60 bg-card/70 p-4 text-right transition-colors hover:border-primary/40"
          >
            <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Suivant · {DOC_SECTIONS.find((s) => s.id === next.sectionId)?.title}
              <ArrowRight className="size-3" aria-hidden />
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-primary">{next.title}</p>
          </Link>
        ) : null}
      </nav>

      {/* Feedback lecteur (N°333-D) — zéro infrastructure : mailto prérempli
          au canal réel de l'exploitant. Imprimé : masqué. */}
      <div className="mt-8 print:hidden">
        <DocsFeedback guideId={guide.id} />
      </div>

      {/* Conversion (N°333-D) — le lecteur qui FINIT un guide est le prospect
          le plus chaud : carte sobre vers la formule Découverte (0 F / 60 j,
          sans carte — promesse exacte, jamais de faux chiffre). */}
      <div className="mt-8 rounded-xl border border-primary/25 bg-primary/8 p-5 sm:p-6 print:hidden">
        <p className="text-[15px] font-semibold text-foreground">Prêt à essayer sur votre propre routeur ?</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          La formule Découverte est gratuite pendant 60 jours, sans carte bancaire — 1 routeur, toutes les fonctions.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
          <Link href="/hotspot#tarifs" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            Voir les formules
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            Ouvrir la console
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </DocsShell>
  );
}
