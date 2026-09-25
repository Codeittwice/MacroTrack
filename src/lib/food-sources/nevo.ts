import MiniSearch from 'minisearch';
import type { FoodItem, FoodSource, Nutrients } from '@/db/types';
import { round } from '@/lib/utils/nutrients';
import { normalizeForIndex, normalizeQuery, normalizeText } from './normalize';
import { runQuery } from './query';

import type { NevoRow, NevoFile } from './nevo-format';
export type { NevoRow, NevoFile };

interface NevoDoc {
  id: number;
  nameNl: string;
  nameEn: string;
  synonyms: string;
}

let loadPromise: Promise<NevoFile> | null = null;
let rows: NevoRow[] = [];
let byCode: Map<number, NevoRow> = new Map();
let index: MiniSearch<NevoDoc> = buildIndex([]);
let header: NevoFile['header'] | undefined;
let lastFailAt = 0;
const RETRY_MS = 30_000;

function buildIndex(docs: NevoDoc[]): MiniSearch<NevoDoc> {
  const mini = new MiniSearch<NevoDoc>({
    fields: ['nameNl', 'nameEn', 'synonyms'],
    storeFields: ['nameNl', 'nameEn', 'synonyms'],
    processTerm: normalizeForIndex,
  });
  if (docs.length) mini.addAll(docs);
  return mini;
}

function applyData(data: NevoFile) {
  rows = data.rows;
  byCode = new Map(rows.map((r) => [r[0], r]));
  header = data.header;
  const docs: NevoDoc[] = rows.map((r) => ({ id: r[0], nameNl: r[1], nameEn: r[2] ?? '', synonyms: r[3] ?? '' }));
  index = buildIndex(docs);
}

async function fetchNevoFile(): Promise<NevoFile> {
  try {
    const base = import.meta.env.BASE_URL ?? '/';
    const url = `${base}data/nevo.json`.replace(/([^:])\/\//g, '$1/');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`nevo.json fetch failed: ${res.status}`);
    const data = (await res.json()) as NevoFile;
    if (!data || !Array.isArray(data.rows)) throw new Error('nevo.json malformed');
    return data;
  } catch (e) {
    console.warn('[food-sources/nevo] failed to load nevo.json, using empty dataset', e);
    lastFailAt = Date.now();
    return { header: { version: '', source: '', attribution: '', count: 0 }, rows: [] };
  }
}

/** Lazily fetch and memoise the NEVO dataset (once). */
export function loadNevo(): Promise<NevoFile> {
  // After a failed fetch, allow a retry once RETRY_MS has passed (e.g. came back online).
  if (loadPromise && lastFailAt && Date.now() - lastFailAt > RETRY_MS) {
    loadPromise = null;
    lastFailAt = 0;
  }
  if (!loadPromise) {
    loadPromise = fetchNevoFile().then((data) => {
      applyData(data);
      return data;
    });
  }
  return loadPromise;
}

export function isNevoLoaded(): boolean {
  return loadPromise !== null;
}

export function nevoHeader(): NevoFile['header'] | undefined {
  return header;
}

/** Test-only: synchronously replace the loaded dataset, or reset to force a re-fetch (null). */
export function __setNevoDataForTest(testRows: NevoRow[] | null): void {
  lastFailAt = 0;
  if (testRows === null) {
    loadPromise = null;
    rows = [];
    byCode = new Map();
    header = undefined;
    index = buildIndex([]);
    return;
  }
  const data: NevoFile = { header: { version: 'test', source: 'test', attribution: 'test', count: testRows.length }, rows: testRows };
  applyData(data);
  loadPromise = Promise.resolve(data);
}

export function rowToFoodItem(row: NevoRow): FoodItem {
  const [code, nameNl, nameEn, , , unit, kcal, protein, carbs, fat, fiber, sugar, satFat, sodium, alcohol] = row;
  const per100: Nutrients = { kcal, protein, carbs, fat };
  if (fiber != null) per100.fiber = fiber;
  if (sugar != null) per100.sugar = sugar;
  if (satFat != null) per100.satFat = satFat;
  if (sodium != null) {
    per100.sodium = sodium;
    per100.salt = round((sodium * 2.5) / 1000, 2);
  }
  if (alcohol != null) per100.alcohol = alcohol;

  return {
    id: `nevo:${code}`,
    source: 'nevo',
    name: nameNl,
    nameEn: nameEn ? nameEn : undefined,
    per100,
    unit,
    servings: [{ label: unit === 'ml' ? '100 ml' : '100 g', grams: 100 }],
  };
}

async function searchNevo(query: string, limit = 25): Promise<FoodItem[]> {
  await loadNevo();
  if (!rows.length) return [];
  const q = query.trim();
  if (!q) return [];

  const { text } = normalizeQuery(q);
  const results = runQuery(index, text || normalizeText(q), { nameNl: 2 });

  return results
    .slice(0, limit)
    .map((r) => byCode.get(r.id as number))
    .filter((r): r is NevoRow => !!r)
    .map(rowToFoodItem);
}

async function getNevoById(id: string): Promise<FoodItem | undefined> {
  await loadNevo();
  const code = Number(id.startsWith('nevo:') ? id.slice(5) : id);
  const row = byCode.get(code);
  return row ? rowToFoodItem(row) : undefined;
}

export const nevoSource: FoodSource = {
  id: 'nevo',
  search: searchNevo,
  getById: getNevoById,
};

/**
 * RIVM's required credit for figures calculated from NEVO. MacroTrack mixes NEVO with Open Food
 * Facts, user and AI data, so it uses the "en andere gegevens" form from the terms of use.
 */
export function nevoCredit(version = header?.version && header.version !== 'none' ? header.version : '2025/9.0'): string {
  return `Gebaseerd op gegevens van NEVO-online versie ${version}, RIVM, Bilthoven en andere gegevens`;
}
