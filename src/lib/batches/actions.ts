/**
 * Meal-prep batches: one cooked pot of a recipe, eaten over several meals. The amount left is never
 * stored; it is the batch's cooked weight minus the grams of the alive log entries that point at it.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { Batch, DateKey, FoodItem, LogEntry, Recipe } from '@/db/types';
import { addLogEntry } from '@/lib/log/actions';
import { recipeToFoodItem } from '@/lib/food-sources/user';
import { today } from '@/lib/utils/date';

export interface BatchInput {
  recipe: Recipe;
  portions: number;
  /** cooked weight of this pot; defaults to the recipe's */
  yieldGrams?: number;
  cookedOn?: DateKey;
}

export interface BatchStatus {
  batch: Batch;
  eatenGrams: number;
  remainingGrams: number;
  remainingPortions: number;
  gramsPerPortion: number;
}

const positive = (v: number) => Number.isFinite(v) && v > 0;

export async function createBatch(input: BatchInput): Promise<Batch> {
  const yieldGrams = input.yieldGrams ?? input.recipe.yieldGrams;
  if (!positive(input.portions)) throw new Error('portions must be a finite number > 0');
  if (!positive(yieldGrams)) throw new Error('cooked weight must be a finite number > 0');
  const batch = newRecord<Omit<Batch, 'id' | 'updatedAt'>>({
    recipeId: input.recipe.id,
    name: input.recipe.name,
    cookedOn: input.cookedOn ?? today(),
    portions: input.portions,
    yieldGrams,
  });
  await db.batches.put(batch);
  return batch;
}

/** The batch as a loggable food: the recipe's nutrients spread over this pot's own cooked weight. */
export function batchFood(batch: Batch, recipe: Recipe): FoodItem {
  return { ...recipeToFoodItem({ ...recipe, name: batch.name, yieldGrams: batch.yieldGrams, servings: batch.portions }), id: `batch:${batch.id}` };
}

export function batchStatus(batch: Batch, entries: Pick<LogEntry, 'grams' | 'batchId' | 'deletedAt'>[]): BatchStatus {
  const eatenGrams = entries.filter((e) => alive(e) && e.batchId === batch.id).reduce((t, e) => t + e.grams, 0);
  const remainingGrams = Math.max(0, batch.yieldGrams - eatenGrams);
  const gramsPerPortion = batch.yieldGrams / batch.portions;
  return { batch, eatenGrams, remainingGrams, remainingPortions: remainingGrams / gramsPerPortion, gramsPerPortion };
}

/** Log part of a batch, as portions or grams (grams win when both are given). */
export async function logFromBatch(batch: Batch, date: DateKey, meal: number, amount: { portions?: number; grams?: number }): Promise<LogEntry> {
  const recipe = await db.recipes.get(batch.recipeId);
  if (!recipe) throw new Error('The recipe for this meal prep no longer exists.');
  const gramsPerPortion = batch.yieldGrams / batch.portions;
  const grams = amount.grams ?? (amount.portions ?? 1) * gramsPerPortion;
  if (!positive(grams)) throw new Error('amount must be a finite number > 0');
  const portions = grams / gramsPerPortion;
  const label = amount.grams !== undefined ? undefined : `${fmtPortions(portions)} portion${portions === 1 ? '' : 's'}`;
  return addLogEntry({ date, meal, food: batchFood(batch, recipe), grams, servingLabel: label, batchId: batch.id });
}

export async function finishBatch(id: string): Promise<void> {
  const now = Date.now();
  await db.batches.update(id, { finishedAt: now, updatedAt: now });
}

export async function reopenBatch(id: string): Promise<void> {
  await db.batches.update(id, { finishedAt: undefined, updatedAt: Date.now() });
}

export async function deleteBatch(id: string): Promise<void> {
  const now = Date.now();
  await db.batches.update(id, { deletedAt: now, updatedAt: now });
}

/** Statuses of every alive batch, newest first. */
export async function listBatchStatuses(): Promise<BatchStatus[]> {
  const batches = (await db.batches.toArray()).filter(alive);
  if (!batches.length) return [];
  const entries = await db.logEntries.where('batchId').anyOf(batches.map((b) => b.id)).toArray();
  return batches.map((b) => batchStatus(b, entries)).sort((a, b) => b.batch.cookedOn.localeCompare(a.batch.cookedOn) || b.batch.updatedAt - a.batch.updatedAt);
}

/** A batch still has food left when it isn't finished and at least ~5 g remain. */
export const isOpen = (s: BatchStatus) => !s.batch.finishedAt && s.remainingGrams >= 5;

/** Leftovers: open batches with food left. undefined while loading. */
export function useLeftovers(): BatchStatus[] | undefined {
  return useLiveQuery(async () => (await listBatchStatuses()).filter(isOpen), []);
}

export function useBatchStatuses(): BatchStatus[] | undefined {
  return useLiveQuery(() => listBatchStatuses(), []);
}

export function fmtPortions(n: number): string {
  const r = Math.round(n * 4) / 4;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
}
