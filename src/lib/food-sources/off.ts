/**
 * Open Food Facts adapter. Network results are normalised and cached in `db.foods`, so a product
 * found online remains available to favourites, recents, and offline lookup flows.
 */
import { z } from 'zod';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { FoodItem, FoodSource, Nutrients, StoredFood } from '@/db/types';
import { normalizeQuery, normalizeText } from './normalize';

const API_BASE = 'https://nl.openfoodfacts.org';

const nullableText = z.string().nullish().transform((value) => value ?? undefined);
const nullableCode = z.union([z.string(), z.number()]).nullish().transform((value) => value ?? undefined);

const productSchema = z.object({
  code: nullableCode,
  product_name: nullableText,
  product_name_nl: nullableText,
  product_name_en: nullableText,
  generic_name: nullableText,
  brands: nullableText,
  nutriments: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
}).passthrough();

const searchResponseSchema = z.object({ products: z.array(productSchema).default([]) }).passthrough();
const barcodeResponseSchema = z.object({ product: productSchema.optional() }).passthrough();

type OffProduct = z.infer<typeof productSchema>;

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstText(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value?.trim())?.trim();
}

function productCode(product: OffProduct, fallback?: string): string | undefined {
  const code = product.code === undefined ? fallback : String(product.code);
  return code?.trim() || undefined;
}

function nutrientsFromProduct(product: OffProduct): Nutrients {
  const nutrients = product.nutriments ?? {};
  const kcal = asNumber(nutrients['energy-kcal_100g']) ?? asNumber(nutrients['energy-kcal']) ?? 0;
  const protein = asNumber(nutrients.proteins_100g) ?? 0;
  const carbs = asNumber(nutrients.carbohydrates_100g) ?? 0;
  const fat = asNumber(nutrients.fat_100g) ?? 0;
  const out: Nutrients = { kcal, protein, carbs, fat };

  const optional: [keyof Nutrients, unknown][] = [
    ['fiber', nutrients.fiber_100g],
    ['sugar', nutrients.sugars_100g],
    ['satFat', nutrients['saturated-fat_100g']],
    ['sodium', nutrients.sodium_100g],
    ['salt', nutrients.salt_100g],
  ];
  for (const [key, value] of optional) {
    const number = asNumber(value);
    if (number !== undefined) out[key] = number;
  }
  return out;
}

/** Convert a public Open Food Facts product into the app's source-neutral model. */
export function offProductToFoodItem(product: OffProduct, fallbackBarcode?: string): FoodItem | undefined {
  const barcode = productCode(product, fallbackBarcode);
  const name = firstText(product.product_name_nl, product.product_name, product.product_name_en, product.generic_name);
  if (!barcode || !name) return undefined;

  return {
    id: `off:${barcode}`,
    source: 'off',
    name,
    nameEn: product.product_name_en?.trim() || undefined,
    brand: product.brands?.trim() || undefined,
    barcode,
    per100: nutrientsFromProduct(product),
    unit: 'g',
    servings: [{ label: '100 g', grams: 100 }],
  };
}

function storedToFoodItem(row: StoredFood): FoodItem {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    nameEn: row.nameEn,
    brand: row.brand,
    barcode: row.barcode,
    per100: row.per100,
    servings: row.servings,
    unit: row.unit,
  };
}

/** Cache an OFF item without losing local favourite and recency metadata. */
export async function cacheOffFood(food: FoodItem): Promise<void> {
  const existing = await db.foods.get(food.id);
  const cached: StoredFood = {
    ...(existing ?? { id: food.id }),
    source: 'off',
    name: food.name,
    nameEn: food.nameEn,
    brand: food.brand,
    barcode: food.barcode,
    per100: food.per100,
    servings: food.servings,
    unit: food.unit,
    updatedAt: Date.now(),
    deletedAt: undefined,
  };
  await db.foods.put(cached);
}

async function cachedOffByBarcode(barcode: string): Promise<FoodItem | undefined> {
  const rows = (await db.foods.where('barcode').equals(barcode).toArray()).filter((row) => alive(row) && row.source === 'off');
  return rows[0] ? storedToFoodItem(rows[0]) : undefined;
}

async function cachedOffSearch(query: string, limit: number): Promise<FoodItem[]> {
  const normalised = normalizeText(query);
  if (!normalised) return [];
  const rows = (await db.foods.toArray())
    .filter((row) => alive(row) && row.source === 'off')
    .filter((row) => normalizeText(`${row.name} ${row.brand ?? ''}`).includes(normalised))
    .slice(0, limit);
  return rows.map(storedToFoodItem);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open Food Facts request failed: ${response.status}`);
  return response.json();
}

const BRAND_NAMES: Record<string, string> = { ah: 'albert heijn', 'albert heijn': 'albert heijn', jumbo: 'jumbo', lidl: 'lidl', aldi: 'aldi', plus: 'plus' };

/**
 * Turns a typed query into Open Food Facts search terms. OFF does literal full-text matching, so
 * Dutch diminutive plurals and inflected adjectives ("turkse broodjes") must become their base
 * form ("turks brood"), and a shop prefix becomes the brand name OFF stores ("albert heijn").
 */
export function offSearchTerms(query: string): { terms: string; withoutBrand: string } {
  const { text, brand } = normalizeQuery(query);
  const base = text.split(' ').filter(Boolean).map((word) => {
    if (word.length > 6 && word.endsWith('tjes')) return word.slice(0, -4);
    if (word.length > 5 && word.endsWith('jes')) return word.slice(0, -3);
    if (word.length > 5 && /[kndl]se$/.test(word)) return word.slice(0, -1); // turkse, franse, hollandse, engelse
    return word;
  }).join(' ');
  const brandName = brand ? BRAND_NAMES[brand] ?? brand : undefined;
  return { terms: brandName ? `${base} ${brandName}` : base, withoutBrand: base };
}

/** OFF allows ~10 searches a minute; stay under it and serve repeats from memory. */
const SEARCH_BUDGET_PER_MINUTE = 8;
const QUERY_CACHE_MS = 10 * 60_000;
const recentSearches: number[] = [];

export type OffSearchStatus = 'ok' | 'limited' | 'offline';
let lastStatus: OffSearchStatus = 'ok';
/** Outcome of the most recent online search, so the UI can explain missing branded results. */
export function offSearchStatus(): OffSearchStatus {
  return lastStatus;
}
const queryCache = new Map<string, { at: number; foods: FoodItem[] }>();

function takeSearchSlot(): boolean {
  const now = Date.now();
  while (recentSearches.length && now - recentSearches[0] > 60_000) recentSearches.shift();
  if (recentSearches.length >= SEARCH_BUDGET_PER_MINUTE) return false;
  recentSearches.push(now);
  return true;
}

async function fetchSearch(terms: string, limit: number): Promise<FoodItem[]> {
  const cached = queryCache.get(terms);
  if (cached && Date.now() - cached.at < QUERY_CACHE_MS) return cached.foods;
  if (!takeSearchSlot()) {
    lastStatus = 'limited';
    throw new Error('Open Food Facts search budget exhausted');
  }
  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(Math.min(Math.max(limit, 1), 100)),
    countries_tags: 'netherlands',
  });
  const data = searchResponseSchema.parse(await fetchJson(`${API_BASE}/cgi/search.pl?${params}`));
  const foods = data.products.map((product) => offProductToFoodItem(product)).filter((food): food is FoodItem => !!food).slice(0, limit);
  queryCache.set(terms, { at: Date.now(), foods });
  await Promise.all(foods.map(cacheOffFood));
  return foods;
}

async function searchOff(query: string, limit = 25): Promise<FoodItem[]> {
  const { terms, withoutBrand } = offSearchTerms(query);
  if (withoutBrand.length < 3) return cachedOffSearch(query.trim(), limit);

  try {
    let foods = await fetchSearch(terms, limit);
    // A brand we mapped wrongly shouldn't hide every product; retry on the product words alone.
    if (foods.length === 0 && terms !== withoutBrand) foods = await fetchSearch(withoutBrand, limit);
    lastStatus = 'ok';
    return foods;
  } catch {
    // The API answers bursts with 429s that browsers surface as opaque network errors.
    if (lastStatus !== 'limited') lastStatus = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'limited';
    // A local-first app should still find previously seen branded products while offline or throttled.
    return cachedOffSearch(withoutBrand, limit);
  }
}

/** Test hook: forget the rate-limit window and query cache. */
export function __resetOffSearchStateForTest(): void {
  lastStatus = 'ok';
  recentSearches.length = 0;
  queryCache.clear();
}

async function getOffByBarcode(barcode: string): Promise<FoodItem | undefined> {
  const cached = await cachedOffByBarcode(barcode);
  if (cached) return cached;

  try {
    const data = barcodeResponseSchema.parse(await fetchJson(`${API_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`));
    const food = data.product ? offProductToFoodItem(data.product, barcode) : undefined;
    if (food) await cacheOffFood(food);
    return food;
  } catch {
    return undefined;
  }
}

async function getOffById(id: string): Promise<FoodItem | undefined> {
  const barcode = id.startsWith('off:') ? id.slice(4) : id;
  if (!barcode) return undefined;
  return getOffByBarcode(barcode);
}

export const offSource: FoodSource = {
  id: 'off',
  search: searchOff,
  getById: getOffById,
  getByBarcode: getOffByBarcode,
};
