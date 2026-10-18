"use client";

// Guide du volet PLATEFORME /docs/guides/plateforme/[slug] (N°304) — PRIVÉ.
// Le CONTENU complet (content/plateforme.ts) n'est importé DYNAMIQUEMENT
// qu'après validation de la garde (session + rôle) : le chunk n'est jamais
// téléchargé par un visiteur non autorisé.

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, ArrowRight, FileQuestion } from "lucide-react";
import type { Guide } from "@/lib/docs/types";
import { PLATFORM_GUIDES_META } from "@/lib/docs/platform-meta";
import { PlatformGate } from "@/components/docs/platform-gate";
import { GuideView, type RelatedGuideCard } from "@/components/docs/guide-view";

function PlatformGuideBody({ slug }: { slug: string }) {
  const [guide, setGuide] = useState<Guide | null | "pending">("pending");

  useEffect(() => {
    let cancelled = false;
    // Import dynamique APRÈS la garde (PlatformGate parent) : le contenu
    // n'entre dans le réseau que pour les admins plateforme authentifiés.
    import("@/lib/docs/content/plateforme")
      .then((m) => {
        if (!cancelled) setGuide(m.PLATEFORME_GUIDES.find((g) => g.id === slug) ?? null);
      })
      .catch(() => {
        if (!cancelled) setGuide(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (guide === "pending") {
    return (
      <div className="docs-guide-loading space-y-4" role="status" aria-live="polite">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted/70" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted/70" />
        <p className="text-xs text-muted-foreground">Chargement du guide (section privée)…</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Guide introuvable</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ce guide de la console plateforme n'existe pas (ou plus).
        </p>
        <Link
          href="/docs/guides/plateforme"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au volet plateforme
        </Link>
      </div>
    );
  }

  const i = PLATFORM_GUIDES_META.findIndex((g) => g.id === slug);
  const prev = i > 0 ? PLATFORM_GUIDES_META[i - 1] : undefined;
  const next = i >= 0 && i < PLATFORM_GUIDES_META.length - 1 ? PLATFORM_GUIDES_META[i + 1] : undefined;

  // « À lire ensuite » (N°333-C) : related résolus sur les seules
  // métadonnées plateforme (légères, déjà présentes dans le bundle client) —
  // les related vers des guides PUBLICS ne sont pas rendus ici : les
  // résoudre exigerait le catalogue complet côté client (contenu intégral
  // dans le bundle, contraire au design N°304). Ils restent desservis par
  // les pages publiques et la palette ⌘K.
  const related: RelatedGuideCard[] = (guide.related ?? [])
    .map((id) => {
      const p = PLATFORM_GUIDES_META.find((g) => g.id === id);
      return p
        ? { href: `/docs/guides/plateforme/${p.id}`, title: p.title, sectionTitle: "Plateforme (privé)", minutes: p.minutes }
        : null;
    })
    .filter((c): c is RelatedGuideCard => c !== null)
    .slice(0, 3);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <Link href="/docs/guides" className="inline-flex items-center gap-1.5 rounded hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Guides
        </Link>
        <span aria-hidden>/</span>
        <Link href="/docs/guides/plateforme" className="rounded hover:text-foreground">
          Plateforme (privé)
        </Link>
        <span aria-hidden>/</span>
        <span className="max-w-[46ch] truncate text-foreground/80" title={guide.title}>
          {guide.title}
        </span>
      </nav>

      <GuideView guide={guide} related={related} />

      <nav aria-label="Guides précédent et suivant" className="mt-10 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/docs/guides/plateforme/${prev.id}`}
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
            href={`/docs/guides/plateforme/${next.id}`}
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
    </>
  );
}

export default function PlatformGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <PlatformGate>
      <PlatformGuideBody slug={slug} />
    </PlatformGate>
  );
}
