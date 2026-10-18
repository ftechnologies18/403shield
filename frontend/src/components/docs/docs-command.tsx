"use client";

// Palette ⌘K de recherche plein texte des guides (N°333-C).
//
// Composant autonome SANS prop — monté par le tuteur dans le header du shell
// docs. Raccourcis globaux : ⌘K / Ctrl+K (bascule) et « / » hors champ de
// saisie. L'index (/docs/search-index.json, route statique build-time) est
// chargé PARESSEUSEMENT à la première ouverture puis gardé en cache mémoire
// module (survit aux remontées du composant) ; moteur maison createSearchEngine
// (src/lib/docs/search-engine.ts) ; debounce 100 ms sur la saisie.
//
// Dialog Radix + cmdk avec shouldFilter={false} : le filtrage/scoring est
// celui du moteur maison (insensible aux accents), cmdk ne garde que la
// navigation clavier (↑↓ Entrée, aria listbox/option, scrollIntoView) et
// rend le focus au trigger à la fermeture.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, FileText, Loader2, Search } from "lucide-react";
import {
  createSearchEngine,
  type SearchIndex,
} from "@/lib/docs/search-engine";

/* ── Réglages ─────────────────────────────────────────────────────────────── */

/** Debounce de la saisie (ms). */
const DEBOUNCE_MS = 100;
/** Guides suggérés quand la requête est vide (premiers du catalogue). */
const SUGGESTED_COUNT = 6;

/** Valeurs cmdk des items d'action (erreur / aucun résultat). */
const ACTION_RETRY = "action-retry";
const ACTION_OPEN_HUB = "action-open-hub";

/** Cache mémoire module : l'index, une fois chargé, survit aux remontées. */
let indexCache: SearchIndex | null = null;

/* ── Ligne de résultat (résultat de recherche OU suggestion) ──────────────── */

interface ResultRowProps {
  /** Identifiant cmdk (sélection clavier) — unique dans la liste. */
  value: string;
  /** Titre du guide. */
  title: string;
  /** Intitulé du bloc cliqué (ex. « Pièges & astuces ») — absent sur les suggestions. */
  heading?: string;
  /** Snippet (résultat) ou résumé (suggestion). */
  detail?: string;
  sectionTitle: string;
  minutes: number;
  onSelect: () => void;
}

function ResultRow({
  value,
  title,
  heading,
  detail,
  sectionTitle,
  minutes,
  onSelect,
}: ResultRowProps) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="items-start gap-3 py-2.5">
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {heading ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
            › {heading}
          </p>
        ) : null}
        {detail ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground/90">
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <Badge
          variant="secondary"
          className="hidden max-w-36 truncate text-[10px] font-normal text-muted-foreground sm:inline-flex"
        >
          {sectionTitle}
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] font-normal tabular-nums text-muted-foreground"
        >
          {minutes} min
        </Badge>
      </div>
    </CommandItem>
  );
}

/* ── Palette ──────────────────────────────────────────────────────────────── */

export function DocsCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(indexCache);
  const [loadError, setLoadError] = useState(false);
  /** Garde-fou anti double-fetch. */
  const requestedRef = useRef(false);

  /** Moteur créé UNE fois l'index reçu (précalcul des champs normalisés). */
  const engine = useMemo(() => (index ? createSearchEngine(index) : null), [index]);

  /** Chargement paresseux : fetch à la première ouverture, puis cache. */
  const loadIndex = useCallback(() => {
    if (indexCache) {
      setIndex(indexCache);
      return;
    }
    if (requestedRef.current) return;
    requestedRef.current = true;
    setLoadError(false);
    fetch("/docs/search-index.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SearchIndex>;
      })
      .then((data) => {
        indexCache = data;
        setIndex(data);
      })
      .catch(() => {
        // Échec : on relâche le verrou pour permettre une nouvelle tentative.
        requestedRef.current = false;
        setLoadError(true);
      });
  }, []);

  /** Ouverture de la palette — déclenche le chargement paresseux (événement,
   *  jamais depuis un effet : les setState restent côté handler). */
  const openPalette = useCallback(() => {
    setOpen(true);
    loadIndex();
  }, [loadIndex]);

  /* Debounce 100 ms sur la saisie. */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  /* Raccourcis globaux : ⌘K / Ctrl+K (bascule) et « / » hors champ de saisie. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openPalette();
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target;
        if (target instanceof HTMLElement) {
          const tag = target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
            return;
          }
        }
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette]);

  /** Ferme la palette PUIS navigue — l'ancre est résolue par le scrollspy du shell. */
  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router],
  );

  const trimmed = debouncedQuery.trim();
  const hits = useMemo(() => {
    if (!engine || trimmed === "") return [];
    return engine.search(debouncedQuery);
  }, [engine, debouncedQuery, trimmed]);
  const suggestions = useMemo(
    () => index?.entries.slice(0, SUGGESTED_COUNT) ?? [],
    [index],
  );

  /* ── État de la liste (erreur · chargement · suggestions · vide · résultats) */

  type PaletteMode = "error" | "loading" | "suggestions" | "empty" | "results";
  const mode: PaletteMode = loadError
    ? "error"
    : engine === null
      ? "loading"
      : trimmed === ""
        ? "suggestions"
        : hits.length === 0
          ? "empty"
          : "results";

  /* ── Sélection cmdk CONTRÔLÉE : avec shouldFilter={false}, cmdk ne
     re-sélectionne pas le premier item quand la liste change (la sélection
     resterait sur un item disparu — Entrée morte). On dérive la valeur
     effective à chaque rendu : sélection mémorisée si toujours valide,
     sinon premier item de la liste courante. Zéro effet, zéro setState
     synchrone — ArrowDown/hover passent par onValueChange. */
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);

  const rowValues = useMemo(() => {
    if (mode === "error") return [ACTION_RETRY];
    if (mode === "loading") return [];
    if (mode === "empty") return [ACTION_OPEN_HUB];
    if (mode === "suggestions") return suggestions.map((e) => `suggest-${e.id}`);
    return hits.map((h) => `hit-${h.entry.id}-${h.anchor}`);
  }, [mode, suggestions, hits]);

  const effectiveValue =
    selectedValue !== undefined && rowValues.includes(selectedValue)
      ? selectedValue
      : rowValues[0];

  /* Corps de la liste selon l'état. */
  let body: React.ReactNode;
  if (mode === "error") {
    body = (
      <div className="px-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Impossible de charger l&apos;index de recherche.
        </p>
        <CommandItem
          value={ACTION_RETRY}
          onSelect={() => {
            requestedRef.current = false;
            loadIndex();
          }}
          className="mt-2 justify-center gap-2 rounded-md border border-border bg-muted/40 text-sm font-medium"
        >
          <Loader2 className="size-4" aria-hidden />
          Réessayer
        </CommandItem>
      </div>
    );
  } else if (mode === "loading") {
    body = (
      <div className="space-y-2 px-3 py-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Chargement de l&apos;index…
        </p>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
        <Skeleton className="h-10 w-4/6" />
      </div>
    );
  } else if (mode === "suggestions") {
    body = (
      <CommandGroup heading="Commencez par là">
        {suggestions.map((entry) => (
          <ResultRow
            key={`suggest-${entry.id}`}
            value={`suggest-${entry.id}`}
            title={entry.title}
            detail={entry.summary}
            sectionTitle={entry.sectionTitle}
            minutes={entry.minutes}
            onSelect={() => navigate(entry.url)}
          />
        ))}
      </CommandGroup>
    );
  } else if (mode === "empty") {
    body = (
      <div className="px-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun guide ne correspond à «&nbsp;{trimmed}&nbsp;».
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Essayez «&nbsp;vouchers&nbsp;», «&nbsp;sessions&nbsp;», «&nbsp;revendeurs&nbsp;», «&nbsp;portail&nbsp;»…
        </p>
        <CommandItem
          value={ACTION_OPEN_HUB}
          onSelect={() => navigate("/docs/guides")}
          className="mt-3 justify-center gap-2 rounded-md border border-border bg-muted/40 text-sm font-medium"
        >
          <ArrowRight className="size-4" aria-hidden />
          Ouvrir le hub des guides
        </CommandItem>
      </div>
    );
  } else {
    body = (
      <CommandGroup
        heading={`${hits.length} résultat${hits.length > 1 ? "s" : ""}`}
      >
        {hits.map((hit) => (
          <ResultRow
            key={`hit-${hit.entry.id}-${hit.anchor}`}
            value={`hit-${hit.entry.id}-${hit.anchor}`}
            title={hit.guideTitle}
            heading={hit.heading}
            detail={hit.snippet}
            sectionTitle={hit.sectionTitle}
            minutes={hit.entry.minutes}
            onSelect={() => navigate(`${hit.url}#${hit.anchor}`)}
          />
        ))}
      </CommandGroup>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Trigger : barre de recherche discrète — icône seule sous 640px.
          DialogTrigger asChild → Radix gère l'ouverture ET le retour du
          focus au trigger à la fermeture (triggerRef). */}
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Rechercher dans les guides"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-muted/50 text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-60 sm:justify-start sm:px-3"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden truncate text-sm sm:inline">
            Rechercher dans les guides…
          </span>
          <kbd className="pointer-events-none ml-auto hidden select-none items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      </DialogTrigger>

      {/* Palette : plein écran centré, façon commande. */}
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Rechercher dans les guides</DialogTitle>
          <DialogDescription>
            Recherche plein texte dans les guides 403Shield — résultats par
            bloc de guide, navigation clavier ↑↓ puis Entrée pour ouvrir.
          </DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          value={effectiveValue}
          onValueChange={setSelectedValue}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un mot-clé, une question, un bloc (ex. « vouchers », « pièges »)…"
            aria-label="Rechercher dans les guides"
          />
          <CommandList className="max-h-[min(56dvh,26rem)] [scrollbar-width:thin]">
            {body}
          </CommandList>
          <div className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            ↑↓ naviguer · Entrée ouvrir · Esc fermer
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
