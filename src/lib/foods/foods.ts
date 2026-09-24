/**
 * Stored-foods library (Wave 5): custom foods, favourites, recents and frequents.
 * Storing NEVO/OFF/recipe foods in `db.foods` is intentional — it's how favourites/recents/use-counts
 * are tracked for foods that aren't otherwise user-owned.
 */
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { FoodItem, Nutrients, Serving, StoredFood } from '@/db/types';
import { uuid } from '@/lib/utils/id';

export interface CustomFoodInput {
  name: string;
  brand?: string;
  per100: Nutrients;
  servings?: Serving[];
  unit?: 'g' | 'ml';
  barcode?: string;
}

/** Map a stored-food row to the public FoodItem shape. */
export function storedToFoodItem(f: StoredFood & { id: string }): FoodItem {
  return {
    id: f.id,
    source: f.source,
    name: f.name,
    nameEn: f.nameEn,
    brand: f.brand,
    barcode: f.barcode,
    per100: f.per100,
    servings: f.servings,
    unit: f.unit,
  };
}

/** Create a user-owned custom food. */
export async function createCustomFood(input: CustomFoodInput): Promise<FoodItem> {
  const name = input.name.trim();
  if (!name) throw new Error('name is required');
  const row = newRecord<Omit<StoredFood, 'id' | 'updatedAt'>>({
    source: 'user',
    name,
    brand: input.brand,
    barcode: input.barcode,
    per100: input.per100,
    servings: input.servings ?? [],
    unit: input.unit ?? 'g',
  });
  const stored: StoredFood = { ...row, id: `user:${uuid()}` };
  await db.foods.put(stored);
  return storedToFoodItem(stored);
}

/** Patch a user-owned custom food. */
export async function updateCustomFood(id: string, patch: Partial<CustomFoodInput>): Promise<void> {
  const row = await db.foods.get(id);
  if (!row || !alive(row) || row.source !== 'user') throw new Error(`custom food ${id} not found`);
  const next: StoredFood = {
    ...row,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
    ...(patch.per100 !== undefined ? { per100: patch.per100 } : {}),
    ...(patch.servings !== undefined ? { servings: patch.servings } : {}),
    ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
    ...(patch.barcode !== undefined ? { barcode: patch.barcode } : {}),
    updatedAt: Date.now(),
  };
  await db.foods.put(next);
}

/** Soft-delete a user-owned custom food. */
export async function deleteCustomFood(id: string): Promise<void> {
  const now = Date.now();
  await db.foods.update(id, { deletedAt: now, updatedAt: now });
}

function foodFields(food: FoodItem) {
  return {
    source: food.source,
    name: food.name,
    nameEn: food.nameEn,
    brand: food.brand,
    barcode: food.barcode,
    per100: food.per100,
    servings: food.servings,
    unit: food.unit,
  };
}

/** Toggle a food's favourite flag, creating/reviving its stored row as needed. Returns the new state. */
export async function toggleFavorite(food: FoodItem): Promise<boolean> {
  const row = await db.foods.get(food.id);
  if (row) {
    const nextFavorite = !row.favorite;
    const revive = !alive(row) && row.source !== 'user';
    const next: StoredFood = {
      ...row,
      ...(row.source !== 'user' ? foodFields(food) : {}),
      favorite: nextFavorite,
      updatedAt: Date.now(),
      ...(revive ? { deletedAt: undefined } : {}),
    };
    await db.foods.put(next);
    return nextFavorite;
  }
  const stored: StoredFood = { ...foodFields(food), id: food.id, favorite: true, updatedAt: Date.now() };
  await db.foods.put(stored);
  return true;
}

/** Whether a food is currently favourited. */
export async function isFavorite(id: string): Promise<boolean> {
  const row = await db.foods.get(id);
  return !!(row && alive(row) && row.favorite);
}

/** Bump a food's use-count and last-used timestamp (for recents/frequents). Skips quick-add entries. */
export async function recordUse(food: FoodItem): Promise<void> {
  if (food.source === 'quick' || food.id.startsWith('quick:')) return;
  const row = await db.foods.get(food.id);
  const now = Date.now();
  if (row) {
    if (row.source === 'user' && !alive(row)) return; // don't revive a deleted custom food
    const next: StoredFood = {
      ...row,
      ...(row.source !== 'user' ? foodFields(food) : {}),
      useCount: (row.useCount ?? 0) + 1,
      lastUsedAt: now,
      updatedAt: now,
    };
    await db.foods.put(next);
    return;
  }
  const stored: StoredFood = { ...foodFields(food), id: food.id, useCount: 1, lastUsedAt: now, updatedAt: now };
  await db.foods.put(stored);
}

/** Foods used before, most-recent first. */
export async function getRecentFoods(limit = 20): Promise<FoodItem[]> {
  const rows = (await db.foods.toArray()).filter((f) => alive(f) && f.lastUsedAt !== undefined);
  return rows
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, limit)
    .map(storedToFoodItem);
}

/** Foods used most often, highest use-count first. */
export async function getFrequentFoods(limit = 20): Promise<FoodItem[]> {
  const rows = (await db.foods.toArray()).filter((f) => alive(f) && (f.useCount ?? 0) > 0);
  return rows
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, limit)
    .map(storedToFoodItem);
}

/** Favourited foods, alphabetical. */
export async function getFavoriteFoods(): Promise<FoodItem[]> {
  const rows = (await db.foods.toArray()).filter((f) => alive(f) && f.favorite === true);
  return rows.sort((a, b) => a.name.localeCompare(b.name)).map(storedToFoodItem);
}

/** User-created custom foods, alphabetical. */
export async function getCustomFoods(): Promise<FoodItem[]> {
  const rows = (await db.foods.toArray()).filter((f) => alive(f) && f.source === 'user');
  return rows.sort((a, b) => a.name.localeCompare(b.name)).map(storedToFoodItem);
}
