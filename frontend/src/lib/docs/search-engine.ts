// ─────────────────────────────────────────────────────────────────────────────
// /docs/guides — moteur de recherche maison de la palette ⌘K (N°333-C).
//
// Zéro dépendance. Recherche insensible aux accents (NFD + suppression des
// combining marks), tokenisation par espaces/apostrophes/tirets (la requête
// et l'index partagent LA MÊME découpe : « pare-feu » ≈ « pare feu » ≈
// « parfeu »), correspondance par PRÉFIXE de mot + tolérance de frappe
// (Levenshtein borné ≤ 1 pour les jetons ≥ 4 caractères) + BIGRAMMES COLLÉS
// (« pare » + « feu » matchent aussi « parefeu »). Scoring pondéré par
// champ :
//     titre du guide ×5 · titre de section ×3 · intitulé de bloc (h) ×3 ·
//     texte de bloc (t) ×1 — avec bonus ×1,5 quand tous les jetons matchent
//     le même champ.
//
// Le moteur précalcule une seule fois (à la création) les champs normalisés
// de l'index reçu de /docs/search-index.json — search() ne re-normalise rien.
// Consommé par src/components/docs/docs-command.tsx.
// ─────────────────────────────────────────────────────────────────────────────

/** Normalisation : NFD → suppression des diacritiques → minuscules → trim. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/* ── Types de l'index (miroir du format servi par /docs/search-index.json) ── */

export interface SearchIndexBlock {
  /** Ancre du bloc dans la page du guide (ex. « pieges »). */
  a: string;
  /** Intitulé lisible du bloc (ex. « Pièges & astuces »). */
  h: string;
  /** Texte concaténé du bloc (bodies, titres d'étapes, astuces, Q+A). */
  t: string;
}

export interface SearchIndexEntry {
  id: string;
  title: string;
  summary: string;
  sectionId: string;
  sectionTitle: string;
  minutes: number;
  updated: string;
  /** Page du guide — URLs hiérarchiques N°333-C : /docs/guides/<sectionId>/<id> */
  url: string;
  blocks: SearchIndexBlock[];
}

export interface SearchIndex {
  version: number;
  generated: string;
  entries: SearchIndexEntry[];
}

/* ── Résultat ─────────────────────────────────────────────────────────────── */

export interface SearchHit {
  /** Entrée d'index du guide concerné (référence directe, non copiée). */
  entry: SearchIndexEntry;
  guideTitle: string;
  sectionTitle: string;
  /** URL de la page du guide (sans ancre). */
  url: string;
  /** Ancre du bloc qui a matché (ex. « pieges »). */
  anchor: string;
  /** Intitulé du bloc qui a matché (ex. « Pièges & astuces »). */
  heading: string;
  score: number;
  /** Facultatif : première phrase du bloc contenant un jeton (±60 car.). */
  snippet?: string;
}

/* ── Réglages du moteur ───────────────────────────────────────────────────── */

const WEIGHT_GUIDE_TITLE = 5;
const WEIGHT_SECTION_TITLE = 3;
const WEIGHT_BLOCK_HEADING = 3;
const WEIGHT_BLOCK_TEXT = 1;
/** Bonus multiplicatif quand tous les jetons matchent le même champ. */
const SAME_FIELD_BONUS = 1.5;
/** 2e bloc d'un guide conservé seulement s'il vaut ≥ 60 % du meilleur. */
const SECOND_BLOCK_RATIO = 0.6;
/** Maximum de résultats au total (et 2 par guide au plus). */
const MAX_RESULTS = 12;
/** Demi-fenêtre du snippet autour du mot trouvé. */
const SNIPPET_RADIUS = 60;
/** Tolérance de frappe active à partir de 4 caractères (Levenshtein ≤ 1). */
const FUZZY_MIN_TOKEN = 4;

/* ── Précalcul ────────────────────────────────────────────────────────────── */

/**
 * Découpe un texte DÉJÀ normalisé en mots. Espaces, apostrophes (droite et
 * courbe) et tirets servent de séparateurs : « l'acces » → [« l », « acces »],
 * « passe-partout » → [« passe », « partout »]. La requête et l'index
 * partagent cette découpe (N°333-C : « pare-feu » tapé avec ou sans tiret
 * trouve les mêmes mots).
 */
function toWords(normalized: string): string[] {
  return normalized.split(/[\s'’-]+/u).filter((w) => w.length > 0);
}

/**
 * Ajoute les BIGRAMMES COLLÉS (« pare » + « feu » → « parefeu ») : la
 * requête tapée sans séparateur trouve les mots composés de l'index.
 */
function withJoins(words: string[]): string[] {
  if (words.length < 2) return words;
  const out = words.slice();
  for (let i = 0; i + 1 < words.length; i += 1) {
    out.push(words[i] + words[i + 1]);
  }
  return out;
}

/** Distance de Levenshtein bornée : vrai si d(a, b) ≤ max (early exit). */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > max) return false;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] <= max;
}

/** Un jeton matche un mot : préfixe exact, ou tolérance d'une faute (≥ 4 car.). */
function matchesWord(word: string, token: string): boolean {
  if (word.startsWith(token)) return true;
  if (token.length >= FUZZY_MIN_TOKEN && Math.abs(word.length - token.length) <= 1) {
    return withinEditDistance(word, token, 1);
  }
  return false;
}

/** Un jeton matche un champ si un mot du champ correspond (préfixe ou faute). */
function someMatches(words: readonly string[], token: string): boolean {
  for (const w of words) {
    if (matchesWord(w, token)) return true;
  }
  return false;
}

/** Jetons de la requête : même normalisation/découpe que l'index. */
function tokenizeQuery(query: string): string[] {
  return toWords(normalize(query));
}

interface PreparedBlock {
  block: SearchIndexBlock;
  /** Mots normalisés de l'intitulé (h). */
  hWords: string[];
  /** Mots normalisés du texte (t). */
  tWords: string[];
  /** Phrases brutes du texte (pour le snippet). */
  sentences: string[];
}

interface PreparedEntry {
  entry: SearchIndexEntry;
  titleWords: string[];
  sectionWords: string[];
  blocks: PreparedBlock[];
}

/**
 * Score d'un bloc pour une requête. Renvoie 0 si UN SEUL jeton ne matche
 * aucun des quatre champs (exigence « chaque token doit matcher »).
 */
function scoreBlock(
  entry: PreparedEntry,
  block: PreparedBlock,
  tokens: readonly string[],
): number {
  let score = 0;
  let allInGuideTitle = true;
  let allInSectionTitle = true;
  let allInHeading = true;
  let allInText = true;

  for (const token of tokens) {
    const inGuideTitle = someMatches(entry.titleWords, token);
    const inSectionTitle = someMatches(entry.sectionWords, token);
    const inHeading = someMatches(block.hWords, token);
    const inText = someMatches(block.tWords, token);

    if (!inGuideTitle && !inSectionTitle && !inHeading && !inText) return 0;

    if (inGuideTitle) score += WEIGHT_GUIDE_TITLE;
    if (inSectionTitle) score += WEIGHT_SECTION_TITLE;
    if (inHeading) score += WEIGHT_BLOCK_HEADING;
    if (inText) score += WEIGHT_BLOCK_TEXT;

    if (!inGuideTitle) allInGuideTitle = false;
    if (!inSectionTitle) allInSectionTitle = false;
    if (!inHeading) allInHeading = false;
    if (!inText) allInText = false;
  }

  // Bonus : tous les jetons retrouvés dans un même champ (ex. toute la
  // requête tient dans l'intitulé « Pièges & astuces » → forte cohérence).
  if (allInGuideTitle || allInSectionTitle || allInHeading || allInText) {
    score = Math.round(score * SAME_FIELD_BONUS);
  }
  return score;
}

/**
 * Snippet : première phrase du bloc contenant un jeton, fenêtrée à ±60
 * caractères autour du premier mot correspondant (robuste aux accents : la
 * fenêtre est calculée sur le texte BRUT, jamais sur la forme normalisée).
 */
function makeSnippet(
  block: PreparedBlock,
  tokens: readonly string[],
): string | undefined {
  for (const sentence of block.sentences) {
    const sentenceWords = toWords(normalize(sentence));
    if (!tokens.some((t) => someMatches(sentenceWords, t))) continue;

    // Localise le premier mot brut qui correspond à un jeton.
    const wordRe = /\S+/gu;
    let match: RegExpExecArray | null;
    while ((match = wordRe.exec(sentence)) !== null) {
      const raw = normalize(match[0]);
      if (tokens.some((t) => matchesWord(raw, t))) {
        const start = Math.max(0, match.index - SNIPPET_RADIUS);
        const end = Math.min(
          sentence.length,
          match.index + match[0].length + SNIPPET_RADIUS,
        );
        const lead = start > 0 ? "…" : "";
        const tail = end < sentence.length ? "…" : "";
        return `${lead}${sentence.slice(start, end).trim()}${tail}`;
      }
    }
  }
  return undefined;
}

/* ── Fabrique ─────────────────────────────────────────────────────────────── */

/**
 * Crée le moteur : l'index est normalisé UNE fois ici (champs mot à mot,
 * phrases par bloc), la requête est normalisée à chaque search().
 */
export function createSearchEngine(
  index: Pick<SearchIndex, "entries">,
): { search: (query: string) => SearchHit[] } {
  const prepared: PreparedEntry[] = index.entries.map((entry) => ({
    entry,
    titleWords: withJoins(toWords(normalize(entry.title))),
    sectionWords: withJoins(toWords(normalize(entry.sectionTitle))),
    blocks: entry.blocks.map((block) => ({
      block,
      hWords: withJoins(toWords(normalize(block.h))),
      tWords: withJoins(toWords(normalize(block.t))),
      sentences: block.t.match(/[^.!?]+[.!?]*/gu) ?? [],
    })),
  }));

  function search(query: string): SearchHit[] {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    interface Ranked {
      hit: SearchHit;
      entryOrder: number;
      blockOrder: number;
    }
    const ranked: Ranked[] = [];

    for (let entryOrder = 0; entryOrder < prepared.length; entryOrder += 1) {
      const entry = prepared[entryOrder];

      // 1. Score chaque bloc du guide — seuls les blocs > 0 sont candidats.
      const candidates: { block: PreparedBlock; score: number; order: number }[] = [];
      for (let order = 0; order < entry.blocks.length; order += 1) {
        const block = entry.blocks[order];
        const score = scoreBlock(entry, block, tokens);
        if (score > 0) candidates.push({ block, score, order });
      }
      if (candidates.length === 0) continue;

      // Score décroissant ; à égalité, l'ordre du gabarit Q&A l'emporte.
      candidates.sort((a, b) => b.score - a.score || a.order - b.order);

      // 2. Meilleur bloc par guide — un 2e uniquement s'il reste très
      //    pertinent (≥ 60 % du meilleur). Max 2 résultats par guide.
      const best = candidates[0];
      const second = candidates[1];
      const chosen =
        second !== undefined && second.score >= best.score * SECOND_BLOCK_RATIO
          ? [best, second]
          : [best];

      for (const candidate of chosen) {
        ranked.push({
          hit: {
            entry: entry.entry,
            guideTitle: entry.entry.title,
            sectionTitle: entry.entry.sectionTitle,
            url: entry.entry.url,
            anchor: candidate.block.block.a,
            heading: candidate.block.block.h,
            score: candidate.score,
            snippet: makeSnippet(candidate.block, tokens),
          },
          entryOrder,
          blockOrder: candidate.order,
        });
      }
    }

    // 3. Classement global : score décroissant, ordre du catalogue à égalité.
    ranked.sort(
      (a, b) =>
        b.hit.score - a.hit.score ||
        a.entryOrder - b.entryOrder ||
        a.blockOrder - b.blockOrder,
    );

    return ranked.slice(0, MAX_RESULTS).map((r) => r.hit);
  }

  return { search };
}
