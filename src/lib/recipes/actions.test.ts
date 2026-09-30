import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import { createRecipe, createSavedMeal, deleteRecipe, deleteSavedMeal, logRecipeServings, logSavedMeal, saveLogEntriesAsMeal, saveLogEntriesAsRecipe, updateRecipe, updateSavedMeal } from './actions';
import { alive } from '@/db/repo';
import { addLogEntry } from '@/lib/log/actions';

const FOOD: FoodItem = {
  id: 'nevo:test', source: 'nevo', name: 'Test food', per100: { kcal: 100, protein: 10, carbs: 5, fat: 2 }, servings: [{ label: '100 g', grams: 100 }],
};

beforeEach(async () => {
  await Promise.all([db.recipes.clear(), db.savedMeals.clear(), db.logEntries.clear(), db.batches.clear()]);
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

describe('meal prep as recipe', () => {
  const RICE: FoodItem = { id: 'nevo:rice', source: 'nevo', name: 'Rijst witte gekookt', nameEn: 'Rice white boiled', per100: { kcal: 130, protein: 3, carbs: 28, fat: 0 }, servings: [] };
  const CHICKEN: FoodItem = { id: 'nevo:chicken', source: 'nevo', name: 'Kipfilet bereid', nameEn: 'Chicken fillet prepared', per100: { kcal: 150, protein: 30, carbs: 0, fat: 3 }, servings: [] };

  it('logs one serving of a recipe as a single entry', async () => {
    const recipe = await createRecipe({ name: 'Prep', ingredients: [{ food: RICE, grams: 800 }, { food: CHICKEN, grams: 400 }], yieldGrams: 1200, servings: 4 });
    const entry = await logRecipeServings(recipe, '2026-09-30', 1);
    expect(entry.grams).toBe(300);
    expect(entry.servingLabel).toBe('1 serving');
    expect(entry.nutrients.kcal).toBeCloseTo((800 * 1.3 + 400 * 1.5) / 4);
  });

  it('turns a logged meal prep into a recipe and keeps only the servings eaten', async () => {
    const a = await addLogEntry({ date: '2026-09-30', meal: 2, food: RICE, grams: 800 });
    const b = await addLogEntry({ date: '2026-09-30', meal: 2, food: CHICKEN, grams: 400 });
    expect(a.nameEn).toBe('Rice white boiled'); // English name is snapshotted
    const recipe = await saveLogEntriesAsRecipe([a, b], { name: 'Chicken rice prep', servings: 4 }, { date: '2026-09-30', meal: 2, portions: 1 });
    expect(recipe).toMatchObject({ name: 'Chicken rice prep', servings: 4, yieldGrams: 1200 });
    expect(recipe.ingredients[0].food.nameEn).toBe('Rice white boiled');
    const left = (await db.logEntries.toArray()).filter(alive);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ name: 'Chicken rice prep', source: 'recipe', grams: 300, servingLabel: '1 portion' });
    expect(left[0].nutrients.kcal).toBeCloseTo((1040 + 600) / 4);
    // The three portions not eaten yet are leftovers.
    const [batch] = await db.batches.toArray();
    expect(batch).toMatchObject({ recipeId: recipe.id, portions: 4, yieldGrams: 1200 });
    expect(left[0].batchId).toBe(batch.id);
  });

  it('can save without touching the log, or remove it entirely', async () => {
    const a = await addLogEntry({ date: '2026-09-30', meal: 0, food: RICE, grams: 400 });
    await saveLogEntriesAsRecipe([a], { name: 'Rice batch', servings: 2 });
    expect((await db.logEntries.toArray()).filter(alive)).toHaveLength(1);
    await saveLogEntriesAsRecipe([a], { name: 'Rice batch 2', servings: 2 }, { date: '2026-09-30', meal: 0, portions: 0 });
    expect((await db.logEntries.toArray()).filter(alive)).toHaveLength(0);
  });
});
