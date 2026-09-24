/**
 * Food-log mutation API (Wave 5). Reads live in `./queries.ts`; this file owns all writes.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord, getSettings } from '@/db/repo';
import type { DateKey, DayNote, FoodItem, LogEntry, Nutrients } from '@/db/types';
import { scale } from '@/lib/utils/nutrients';
import { uuid } from '@/lib/utils/id';
import { recordUse } from '@/lib/foods';
import { getDayEntries } from './queries';

export interface AddLogEntryInput {
  date: DateKey;
  meal: number;
  food: FoodItem;
  grams: number;
  servingLabel?: string;
}

/** Normalize a meal index to a non-negative integer, clamped to the configured meal count. */
async function normalizeMeal(meal: number): Promise<number> {
  const clamped = Number.isFinite(meal) ? Math.max(0, Math.trunc(meal)) : 0;
  const settings = await getSettings();
  const max = Math.max(0, settings.mealNames.length - 1);
  return Math.min(clamped, max);
}

/** Log a food at a given date/meal, snapshotting its nutrients so history never changes. */
export async function addLogEntry(input: AddLogEntryInput): Promise<LogEntry> {
  if (!Number.isFinite(input.grams) || input.grams < 0) throw new Error('grams must be a finite number >= 0');
  const meal = await normalizeMeal(input.meal);
  const nutrients: Nutrients = scale(input.food.per100, input.grams);
  const entry = newRecord<Omit<LogEntry, 'id' | 'updatedAt'>>({
    date: input.date,
    meal,
    foodId: input.food.id,
    name: input.food.name,
    brand: input.food.brand,
    source: input.food.source,
    grams: input.grams,
    servingLabel: input.servingLabel,
    nutrients,
    per100: { ...input.food.per100 },
    loggedAt: Date.now(),
  });
  await db.logEntries.put(entry);
  if (input.food.source !== 'quick' && !input.food.id.startsWith('quick:')) {
    await recordUse(input.food);
  }
  return entry;
}

/** Change an entry's grams (and optionally its serving label), rescaling from its per100 snapshot. */
export async function updateLogEntryGrams(id: string, grams: number, servingLabel?: string | null): Promise<void> {
  if (!Number.isFinite(grams) || grams < 0) throw new Error('grams must be a finite number >= 0');
  const entry = await db.logEntries.get(id);
  if (!entry || !alive(entry)) throw new Error(`log entry ${id} not found`);

  let nutrients: Nutrients;
  if (entry.per100) {
    nutrients = scale(entry.per100, grams);
  } else if (entry.grams > 0) {
    const factor = grams / entry.grams;
    nutrients = scaleNutrients(entry.nutrients, factor);
  } else {
    throw new Error(`log entry ${id} has no per100 snapshot and cannot be rescaled`);
  }

  const patch: Partial<LogEntry> = { grams, nutrients, updatedAt: Date.now() };
  if (servingLabel === null) patch.servingLabel = undefined;
  else if (servingLabel !== undefined) patch.servingLabel = servingLabel;
  await db.logEntries.update(id, patch);
}

function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = { kcal: n.kcal * factor, protein: n.protein * factor, carbs: n.carbs * factor, fat: n.fat * factor };
  if (n.fiber !== undefined) out.fiber = n.fiber * factor;
  if (n.sugar !== undefined) out.sugar = n.sugar * factor;
  if (n.satFat !== undefined) out.satFat = n.satFat * factor;
  if (n.sodium !== undefined) out.sodium = n.sodium * factor;
  if (n.salt !== undefined) out.salt = n.salt * factor;
  if (n.alcohol !== undefined) out.alcohol = n.alcohol * factor;
  return out;
}

/** Move an entry to a different meal (and optionally a different date). */
export async function moveLogEntry(id: string, meal: number, date?: DateKey): Promise<void> {
  const entry = await db.logEntries.get(id);
  if (!entry || !alive(entry)) throw new Error(`log entry ${id} not found`);
  const normalizedMeal = await normalizeMeal(meal);
  const patch: Partial<LogEntry> = { meal: normalizedMeal, updatedAt: Date.now() };
  if (date !== undefined) patch.date = date;
  await db.logEntries.update(id, patch);
}

/** Soft-delete a log entry. */
export async function deleteLogEntry(id: string): Promise<void> {
  const now = Date.now();
  await db.logEntries.update(id, { deletedAt: now, updatedAt: now });
}

/** Duplicate all entries from one date+meal into another date+meal. Returns the count copied. */
export async function copyMeal(fromDate: DateKey, meal: number, toDate: DateKey, toMeal: number): Promise<number> {
  const entries = (await getDayEntries(fromDate)).filter((e) => e.meal === meal);
  await copyEntries(entries, toDate, () => toMeal);
  return entries.length;
}

/** Duplicate an entire day's entries onto another date (same meals). Returns the count copied. */
export async function copyDay(fromDate: DateKey, toDate: DateKey): Promise<number> {
  const entries = await getDayEntries(fromDate);
  await copyEntries(entries, toDate, (e) => e.meal);
  return entries.length;
}

async function copyEntries(entries: LogEntry[], toDate: DateKey, mealFor: (e: LogEntry) => number): Promise<void> {
  const base = Date.now();
  const copies: LogEntry[] = entries.map((e, i) =>
    newRecord<Omit<LogEntry, 'id' | 'updatedAt'>>({
      date: toDate,
      meal: mealFor(e),
      foodId: e.foodId,
      name: e.name,
      brand: e.brand,
      source: e.source,
      grams: e.grams,
      servingLabel: e.servingLabel,
      nutrients: { ...e.nutrients },
      per100: e.per100 ? { ...e.per100 } : undefined,
      loggedAt: base + i,
    }),
  );
  if (copies.length) await db.logEntries.bulkPut(copies);
}

export interface QuickAddInput {
  date: DateKey;
  meal: number;
  name?: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** Log an ad-hoc calorie/macro entry not backed by any food database. */
export async function quickAdd(input: QuickAddInput): Promise<LogEntry> {
  if (!Number.isFinite(input.kcal) || input.kcal < 0) throw new Error('kcal must be a finite number >= 0');
  const meal = await normalizeMeal(input.meal);
  const per100: Nutrients = { kcal: input.kcal, protein: input.protein ?? 0, carbs: input.carbs ?? 0, fat: input.fat ?? 0 };
  const entry = newRecord<Omit<LogEntry, 'id' | 'updatedAt'>>({
    date: input.date,
    meal,
    foodId: `quick:${uuid()}`,
    name: input.name?.trim() || 'Quick add',
    source: 'quick',
    grams: 100,
    servingLabel: '1 serving',
    nutrients: { ...per100 },
    per100: { ...per100 },
    loggedAt: Date.now(),
  });
  await db.logEntries.put(entry);
  return entry;
}

async function getOrCreateNote(date: DateKey): Promise<DayNote> {
  const rows = (await db.notes.where('date').equals(date).toArray()).filter(alive);
  if (rows.length) return rows[0];
  return newRecord<Omit<DayNote, 'id' | 'updatedAt'>>({ date, text: '', incomplete: false });
}

/** Flag (or unflag) a day as an incomplete log, excluding it from expenditure calculations. */
export async function setDayIncomplete(date: DateKey, incomplete: boolean): Promise<void> {
  const note = await getOrCreateNote(date);
  await db.notes.put({ ...note, incomplete, updatedAt: Date.now() });
}

/** Set a day's free-text note, preserving its incomplete flag. */
export async function setDayNote(date: DateKey, text: string): Promise<void> {
  const note = await getOrCreateNote(date);
  await db.notes.put({ ...note, text, updatedAt: Date.now() });
}

/** Fetch a day's note (undefined if none exists yet). */
export async function getDayNote(date: DateKey): Promise<DayNote | undefined> {
  const rows = (await db.notes.where('date').equals(date).toArray()).filter(alive);
  return rows[0];
}

/** Live-query a day's note. */
export function useDayNote(date: DateKey): DayNote | undefined {
  return useLiveQuery(() => getDayNote(date), [date]);
}
