import type { FoodItem, FoodSource, FoodSourceId } from '@/db/types';
import { nevoSource } from './nevo';
import { offSource } from './off';
import { userFoodsSource, recipesSource } from './user';
import { normalizeText, normalizeQuery, normalizeForIndex } from './normalize';

const registry = new Map<FoodSourceId, FoodSource>();

export function registerFoodSource(src: FoodSource): void {
  registry.set(src.id, src);
}

export function unregisterFoodSource(id: FoodSourceId): void {
  registry.delete(id);
}

export function getRegisteredSources(): FoodSource[] {
  return [...registry.values()];
}

let defaultsRegistered = false;
function ensureDefaults() {
  if (defaultsRegistered) return;
  defaultsRegistered = true;
  registerFoodSource(nevoSource);
  registerFoodSource(offSource);
  registerFoodSource(userFoodsSource);
  registerFoodSource(recipesSource);
}
ensureDefaults();

function nameTokens(name: string): string[] {
  return normalizeText(name)
    .split(' ')
    .filter(Boolean)
    .map((t) => normalizeForIndex(t) || t);
}

/**
 * Match tier of an item's name against the normalised query: 3 exact; 2.5 when every query word
 * matches and the name's first word is one of them (NEVO puts the base food first: "Melk halfvolle",
 * "Appel m schil"); 2 when every word matches somewhere; 1 otherwise. Compound words count as a
 * match on their head ("tarwebrood" matches "brood").
 */
function matchTier(item: FoodItem, queryText: string, queryTokens: string[]): number {
  // NEVO foods also carry an English name ("Boter ongezouten" / "Butter unsalted"); rank on the better of the two.
  const nl = nameTier(item.name, item.brand, queryText, queryTokens);
  return item.nameEn ? Math.max(nl, nameTier(item.nameEn, undefined, queryText, queryTokens)) : nl;
}

function nameTier(name: string, brand: string | undefined, queryText: string, queryTokens: string[]): number {
  const normName = normalizeText(name);
  const nameNoBrand = brand ? normName.replace(normalizeText(brand), '').trim() : normName;
  const targetName = nameNoBrand || normName;

  if (queryText && targetName === queryText) return 3;

  const tTokens = nameTokens(targetName);
  // NEVO writes compounds back to front with a hyphen: "Melk karne-" is karnemelk, "Ei kippen-" is kippenei.
  const words = name.split(/\s+/);
  const heads = words.filter((w, i) => i > 0 && w.endsWith('-')).map((w) => normalizeForIndex(w.slice(0, -1) + words[0].toLowerCase())).filter((t): t is string => !!t);
  const firstTokens = [tTokens[0], ...heads].filter(Boolean);
  const allTokens = [...tTokens, ...heads];
  const hit = (tt: string, qt: string) => tt.startsWith(qt) || (qt.length >= 4 && tt.endsWith(qt));
  if (queryTokens.length > 0 && queryTokens.every((qt) => allTokens.some((tt) => hit(tt, qt)))) {
    const same = (ft: string, qt: string) => ft === qt || (ft.startsWith(qt) && ft.length - qt.length <= 2) || (qt === 'brood' && ft.endsWith(qt)); // Dutch breads are compounds: tarwebrood, roggebrood
    if (firstTokens.some((ft) => queryTokens.some((qt) => same(ft, qt)))) return 2.75;
    return firstTokens.some((ft) => queryTokens.some((qt) => hit(ft, qt))) ? 2.5 : 2;
  }
  if (queryText && targetName.startsWith(queryText)) return 2;
  return 1;
}

const SOURCE_BOOST: Partial<Record<FoodSourceId, number>> = {
  user: 2,
  recipe: 2,
};

function sourceBoost(id: FoodSourceId): number {
  return SOURCE_BOOST[id] ?? 1;
}

export async function searchFoods(query: string, opts: { limit?: number; sources?: FoodSourceId[] } = {}): Promise<FoodItem[]> {
  ensureDefaults();
  const limit = opts.limit ?? 25;
  const q = query.trim();

  const wantedIds = opts.sources ?? [...registry.keys()];
  let sourcesToQuery = wantedIds.map((id) => registry.get(id)).filter((s): s is FoodSource => !!s);

  if (!q) {
    sourcesToQuery = sourcesToQuery.filter((s) => s.id === 'user' || s.id === 'recipe');
  }

  const perSourceLimit = limit * 2;
  const settled = await Promise.allSettled(sourcesToQuery.map((s) => s.search(q, perSourceLimit)));

  const { text, brand, tokens } = normalizeQuery(q);

  type Ranked = { item: FoodItem; tier: number; nlTier: number; boost: number; brandBump: number; generic: number; compound: number; words: number; order: number };
  const seen = new Map<string, Ranked>();

  settled.forEach((res, srcIdx) => {
    if (res.status !== 'fulfilled') return;
    const src = sourcesToQuery[srcIdx];
    res.value.forEach((item, idx) => {
      if (seen.has(item.id)) return;
      const tier = matchTier(item, text, tokens);
      const boost = sourceBoost(src.id);
      const brandBump = brand && item.brand && normalizeText(item.brand).includes(brand) ? 1 : 0;
      seen.set(item.id, { item, tier, nlTier: nameTier(item.name, item.brand, text, tokens), boost, brandBump, generic: /(^|\s)gem(\s|$)/i.test(item.name) ? 1 : 0, compound: /^\S+\s+\S+-(\s|$)/.test(item.name) ? 1 : 0, words: Math.min(...[item.name, item.nameEn].filter((n): n is string => !!n).map((n) => normalizeText(n).split(' ').length)), order: idx });
    });
  });

  const ranked = [...seen.values()].sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    // Equal overall: the one that also matches on its Dutch name is usually the plain food.
    if (a.nlTier !== b.nlTier) return b.nlTier - a.nlTier;
    if (a.boost !== b.boost) return b.boost - a.boost;
    if (a.brandBump !== b.brandBump) return b.brandBump - a.brandBump;
    // NEVO marks averaged, generic foods with "gem" (gemiddeld): the usual pick when logging.
    if (a.generic !== b.generic) return b.generic - a.generic;
    // "Boter chocolade-" is chocoladeboter, a different food from "Boter ongezouten".
    if (a.compound !== b.compound) return a.compound - b.compound;
    // Among equal matches the plainer food ("Appel m schil gem") beats dishes that contain it.
    if (a.words !== b.words) return a.words - b.words;
    return a.order - b.order;
  });

  return ranked.slice(0, limit).map((r) => r.item);
}

export async function getFoodById(id: string): Promise<FoodItem | undefined> {
  ensureDefaults();
  const prefix = id.includes(':') ? id.slice(0, id.indexOf(':')) : '';
  const src = registry.get(prefix as FoodSourceId);
  try {
    if (src?.getById) {
      const found = await src.getById(id);
      if (found) return found;
    }
  } catch {
    // fall through to user-food cache fallback
  }
  try {
    return await userFoodsSource.getById?.(id);
  } catch {
    return undefined;
  }
}

/**
 * Resolve a scanned EAN/UPC through every registered source that supports barcode lookup.
 * Separators are ignored so a manually entered code behaves the same as a camera result.
 */
export async function getFoodByBarcode(rawBarcode: string): Promise<FoodItem | undefined> {
  ensureDefaults();
  const barcode = rawBarcode.replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(barcode)) return undefined;

  const sources = [...registry.values()].filter((source): source is FoodSource & Required<Pick<FoodSource, 'getByBarcode'>> => !!source.getByBarcode);
  const results = await Promise.allSettled(sources.map((source) => source.getByBarcode(barcode)));
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }
  return undefined;
}

/** Test hook. */
export const __matchTierForTest = matchTier;
