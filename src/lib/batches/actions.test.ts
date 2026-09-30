import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import { createRecipe, logSavedMeal, createSavedMeal } from '@/lib/recipes/actions';
import { copyMeal, deleteLogEntry, groupLogEntries, ungroupLogEntries, updateLogEntryGrams, addLogEntry } from '@/lib/log/actions';
import { createBatch, finishBatch, fmtPortions, isOpen, listBatchStatuses, logFromBatch } from './actions';

const RICE: FoodItem = { id: 'nevo:rice', source: 'nevo', name: 'Rijst', nameEn: 'Rice', per100: { kcal: 130, protein: 3, carbs: 28, fat: 0.3 }, servings: [] };
const CHICKEN: FoodItem = { id: 'nevo:chicken', source: 'nevo', name: 'Kip', per100: { kcal: 150, protein: 30, carbs: 0, fat: 3 }, servings: [] };

beforeEach(async () => {
  await Promise.all([db.recipes.clear(), db.batches.clear(), db.logEntries.clear(), db.savedMeals.clear()]);
});

async function prep() {
  // 800 g rice + 400 g chicken = 1640 kcal, cooked down to 1000 g, 4 portions of 250 g.
  const recipe = await createRecipe({ name: 'Chicken rice', ingredients: [{ food: RICE, grams: 800 }, { food: CHICKEN, grams: 400 }], yieldGrams: 1200, servings: 4 });
  const batch = await createBatch({ recipe, portions: 4, yieldGrams: 1000, cookedOn: '2026-09-29' });
  return { recipe, batch };
}

describe('meal-prep batches', () => {
  it('logs portions against the batch cooked weight and derives what is left', async () => {
    const { batch } = await prep();
    const entry = await logFromBatch(batch, '2026-09-29', 2, { portions: 1 });
    expect(entry.grams).toBe(250);
    expect(entry.batchId).toBe(batch.id);
    expect(entry.nutrients.kcal).toBeCloseTo(410, 0); // a quarter of 1640 kcal
    expect(entry.servingLabel).toBe('1 portion');

    const [status] = await listBatchStatuses();
    expect(status.remainingGrams).toBe(750);
    expect(status.remainingPortions).toBe(3);
    expect(isOpen(status)).toBe(true);
  });

  it('logs by grams, and editing or deleting an entry puts the food back', async () => {
    const { batch } = await prep();
    const entry = await logFromBatch(batch, '2026-09-30', 0, { grams: 400 });
    expect((await listBatchStatuses())[0].remainingGrams).toBe(600);
    await updateLogEntryGrams(entry.id, 100);
    expect((await listBatchStatuses())[0].remainingGrams).toBe(900);
    await deleteLogEntry(entry.id);
    expect((await listBatchStatuses())[0].remainingGrams).toBe(1000);
  });

  it('closes when eaten up or marked finished', async () => {
    const { batch } = await prep();
    await logFromBatch(batch, '2026-09-30', 0, { portions: 4 });
    expect(isOpen((await listBatchStatuses())[0])).toBe(false);

    const second = await createBatch({ recipe: (await db.recipes.toArray())[0], portions: 2 });
    await finishBatch(second.id);
    const statuses = await listBatchStatuses();
    expect(statuses.filter(isOpen)).toHaveLength(0);
  });

  it('does not add batch portions to recent foods', async () => {
    const { batch } = await prep();
    await logFromBatch(batch, '2026-09-30', 0, { portions: 1 });
    expect(await db.foods.get(`batch:${batch.id}`)).toBeUndefined();
  });

  it('formats portions to quarters', () => {
    expect(fmtPortions(3)).toBe('3');
    expect(fmtPortions(2.5)).toBe('2.5');
    expect(fmtPortions(0.26)).toBe('0.25');
  });
});

describe('grouped entries', () => {
  it('logs a saved meal as one group and copies it as a new group', async () => {
    const saved = await createSavedMeal({ name: 'Protein mash', items: [{ food: RICE, grams: 100 }, { food: CHICKEN, grams: 50 }] });
    const entries = await logSavedMeal(saved, '2026-09-30', 0);
    expect(new Set(entries.map((e) => e.groupId)).size).toBe(1);
    expect(entries[0].groupName).toBe('Protein mash');

    await copyMeal('2026-09-30', 0, '2026-10-01', 0);
    const copies = (await db.logEntries.toArray()).filter((e) => e.date === '2026-10-01');
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map((e) => e.groupId)).size).toBe(1);
    expect(copies[0].groupId).not.toBe(entries[0].groupId);
  });

  it('groups loose entries and splits them again', async () => {
    const a = await addLogEntry({ date: '2026-09-30', meal: 0, food: RICE, grams: 100 });
    const b = await addLogEntry({ date: '2026-09-30', meal: 0, food: CHICKEN, grams: 100 });
    const groupId = await groupLogEntries([a.id, b.id], 'Bowl');
    expect((await db.logEntries.get(a.id))?.groupName).toBe('Bowl');
    await ungroupLogEntries(groupId);
    expect((await db.logEntries.get(b.id))?.groupId).toBeUndefined();
  });
});
