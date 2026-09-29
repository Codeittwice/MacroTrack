import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import {
  createCustomFood,
  updateCustomFood,
  deleteCustomFood,
  toggleFavorite,
  isFavorite,
  recordUse,
  storedToFoodItem,
  getRecentFoods,
  getFrequentFoods,
  getFavoriteFoods,
  getCustomFoods,
} from './foods';

const NEVO_FOOD: FoodItem = {
  id: 'nevo:123',
  source: 'nevo',
  name: 'Pindakaas',
  per100: { kcal: 600, protein: 25, carbs: 10, fat: 48 },
  servings: [{ label: '1 tbsp', grams: 16 }],
};

beforeEach(async () => {
  await db.foods.clear();
});

describe('createCustomFood', () => {
  it('creates a user-sourced food with a user: id prefix', async () => {
    const food = await createCustomFood({ name: 'My mix', per100: { kcal: 300, protein: 20, carbs: 10, fat: 5 } });
    expect(food.id.startsWith('user:')).toBe(true);
    expect(food.source).toBe('user');
    expect(food.servings).toEqual([]);
    expect(food.unit).toBe('g');
  });

  it('rejects an empty name', async () => {
    await expect(createCustomFood({ name: '  ', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } })).rejects.toThrow();
  });
});

describe('updateCustomFood', () => {
  it('merges a patch into an existing user food', async () => {
    const food = await createCustomFood({ name: 'Original', per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 } });
    await updateCustomFood(food.id, { name: 'Renamed', brand: 'Acme' });
    const row = await db.foods.get(food.id);
    expect(row?.name).toBe('Renamed');
    expect(row?.brand).toBe('Acme');
    expect(row?.per100.kcal).toBe(100);
  });

  it('throws for a non-existent or non-user food', async () => {
    await expect(updateCustomFood('nope', { name: 'x' })).rejects.toThrow();
    await db.foods.put({ ...NEVO_FOOD, updatedAt: Date.now() });
    await expect(updateCustomFood('nevo:123', { name: 'x' })).rejects.toThrow();
  });
});

describe('deleteCustomFood', () => {
  it('soft-deletes the row', async () => {
    const food = await createCustomFood({ name: 'Gone', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await deleteCustomFood(food.id);
    const row = await db.foods.get(food.id);
    expect(row?.deletedAt).toBeTypeOf('number');
    const custom = await getCustomFoods();
    expect(custom.some((f) => f.id === food.id)).toBe(false);
  });
});

describe('toggleFavorite', () => {
  it('creates a favourite row for a non-stored food, keeping its original id', async () => {
    const state1 = await toggleFavorite(NEVO_FOOD);
    expect(state1).toBe(true);
    const row = await db.foods.get('nevo:123');
    expect(row?.id).toBe('nevo:123');
    expect(row?.favorite).toBe(true);

    const state2 = await toggleFavorite(NEVO_FOOD);
    expect(state2).toBe(false);
    const row2 = await db.foods.get('nevo:123');
    expect(row2?.favorite).toBe(false);
  });

  it('revives a soft-deleted non-user favourite row', async () => {
    await toggleFavorite(NEVO_FOOD);
    await db.foods.update('nevo:123', { deletedAt: Date.now(), favorite: false });
    const state = await toggleFavorite(NEVO_FOOD);
    expect(state).toBe(true);
    const row = await db.foods.get('nevo:123');
    expect(row?.deletedAt).toBeUndefined();
  });
});

describe('isFavorite', () => {
  it('reflects the current favourite state', async () => {
    expect(await isFavorite('nevo:123')).toBe(false);
    await toggleFavorite(NEVO_FOOD);
    expect(await isFavorite('nevo:123')).toBe(true);
  });
});

describe('recordUse', () => {
  it('increments useCount and sets lastUsedAt', async () => {
    await recordUse(NEVO_FOOD);
    let row = await db.foods.get('nevo:123');
    expect(row?.useCount).toBe(1);
    expect(row?.lastUsedAt).toBeTypeOf('number');

    await recordUse(NEVO_FOOD);
    row = await db.foods.get('nevo:123');
    expect(row?.useCount).toBe(2);
  });

  it('skips quick-add foods', async () => {
    const quickFood: FoodItem = { id: 'quick:x', source: 'quick', name: 'Quick', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 }, servings: [] };
    await recordUse(quickFood);
    expect(await db.foods.get('quick:x')).toBeUndefined();
  });
});

describe('storedToFoodItem', () => {
  it('maps stored fields to a FoodItem', async () => {
    const food = await createCustomFood({ name: 'Mapped', per100: { kcal: 50, protein: 2, carbs: 3, fat: 1 }, brand: 'B' });
    const row = await db.foods.get(food.id);
    const mapped = storedToFoodItem(row!);
    expect(mapped).toEqual({
      id: food.id,
      source: 'user',
      name: 'Mapped',
      nameEn: undefined,
      brand: 'B',
      barcode: undefined,
      per100: { kcal: 50, protein: 2, carbs: 3, fat: 1 },
      servings: [],
      unit: 'g',
    });
  });
});

describe('query helpers', () => {
  it('getRecentFoods sorts by lastUsedAt desc and only includes used foods', async () => {
    const a = await createCustomFood({ name: 'A', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    const b = await createCustomFood({ name: 'B', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await createCustomFood({ name: 'C (never used)', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await recordUse(a);
    await new Promise((r) => setTimeout(r, 2));
    await recordUse(b);
    const recents = await getRecentFoods();
    expect(recents.map((f) => f.name)).toEqual(['B', 'A']);
  });

  it('getFrequentFoods sorts by useCount desc', async () => {
    const a = await createCustomFood({ name: 'A', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    const b = await createCustomFood({ name: 'B', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await recordUse(a);
    await recordUse(b);
    await recordUse(b);
    const frequent = await getFrequentFoods();
    expect(frequent.map((f) => f.name)).toEqual(['B', 'A']);
  });

  it('getFavoriteFoods returns only favourites, name asc', async () => {
    const a = await createCustomFood({ name: 'Zeta', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    const b = await createCustomFood({ name: 'Alpha', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await toggleFavorite(a);
    await toggleFavorite(b);
    const favs = await getFavoriteFoods();
    expect(favs.map((f) => f.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('getCustomFoods returns only source=user, name asc', async () => {
    await createCustomFood({ name: 'Zeta', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await createCustomFood({ name: 'Alpha', per100: { kcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await db.foods.put({ ...NEVO_FOOD, updatedAt: Date.now() });
    const custom = await getCustomFoods();
    expect(custom.map((f) => f.name)).toEqual(['Alpha', 'Zeta']);
    expect(custom.every((f) => f.source === 'user')).toBe(true);
  });
});
