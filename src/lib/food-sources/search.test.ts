import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/db/schema';
import type { StoredFood, Recipe, FoodSource, FoodItem } from '@/db/types';
import { __setNevoDataForTest, type NevoRow } from './nevo';
import { recipeToFoodItem } from './user';
import { searchFoods, getFoodByBarcode, getFoodById, registerFoodSource, unregisterFoodSource } from './search';

const ROWS: NevoRow[] = [
  [1001, 'Brood Turks', 'Bread Turkish', 'Turks brood', 'Brood', 'g', 270, 9.1, 50.2, 3.4, 2.5, 2.1, 0.6, 480, null],
  [1002, 'Kipfilet rauw', 'Chicken breast raw', '', 'Vlees en gevogelte', 'g', 110, 23.5, 0, 1.8, null, null, 0.5, 60, null],
  [1003, 'Pindakaas', 'Peanut butter', '', 'Noten', 'g', 620, 24, 12, 50, 7, 5, 9, 400, null],
];

function makeStoredFood(over: Partial<StoredFood>): StoredFood {
  return {
    id: 'user:abc',
    source: 'user',
    name: 'Pindakaas',
    per100: { kcal: 600, protein: 25, carbs: 10, fat: 48 },
    servings: [{ label: '1 tbsp', grams: 16 }],
    updatedAt: Date.now(),
    ...over,
  };
}

beforeEach(async () => {
  __setNevoDataForTest(ROWS);
  await db.foods.clear();
  await db.recipes.clear();
});

afterEach(() => {
  unregisterFoodSource('off');
});

describe('searchFoods', () => {
  it('ranks user foods above NEVO for equal matches', async () => {
    await db.foods.put(makeStoredFood({ id: 'user:abc' }));
    const results = await searchFoods('pindakaas');
    expect(results[0].id).toBe('user:abc');
    expect(results.some((r) => r.id === 'nevo:1003')).toBe(true);
    const nevoIdx = results.findIndex((r) => r.id === 'nevo:1003');
    const userIdx = results.findIndex((r) => r.id === 'user:abc');
    expect(userIdx).toBeLessThan(nevoIdx);
  });

  it('excludes soft-deleted user foods', async () => {
    await db.foods.put(makeStoredFood({ id: 'user:deleted', deletedAt: Date.now() }));
    const results = await searchFoods('pindakaas');
    expect(results.some((r) => r.id === 'user:deleted')).toBe(false);
  });

  it('works with an empty NEVO dataset and does not throw', async () => {
    __setNevoDataForTest([]);
    await db.foods.put(makeStoredFood({ id: 'user:abc' }));
    const results = await searchFoods('pindakaas');
    expect(results.every((r) => r.source === 'user')).toBe(true);
    expect(results.some((r) => r.id === 'user:abc')).toBe(true);
  });

  it('finds kipfilet for the typo "kipfilt" (fuzzy)', async () => {
    const results = await searchFoods('kipfilt');
    expect(results.some((r) => r.id === 'nevo:1002')).toBe(true);
  });

  it('empty query delegates to user + recipe (not NEVO)', async () => {
    await db.foods.put(makeStoredFood({ id: 'user:abc', lastUsedAt: Date.now() }));
    const results = await searchFoods('');
    expect(results.some((r) => r.source === 'nevo')).toBe(false);
    expect(results.some((r) => r.id === 'user:abc')).toBe(true);
  });

  it('dedupes when two registered sources return the same id', async () => {
    const fakeOff: FoodSource = {
      id: 'off',
      search: async (): Promise<FoodItem[]> => [
        { id: 'nevo:1003', source: 'off', name: 'Pindakaas (dup)', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 }, servings: [] },
      ],
    };
    registerFoodSource(fakeOff);
    const results = await searchFoods('pindakaas');
    const matches = results.filter((r) => r.id === 'nevo:1003');
    expect(matches.length).toBe(1);
  });

  it('merges results from a newly registered fake off source', async () => {
    const fakeOff: FoodSource = {
      id: 'off',
      search: async (): Promise<FoodItem[]> => [
        { id: 'off:999', source: 'off', name: 'Pindakaas Extra', per100: { kcal: 600, protein: 20, carbs: 10, fat: 50 }, servings: [] },
      ],
      getById: async (id) =>
        id === 'off:999'
          ? { id: 'off:999', source: 'off', name: 'Pindakaas Extra', per100: { kcal: 600, protein: 20, carbs: 10, fat: 50 }, servings: [] }
          : undefined,
    };
    registerFoodSource(fakeOff);
    const results = await searchFoods('pindakaas');
    expect(results.some((r) => r.id === 'off:999')).toBe(true);

    const byId = await getFoodById('off:999');
    expect(byId?.name).toBe('Pindakaas Extra');
  });

  it('normalizes a barcode and ignores unavailable barcode sources', async () => {
    const fakeOff: FoodSource = {
      id: 'off',
      search: async () => [],
      getByBarcode: async (barcode) => barcode === '8712345678901'
        ? { id: 'off:8712345678901', source: 'off', name: 'Scanned food', barcode, per100: { kcal: 100, protein: 10, carbs: 5, fat: 2 }, servings: [] }
        : undefined,
    };
    registerFoodSource(fakeOff);
    await expect(getFoodByBarcode('8712 345-678901')).resolves.toMatchObject({ name: 'Scanned food' });
    await expect(getFoodByBarcode('not-a-barcode')).resolves.toBeUndefined();
  });
});

describe('recipeToFoodItem / recipesSource', () => {
  const foodA: FoodItem = { id: 'nevo:a', source: 'nevo', name: 'A', per100: { kcal: 100, protein: 10, carbs: 20, fat: 1 }, servings: [] };
  const foodB: FoodItem = { id: 'nevo:b', source: 'nevo', name: 'B', per100: { kcal: 50, protein: 2, carbs: 5, fat: 0.5 }, servings: [] };

  function makeRecipe(): Recipe {
    return {
      id: 'r1',
      name: 'Test Bowl',
      ingredients: [
        { food: foodA, grams: 100 },
        { food: foodB, grams: 200 },
      ],
      yieldGrams: 250,
      servings: 2,
      updatedAt: Date.now(),
    };
  }

  it('computes per100 from total ingredient nutrients / yieldGrams', () => {
    const item = recipeToFoodItem(makeRecipe());
    expect(item.id).toBe('recipe:r1');
    expect(item.per100.kcal).toBeCloseTo(80, 5);
    expect(item.per100.protein).toBeCloseTo(5.6, 5);
    expect(item.per100.carbs).toBeCloseTo(12, 5);
    expect(item.per100.fat).toBeCloseTo(0.8, 5);
    expect(item.servings[0].grams).toBeCloseTo(125, 5);
  });

  it('is findable via recipesSource.search and getFoodById', async () => {
    await db.recipes.put(makeRecipe());
    const results = await searchFoods('Test Bowl');
    expect(results.some((r) => r.id === 'recipe:r1')).toBe(true);

    const byId = await getFoodById('recipe:r1');
    expect(byId?.id).toBe('recipe:r1');
  });

  it('excludes soft-deleted recipes', async () => {
    await db.recipes.put({ ...makeRecipe(), id: 'r2', deletedAt: Date.now() });
    const results = await searchFoods('Test Bowl');
    expect(results.some((r) => r.id === 'recipe:r2')).toBe(false);
  });
});
