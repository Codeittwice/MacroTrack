/**
 * Text normalisation shared by the food-source index and the search query path.
 * Keeping index/query normalisation identical is what makes MiniSearch matches useful.
 */

const BRAND_PREFIXES: { phrase: string; canonical: string }[] = [
  { phrase: 'albert heijn', canonical: 'ah' },
  { phrase: 'ah', canonical: 'ah' },
  { phrase: 'jumbo', canonical: 'jumbo' },
  { phrase: 'lidl', canonical: 'lidl' },
  { phrase: 'aldi', canonical: 'aldi' },
  { phrase: 'plus', canonical: 'plus' },
];

/** Lowercase, strip diacritics, replace punctuation with spaces, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Small, conservative Dutch stemmer for plurals/diminutives.
 * Rules applied in order; never returns '' or a stem shorter than 3 chars.
 */
export function stemNl(token: string): string {
  const t = token;
  if (t.length < 4) return t;

  // -etjes (e.g. huisjes -> huis is handled by -jes; -etjes for words like 'plaatjes'... keep conservative)
  if (t.endsWith('etjes') && t.length - 5 >= 3) {
    return t.slice(0, -5);
  }
  // -tjes / -tje (appeltje/appeltjes -> appel)
  if (t.endsWith('tjes') && t.length - 4 >= 3) {
    return t.slice(0, -4);
  }
  if (t.endsWith('tje') && t.length - 3 >= 3) {
    return t.slice(0, -3);
  }
  // -jes / -je (huisjes -> huis, broodje -> brood)
  if (t.endsWith('jes') && t.length - 3 >= 3) {
    return t.slice(0, -3);
  }
  if (t.endsWith('je') && t.length - 2 >= 3) {
    return t.slice(0, -2);
  }
  // -en, only if remaining stem is >= 3 chars; undouble a doubled final consonant
  // (kipfiletten -> kipfilett -> kipfilet)
  if (t.endsWith('en') && t.length - 2 >= 3) {
    let stem = t.slice(0, -2);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2] && /[bcdfghjklmnpqrstvwxz]/.test(stem[stem.length - 1])) {
      stem = stem.slice(0, -1);
    }
    if (stem.length >= 3) return stem;
  }
  // -s, only if token length > 4 and does not end in 'ss'
  if (t.length > 4 && t.endsWith('s') && !t.endsWith('ss')) {
    const stem = t.slice(0, -1);
    if (stem.length >= 3) return stem;
  }
  return t;
}

/** Synonym map applied after normalisation/stemming. Bidirectional. */
const SYNONYM_GROUPS: string[][] = [
  ['turks', 'turkse'],
  ['kipfilet', 'chicken breast'],
  ['pindakaas', 'peanut butter'],
  ['brood', 'boterham'],
  ['yoghurt', 'yogurt'],
  ['kwark', 'quark'],
];

/** Canonicalise a single normalised (unstemmed) token/phrase to its group's primary form, if any. */
function canonicalize(word: string): string {
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(word)) return group[0];
  }
  return word;
}

/** Return the extra tokens/phrases to OR into a search query for synonym coverage. */
export function expandSynonyms(tokens: string[]): string[] {
  const extra = new Set<string>();
  for (const tok of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(tok)) {
        for (const alt of group) {
          if (alt !== tok) alt.split(' ').forEach((w) => extra.add(w));
        }
      }
    }
  }
  return [...extra];
}

/** processTerm used by MiniSearch, shared between indexing and querying. */
export function normalizeForIndex(term: string): string | false {
  const norm = normalizeText(term);
  if (!norm) return false;
  // processTerm receives single tokens already split by MiniSearch's tokenizer,
  // but guard for stray whitespace anyway.
  const first = norm.split(' ')[0];
  if (!first) return false;
  return canonicalize(stemNl(first));
}

export interface NormalizedQuery {
  text: string;
  brand?: string;
  tokens: string[];
}

/** Normalise a raw user query: extract a leading brand prefix, stem+canonicalise the rest. */
export function normalizeQuery(q: string): NormalizedQuery {
  const norm = normalizeText(q);
  let rest = norm;
  let brand: string | undefined;

  for (const { phrase, canonical } of BRAND_PREFIXES) {
    if (rest === phrase || rest.startsWith(phrase + ' ')) {
      brand = canonical;
      rest = rest.slice(phrase.length).trim();
      break;
    }
  }

  const rawTokens = rest.split(' ').filter(Boolean);
  const tokens = rawTokens.map((t) => canonicalize(stemNl(t)));

  return { text: rest, brand, tokens };
}

/**
 * Whole-query synonym variants: for every synonym phrase found (as whole words) in the
 * normalised text, return the text with that phrase swapped for each alternative.
 * e.g. 'peanut butter light' → ['pindakaas light']; 'kipfilet' → ['chicken breast'].
 */
export function synonymVariants(text: string): string[] {
  const out = new Set<string>();
  const padded = ` ${text} `;
  for (const group of SYNONYM_GROUPS) {
    for (const member of group) {
      if (!padded.includes(` ${member} `)) continue;
      for (const alt of group) {
        if (alt === member) continue;
        out.add(padded.replace(` ${member} `, ` ${alt} `).trim());
      }
    }
  }
  out.delete(text);
  return [...out];
}
