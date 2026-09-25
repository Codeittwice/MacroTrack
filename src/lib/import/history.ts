/**
 * Imports weight and intake history exported by other trackers (MyFitnessPal CSV exports,
 * MacroFactor/Cronometer exports saved as CSV, or any sheet with a date column). Columns are
 * matched by name, so exact layouts don't matter. Imported records get deterministic ids, so
 * importing the same file twice updates rather than duplicates.
 */
import { db } from '@/db/schema';
import type { DateKey, LogEntry, Nutrients, WeightEntry } from '@/db/types';
import { lbToKg } from '@/lib/weight/actions';

export interface ParsedHistory {
  weights: { date: DateKey; value: number }[];
  /** unit found in the header, e.g. "Weight (kg)"; undefined when the user must choose */
  weightUnit?: 'kg' | 'lb';
  intake: { date: DateKey; meal: number; mealName?: string; nutrients: Nutrients }[];
  skippedRows: number;
}

/** RFC 4180-ish CSV parser: quotes, escaped quotes, commas/semicolons/tabs, CRLF. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'));
  const delimiter = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

/** Accepts 2026-09-25, 25-09-2026, 25/09/2026, 9/25/2026 (US when the day can't be first). */
export function parseDate(raw: string): DateKey | undefined {
  const s = raw.trim().slice(0, 10);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return key(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    return a > 12 ? key(y, b, a) : b > 12 ? key(y, a, b) : key(y, b, a); // ambiguous -> day first (NL)
  }
  return undefined;
}

function key(y: number, m: number, d: number): DateKey | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const num = (raw: string | undefined) => {
  if (raw === undefined) return undefined;
  const v = Number(raw.trim().replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
  return Number.isFinite(v) ? v : undefined;
};

const MEALS: Record<string, number> = { breakfast: 0, ontbijt: 0, lunch: 1, dinner: 2, diner: 2, avondeten: 2, snacks: 3, snack: 3, tussendoor: 3 };

export function parseHistory(text: string): ParsedHistory {
  const rows = parseCsv(text);
  const out: ParsedHistory = { weights: [], intake: [], skippedRows: 0 };
  if (rows.length < 2) return out;
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (re: RegExp, not?: RegExp) => header.findIndex((h) => re.test(h) && !(not && not.test(h)));
  const col = {
    date: find(/^date|datum|^day$/),
    meal: find(/^meal|maaltijd/),
    weight: find(/^(scale )?weight|gewicht/, /trend|goal|target/),
    kcal: find(/calories|energy|energie|kcal/, /goal|target|burned|expenditure/),
    protein: find(/protein|eiwit/),
    carbs: find(/carb|koolhydra/, /net/),
    fat: find(/^fat|^(total )?fat|vet/, /saturated|verzadigd|trans|poly|mono/),
    fiber: find(/fib(er|re)|vezel/),
    sugar: find(/sugar|suiker/),
    sodium: find(/sodium|natrium/),
  };
  if (col.date === -1) return out;
  if (col.weight !== -1) out.weightUnit = /\blb|lbs|pound/.test(header[col.weight]) ? 'lb' : /\bkg\b/.test(header[col.weight]) ? 'kg' : undefined;

  for (const r of rows.slice(1)) {
    const date = parseDate(r[col.date] ?? '');
    if (!date) { out.skippedRows++; continue; }
    const weight = col.weight !== -1 ? num(r[col.weight]) : undefined;
    if (weight !== undefined && weight > 20 && weight < 700) out.weights.push({ date, value: weight });
    const kcal = col.kcal !== -1 ? num(r[col.kcal]) : undefined;
    if (kcal !== undefined && kcal > 0 && kcal < 20000) {
      const get = (i: number) => (i === -1 ? undefined : num(r[i]));
      const nutrients: Nutrients = { kcal, protein: get(col.protein) ?? 0, carbs: get(col.carbs) ?? 0, fat: get(col.fat) ?? 0 };
      const fiber = get(col.fiber); if (fiber !== undefined) nutrients.fiber = fiber;
      const sugar = get(col.sugar); if (sugar !== undefined) nutrients.sugar = sugar;
      const sodium = get(col.sodium); if (sodium !== undefined) nutrients.sodium = sodium;
      const mealName = col.meal !== -1 ? r[col.meal]?.trim() : undefined;
      const meal = mealName ? MEALS[mealName.toLowerCase()] ?? 3 : 3;
      out.intake.push({ date, meal, mealName, nutrients });
    } else if (weight === undefined) out.skippedRows++;
  }
  return out;
}

/** Writes parsed history. Returns counts. Intake rows sharing a date and meal are summed. */
export async function importHistory(parsed: ParsedHistory, opts: { source: string; weightUnit: 'kg' | 'lb' }): Promise<{ weights: number; days: number }> {
  const now = Date.now();
  const tag = opts.source.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const weightByDate = new Map<DateKey, number[]>();
  for (const w of parsed.weights) weightByDate.set(w.date, [...(weightByDate.get(w.date) ?? []), opts.weightUnit === 'lb' ? lbToKg(w.value) : w.value]);
  const weights: WeightEntry[] = [...weightByDate].map(([date, list]) => ({
    id: `import:${tag}:w:${date}`, date, kg: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
    note: `Imported from ${opts.source}`, time: now, updatedAt: now,
  }));

  const byMeal = new Map<string, { date: DateKey; meal: number; mealName?: string; nutrients: Nutrients }>();
  for (const e of parsed.intake) {
    const k = `${e.date}:${e.meal}:${e.mealName ?? ''}`;
    const prev = byMeal.get(k);
    if (!prev) { byMeal.set(k, { ...e, nutrients: { ...e.nutrients } }); continue; }
    for (const [n, v] of Object.entries(e.nutrients) as [keyof Nutrients, number][]) prev.nutrients[n] = (prev.nutrients[n] ?? 0) + v;
  }
  const entries: LogEntry[] = [...byMeal.values()].map((e) => {
    const id = `import:${tag}:${e.date}:${e.meal}:${(e.mealName ?? 'day').toLowerCase()}`;
    return {
      id, date: e.date, meal: e.meal, foodId: id, name: `${opts.source}${e.mealName ? ` · ${e.mealName}` : ' · daily total'}`,
      source: 'quick', grams: 100, nutrients: e.nutrients, per100: e.nutrients, loggedAt: now, updatedAt: now,
    };
  });

  await db.transaction('rw', db.weights, db.logEntries, async () => {
    if (weights.length) await db.weights.bulkPut(weights);
    if (entries.length) await db.logEntries.bulkPut(entries);
  });
  return { weights: weights.length, days: new Set(entries.map((e) => e.date)).size };
}
