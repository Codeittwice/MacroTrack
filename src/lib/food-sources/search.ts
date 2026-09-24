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

/** Match tier of an item's name against the normalised query: 3 exact, 2 prefix, 1 otherwise. */
function matchTier(item: FoodItem, queryText: string, queryTokens: string[]): number {
  const normName = normalizeText(item.name);
  const nameNoBrand = item.brand ? normName.replace(normalizeText(item.brand), '').trim() : normName;
  const targetName = nameNoBrand || normName;

  if (queryText && targetName === queryText) return 3;

  const tTokens = nameTokens(targetName);
  if (queryText && targetName.startsWith(queryText)) return 2;
  if (queryTokens.length > 0 && queryTokens.every((qt) => tTokens.some((tt) => tt.startsWith(qt)))) return 2;

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

  type Ranked = { item: FoodItem; tier: number; boost: number; brandBump: number; order: number };
  const seen = new Map<string, Ranked>();

  settled.forEach((res, srcIdx) => {
    if (res.status !== 'fulfilled') return;
    const src = sourcesToQuery[srcIdx];
    res.value.forEach((item, idx) => {
      if (seen.has(item.id)) return;
      const tier = matchTier(item, text, tokens);
      const boost = sourceBoost(src.id);
      const brandBump = brand && item.brand && normalizeText(item.brand).includes(brand) ? 1 : 0;
      seen.set(item.id, { item, tier, boost, brandBump, order: idx });
    });
  });

  const ranked = [...seen.values()].sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    if (a.boost !== b.boost) return b.boost - a.boost;
    if (a.brandBump !== b.brandBump) return b.brandBump - a.brandBump;
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
