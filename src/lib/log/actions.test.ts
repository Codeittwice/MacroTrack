import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import { getDayEntries, getDailyIntake } from './queries';
import {
  addLogEntry,
  updateLogEntryGrams,
  moveLogEntry,
  deleteLogEntry,
  copyMeal,
  copyDay,
  quickAdd,
  setDayIncomplete,
  setDayNote,
  getDayNote,
} from './actions';

const FOOD: FoodItem = {
  id: 'nevo:1',
  source: 'nevo',
  name: 'Chicken breast',
  per100: { kcal: 110, protein: 23.5, carbs: 0, fat: 1.8 },
  servings: [{ label: '1 breast', grams: 150 }],
};

beforeEach(async () => {
  await Promise.all([db.logEntries.clear(), db.foods.clear(), db.notes.clear()]);
});

describe('addLogEntry', () => {
  it('snapshots per100 and scales nutrients, and use-count bumps in db.foods', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 200 });
    expect(entry.nutrients.kcal).toBeCloseTo(220, 5);
    expect(entry.nutrients.protein).toBeCloseTo(47, 5);
    expect(entry.per100).toEqual(FOOD.per100);

    // mutating the source FoodItem afterward must not affect the stored entry
    FOOD.per100.kcal = 999;
    const stored = await db.logEntries.get(entry.id);
    expect(stored?.per100?.kcal).toBe(110);
    FOOD.per100.kcal = 110;

    const foodRow = await db.foods.get('nevo:1');
    expect(foodRow?.useCount).toBe(1);
    expect(foodRow?.lastUsedAt).toBeTypeOf('number');
  });

  it('clamps a negative/NaN meal to 0 and rejects invalid grams', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: -5, food: FOOD, grams: 100 });
    expect(entry.meal).toBe(0);
    await expect(addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: -1 })).rejects.toThrow();
  });

  it('does not record use for quick-add foods', async () => {
    const quickFood: FoodItem = { id: 'quick:abc', source: 'quick', name: 'Quick', per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 }, servings: [] };
    await addLogEntry({ date: '2026-01-01', meal: 0, food: quickFood, grams: 100 });
    const row = await db.foods.get('quick:abc');
    expect(row).toBeUndefined();
  });
});

describe('updateLogEntryGrams', () => {
  it('rescales nutrients from the per100 snapshot', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    await updateLogEntryGrams(entry.id, 50);
    const updated = await db.logEntries.get(entry.id);
    expect(updated?.grams).toBe(50);
    expect(updated?.nutrients.kcal).toBeCloseTo(55, 5);
  });

  it('servingLabel: null clears it, string sets it, undefined leaves unchanged', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100, servingLabel: 'original' });
    await updateLogEntryGrams(entry.id, 150, null);
    let updated = await db.logEntries.get(entry.id);
    expect(updated?.servingLabel).toBeUndefined();

    await updateLogEntryGrams(entry.id, 150, 'new label');
    updated = await db.logEntries.get(entry.id);
    expect(updated?.servingLabel).toBe('new label');

    await updateLogEntryGrams(entry.id, 160);
    updated = await db.logEntries.get(entry.id);
    expect(updated?.servingLabel).toBe('new label');
  });

  it('throws for a missing or deleted entry', async () => {
    await expect(updateLogEntryGrams('nope', 100)).rejects.toThrow();
  });
});

describe('moveLogEntry', () => {
  it('updates meal and optionally date', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    await moveLogEntry(entry.id, 2);
    let updated = await db.logEntries.get(entry.id);
    expect(updated?.meal).toBe(2);
    expect(updated?.date).toBe('2026-01-01');

    await moveLogEntry(entry.id, 1, '2026-01-02');
    updated = await db.logEntries.get(entry.id);
    expect(updated?.meal).toBe(1);
    expect(updated?.date).toBe('2026-01-02');
  });
});

describe('deleteLogEntry', () => {
  it('soft-deletes: row still exists but getDayEntries excludes it', async () => {
    const entry = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    await deleteLogEntry(entry.id);
    const row = await db.logEntries.get(entry.id);
    expect(row?.deletedAt).toBeTypeOf('number');
    const dayEntries = await getDayEntries('2026-01-01');
    expect(dayEntries.some((e) => e.id === entry.id)).toBe(false);
  });
});

describe('copyMeal / copyDay', () => {
  it('copyMeal creates new ids with unchanged source, and skips deleted entries', async () => {
    const e1 = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    const e2 = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 50 });
    await addLogEntry({ date: '2026-01-01', meal: 1, food: FOOD, grams: 75 }); // other meal
    const e4 = await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 20 });
    await deleteLogEntry(e4.id);

    const count = await copyMeal('2026-01-01', 0, '2026-01-05', 3);
    expect(count).toBe(2);
    const copied = await getDayEntries('2026-01-05');
    expect(copied.length).toBe(2);
    expect(copied.every((e) => e.meal === 3)).toBe(true);
    expect(copied.every((e) => e.source === 'nevo')).toBe(true);
    expect(copied.map((e) => e.id)).not.toContain(e1.id);
    expect(copied.map((e) => e.id)).not.toContain(e2.id);
  });

  it('copyDay preserves each entry meal and copies all', async () => {
    await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    await addLogEntry({ date: '2026-01-01', meal: 2, food: FOOD, grams: 50 });

    const count = await copyDay('2026-01-01', '2026-01-06');
    expect(count).toBe(2);
    const copied = await getDayEntries('2026-01-06');
    expect(copied.map((e) => e.meal).sort()).toEqual([0, 2]);
  });
});

describe('quickAdd', () => {
  it('computes totals from macros and is rescalable via updateLogEntryGrams', async () => {
    const entry = await quickAdd({ date: '2026-01-01', meal: 0, kcal: 200, protein: 10, carbs: 20, fat: 5 });
    expect(entry.grams).toBe(100);
    expect(entry.nutrients).toEqual({ kcal: 200, protein: 10, carbs: 20, fat: 5 });
    expect(entry.source).toBe('quick');
    expect(entry.foodId.startsWith('quick:')).toBe(true);

    await updateLogEntryGrams(entry.id, 200);
    const updated = await db.logEntries.get(entry.id);
    expect(updated?.nutrients.kcal).toBeCloseTo(400, 5);
  });

  it('rejects invalid kcal', async () => {
    await expect(quickAdd({ date: '2026-01-01', meal: 0, kcal: -1 })).rejects.toThrow();
  });
});

describe('setDayIncomplete / setDayNote', () => {
  it('excludes an incomplete day from getDailyIntake', async () => {
    await addLogEntry({ date: '2026-01-01', meal: 0, food: FOOD, grams: 100 });
    let intake = await getDailyIntake('2026-01-01', '2026-01-01');
    expect(intake.length).toBe(1);

    await setDayIncomplete('2026-01-01', true);
    intake = await getDailyIntake('2026-01-01', '2026-01-01');
    expect(intake.length).toBe(0);
  });

  it('setDayNote preserves the incomplete flag', async () => {
    await setDayIncomplete('2026-01-02', true);
    await setDayNote('2026-01-02', 'felt sick');
    const note = await getDayNote('2026-01-02');
    expect(note?.text).toBe('felt sick');
    expect(note?.incomplete).toBe(true);
  });
});
