"use client";

// Rendu d'un guide complet (N°304, N°333-C) — gabarit Q&A validé :
// C'est quoi ? / Différences / Que recevez-vous ? / Étapes (captures) /
// Usages / Pièges & astuces / FAQ + « À lire ensuite » (related — rendu
// depuis N°333-C, données maintenues depuis N°304). Utilisé par les pages
// publiques (/docs/guides/<section>/<slug>) ET par la route gated
// plateforme (même rendu).

import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpenText,
  CircleHelp,
  Clock3,
  GitCompareArrows,
  Inbox,
  Lightbulb,
  ListChecks,
  Package,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import type { Guide } from "@/lib/docs/types";
import { Capture } from "./capture";

/** Carte « À lire ensuite » (N°333-C) — related pré-résolu par la page. */
export interface RelatedGuideCard {
  href: string;
  title: string;
  sectionTitle: string;
  minutes: number;
}

function paragraphs(text: string) {
  return text.split("\n\n").map((p, i) => (
    <p key={i} className="text-[15px] leading-7 text-foreground/90">
      {p}
    </p>
  ));
}

/** Titre de section d'ancre du guide (lien TOC). */
export const GUIDE_ANCHORS = [
  { id: "cest-quoi", label: "C'est quoi ?" },
  { id: "differences", label: "Différences" },
  { id: "recoit", label: "Que recevez-vous ?" },
  { id: "etapes", label: "Comment l'utiliser ?" },
  { id: "usages", label: "Quels usages ?" },
  { id: "pieges", label: "Pièges & astuces" },
  { id: "faq", label: "Questions fréquentes" },
] as const;

function SectionTitle({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="docs-h2 mt-12 flex scroll-mt-24 items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground first:mt-8">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      {children}
    </h2>
  );
}

export function GuideView({ guide, related }: { guide: Guide; related?: RelatedGuideCard[] }) {
  return (
    <article className="docs-guide">
      {/* ── En-tête du guide ─────────────────────────────────────────── */}
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-3.5" aria-hidden />
            {guide.roles}
          </span>
          <span aria-hidden>·</span>
          <span>{guide.minutes} min de lecture</span>
          <span aria-hidden>·</span>
          <span>Mis à jour le {guide.updated}</span>
        </div>
        <h1 className="mt-3 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {guide.title}
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-7 text-muted-foreground">{guide.summary}</p>
      </header>

      <Separator className="my-8" />

      {/* ── 1. C'est quoi ? ──────────────────────────────────────────── */}
      <SectionTitle id="cest-quoi" icon={BookOpenText}>
        C'est quoi ?
      </SectionTitle>
      <div className="mt-4 space-y-4">{paragraphs(guide.quoi)}</div>

      {/* ── 2. Quelle différence avec… ? ────────────────────────────── */}
      {guide.difference.length > 0 ? (
        <>
          <SectionTitle id="differences" icon={GitCompareArrows}>
            Quelle différence avec…
          </SectionTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {guide.difference.map((d) => (
              <Card key={d.with} className="border-border/60 bg-card/80">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">vs {d.with}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{d.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {/* ── 3. Que recevez-vous ? ───────────────────────────────────── */}
      {guide.recoit.length > 0 ? (
        <>
          <SectionTitle id="recoit" icon={Package}>
            Que recevez-vous ?
          </SectionTitle>
          <ul className="mt-4 space-y-2.5">
            {guide.recoit.map((r, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-7 text-foreground/90">
                <Inbox className="mt-1.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ── 4. Comment l'utiliser ? (étapes + captures) ─────────────── */}
      {guide.etapes.length > 0 ? (
        <>
          <SectionTitle id="etapes" icon={ListChecks}>
            Comment l'utiliser ?
          </SectionTitle>
          <ol className="mt-6 space-y-10">
            {guide.etapes.map((step, i) => (
              <li key={i} className="docs-step relative">
                <div className="flex items-center gap-3">
                  <span className="docs-step-n flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-sm" aria-hidden>
                    {i + 1}
                  </span>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                </div>
                <div className="mt-3 space-y-4 border-l-2 border-border/60 pl-6 ml-4 sm:ml-4">
                  {paragraphs(step.body)}
                  {step.tip ? (
                    <div className="docs-tip rounded-lg border border-primary/25 bg-primary/8 px-4 py-3">
                      <p className="flex gap-2.5 text-sm leading-6 text-foreground/90">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <span>
                          <span className="font-semibold">Astuce — </span>
                          {step.tip}
                        </span>
                      </p>
                    </div>
                  ) : null}
                  {step.capture ? <Capture capture={step.capture} /> : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {/* ── 5. Quels usages ? ───────────────────────────────────────── */}
      {guide.usages.length > 0 ? (
        <>
          <SectionTitle id="usages" icon={Sparkles}>
            Quels usages ?
          </SectionTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {guide.usages.map((u) => (
              <Card key={u.title} className="border-border/60 bg-card/80">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">{u.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{u.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {/* ── 6. Pièges & astuces ─────────────────────────────────────── */}
      {guide.pieges.length > 0 ? (
        <>
          <SectionTitle id="pieges" icon={TriangleAlert}>
            Pièges & astuces
          </SectionTitle>
          <ul className="mt-4 space-y-3">
            {guide.pieges.map((p, i) => (
              <li
                key={i}
                className={`rounded-lg border px-4 py-3 ${
                  p.severity === "warn"
                    ? "border-destructive/30 bg-destructive/8"
                    : "border-border/60 bg-muted/30"
                }`}
              >
                <p className="flex gap-2.5 text-sm leading-6">
                  <TriangleAlert
                    className={`mt-0.5 size-4 shrink-0 ${p.severity === "warn" ? "text-destructive" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <span className="text-foreground/90">
                    <span className="font-semibold">{p.title} — </span>
                    {p.body}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ── 7. FAQ ──────────────────────────────────────────────────── */}
      {guide.faq.length > 0 ? (
        <>
          <SectionTitle id="faq" icon={CircleHelp}>
            Questions fréquentes
          </SectionTitle>
          <Accordion type="single" collapsible className="mt-4">
            {guide.faq.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-[15px] font-medium text-foreground hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      ) : null}

      {/* ── À lire ensuite (related, N°333-C) ─────────────────────── */}
      {related && related.length > 0 ? (
        <section aria-labelledby="a-lire-ensuite" className="mt-12">
          <h2
            id="a-lire-ensuite"
            className="docs-h2 mt-0 flex scroll-mt-24 items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpenText className="size-4.5" aria-hidden />
            </span>
            À lire ensuite
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="group rounded-xl border border-border/60 bg-card/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary/80">{r.sectionTitle}</p>
                <p className="mt-1.5 text-sm font-semibold leading-5 text-foreground group-hover:text-primary">
                  {r.title}
                </p>
                <p className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden />
                  {r.minutes} min
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12 flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">guide</Badge>
          <span className="font-mono">{guide.id}</span>
        </span>
        <span>Documentation 403Shield · volet {guide.sectionId === "plateforme" ? "plateforme (privé)" : "exploitant (public)"}</span>
      </div>
    </article>
  );
}
