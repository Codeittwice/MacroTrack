import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import { createRecipe, createSavedMeal, deleteRecipe, deleteSavedMeal, logSavedMeal, saveLogEntriesAsMeal, updateRecipe, updateSavedMeal } from './actions';
import { addLogEntry } from '@/lib/log/actions';

const FOOD: FoodItem = {
  id: 'nevo:test', source: 'nevo', name: 'Test food', per100: { kcal: 100, protein: 10, carbs: 5, fat: 2 }, servings: [{ label: '100 g', grams: 100 }],
};

beforeEach(async () => {
  await Promise.all([db.recipes.clear(), db.savedMeals.clear(), db.logEntries.clear()]);
});

describe('recipes', () => {
  it('creates snapshot ingredients and updates recipe details', async () => {
    const recipe = await createRecipe({ name: ' Test bowl ', ingredients: [{ food: FOOD, grams: 200 }], yieldGrams: 180, servings: 2 });
    FOOD.per100.kcal = 999;
    expect(recipe.name).toBe('Test bowl');
    expect((await db.recipes.get(recipe.id))?.ingredients[0].food.per100.kcal).toBe(100);
    FOOD.per100.kcal = 100;

    await updateRecipe(recipe.id, { name: 'Updated bowl', servings: 3 });
    expect(await db.recipes.get(recipe.id)).toMatchObject({ name: 'Updated bowl', servings: 3, yieldGrams: 180 });
  });

  it('validates required fields and soft-deletes', async () => {
    await expect(createRecipe({ name: '', ingredients: [], yieldGrams: 0, servings: 0 })).rejects.toThrow();
    const recipe = await createRecipe({ name: 'Bowl', ingredients: [{ food: FOOD, grams: 100 }], yieldGrams: 100, servings: 1 });
    await deleteRecipe(recipe.id);
    expect((await db.recipes.get(recipe.id))?.deletedAt).toBeTypeOf('number');
    await expect(updateRecipe(recipe.id, { name: 'Nope' })).rejects.toThrow();
  });
});

describe('saved meals', () => {
  it('creates, updates, and soft-deletes a food snapshot', async () => {
    const meal = await createSavedMeal({ name: ' Breakfast ', items: [{ food: FOOD, grams: 150 }] });
    expect(meal.name).toBe('Breakfast');
    await updateSavedMeal(meal.id, { name: 'Weekday breakfast' });
    const updated = await db.savedMeals.get(meal.id);
    expect(updated?.name).toBe('Weekday breakfast');
    await deleteSavedMeal(meal.id);
    expect((await db.savedMeals.get(meal.id))?.deletedAt).toBeTypeOf('number');
  });

  it('saves logged snapshots and logs all saved items into a target meal', async () => {
    const entry = await addLogEntry({ date: '2026-09-24', meal: 0, food: FOOD, grams: 150 });
    const saved = await saveLogEntriesAsMeal('Saved breakfast', [entry]);
    const copies = await logSavedMeal(saved, '2026-09-25', 2);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ date: '2026-09-25', meal: 2, grams: 150, name: 'Test food' });
    expect(copies[0].nutrients.kcal).toBeCloseTo(150, 5);
  });
});
