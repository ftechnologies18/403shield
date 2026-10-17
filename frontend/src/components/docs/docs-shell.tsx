"use client";

// Coquille /docs/guides (N°304) — 3 colonnes style documentation moderne :
// navigation arborescente (gauche) · contenu (centre) · sommaire sticky
// (droite). Mobile : nav en sheet, sommaire en repli. Thème 403Shield
// « Charbon & Corail » (jour/nuit via tokens existants).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText, ListTree, LogIn, Menu, Rocket, Wifi } from "lucide-react";
import type { GuideMetaLight } from "@/lib/docs/catalog";
import { GUIDE_ANCHORS } from "./guide-view";

/* ── Icône par section (mapping sûr, aucune import dynamique) ─────────── */
function SectionIcon({ id }: { id: string }) {
  if (id === "demarrer") return <Rocket className="size-3.5" aria-hidden />;
  if (id === "annexes") return <Wifi className="size-3.5" aria-hidden />;
  return <FileText className="size-3.5" aria-hidden />;
}

/* ── Arbre de navigation : sections repliables + guides ────────────────── */
export function DocsNav({
  sections,
  currentId,
  onNavigate,
}: {
  sections: { id: string; title: string; guides: GuideMetaLight[] }[];
  currentId?: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const active = sections.find((s) => s.guides.some((g) => g.id === currentId));
    const init: Record<string, boolean> = {};
    for (const s of sections) init[s.id] = s.id === active?.id || s.id === "demarrer";
    return init;
  });

  return (
    <nav aria-label="Guides — navigation par section" className="docs-nav text-sm">
      <ul className="space-y-1">
        {sections.map((s) => (
            <li key={s.id}>
              <Collapsible open={open[s.id] ?? false} onOpenChange={(v) => setOpen((o) => ({ ...o, [s.id]: v }))}>
                <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
                  <SectionIcon id={s.id} />
                  <span className="flex-1">{s.title}</span>
                  <span className="text-[11px] font-normal tabular-nums text-muted-foreground/70">{s.guides.length}</span>
                  <ChevronDown
                    className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mb-1 ml-1 space-y-0.5 border-l border-border/60 pl-2">
                    {s.guides.map((g) => {
                      const active = g.id === currentId;
                      return (
                        <li key={g.id}>
                          <Link
                            href={`/docs/guides/${g.id}`}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={`block truncate rounded-md px-2.5 py-1.5 text-[13.5px] leading-5 transition-colors ${
                              active
                                ? "bg-primary/12 font-medium text-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            }`}
                          >
                            {g.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Sommaire (TOC) : scrollspy sur les ancres du guide ────────────────── */
export function DocsToc() {
  const [active, setActive] = useState<string>("cest-quoi");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const { id } of GUIDE_ANCHORS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Sommaire du guide" className="docs-toc text-sm">
      <p className="flex items-center gap-2 px-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ListTree className="size-3.5" aria-hidden />
        Sommaire
      </p>
      <ul className="mt-3 space-y-1 border-l border-border/70">
        {GUIDE_ANCHORS.map((a) => (
          <li key={a.id}>
            <a
              href={`#${a.id}`}
              className={`-ml-px block border-l-2 py-1 pl-3 text-[13.5px] transition-colors ${
                active === a.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Coquille complète : header + nav + contenu + TOC ──────────────────── */
export function DocsShell({
  sections,
  currentId,
  children,
  withToc,
}: {
  sections: { id: string; title: string; guides: GuideMetaLight[] }[];
  currentId?: string;
  children: React.ReactNode;
  withToc?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="docs-shell flex min-h-screen flex-col bg-background text-foreground">
      <header className="docs-header sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Ouvrir la navigation des guides">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-4 pr-3">
              <SheetTitle className="sr-only">Navigation des guides</SheetTitle>
              <Link
                href="/docs/guides"
                onClick={() => setNavOpen(false)}
                className="mb-4 flex items-center gap-2 px-2 text-sm font-semibold text-foreground"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-[11px] font-bold text-primary-foreground">403</span>
                403Shield · Guides
              </Link>
              <DocsNav sections={sections} currentId={currentId} onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link href="/docs/guides" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-[11px] font-bold text-primary-foreground shadow-sm" aria-hidden>
              403
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              403Shield <span className="font-normal text-muted-foreground">· Guides</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-9 px-3 text-[13px] text-muted-foreground hover:text-foreground">
              <Link href="/">
                <Wifi className="size-4" aria-hidden />
                <span className="hidden sm:inline">Accueil</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 px-3.5 text-[13px]">
              <Link href="/login">
                <LogIn className="size-4" aria-hidden />
                Console
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_208px]">
        <aside className="docs-nav-col hidden lg:block" aria-label="Navigation des guides">
          <div className="sticky top-[76px] max-h-[calc(100vh-100px)] overflow-y-auto pr-2 [scrollbar-width:thin]">
            <DocsNav sections={sections} currentId={currentId} />
          </div>
        </aside>

        <main className="docs-content min-w-0" id="contenu">
          {children}
        </main>

        {withToc ? (
          <aside className="docs-toc-col hidden xl:block" aria-label="Sommaire">
            <div className="sticky top-[76px]">
              <DocsToc />
            </div>
          </aside>
        ) : (
          <div className="hidden xl:block" aria-hidden />
        )}
      </div>

      <footer className="docs-footer mt-auto border-t border-border/60 bg-card/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>
            403Shield — guides d'exploitation · <Link href="/" className="underline-offset-2 hover:underline">403shield.ftci.fr</Link>
          </p>
          <p>Documentation en français · captures production 2026-10-12</p>
        </div>
      </footer>
    </div>
  );
}
