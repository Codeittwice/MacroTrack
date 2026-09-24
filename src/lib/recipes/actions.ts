/** Recipe and saved-meal mutations. Food snapshots are retained in ingredients/items for offline reuse. */
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { FoodItem, Recipe, SavedMeal } from '@/db/types';

export interface RecipeIngredient {
  food: FoodItem;
  grams: number;
}

export interface RecipeInput {
  name: string;
  ingredients: RecipeIngredient[];
  yieldGrams: number;
  servings: number;
}

export interface SavedMealInput {
  name: string;
  items: RecipeIngredient[];
}

function validAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function cleanName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) throw new Error('name is required');
  return cleaned;
}

function snapshotItems(items: RecipeIngredient[]): RecipeIngredient[] {
  if (!items.length) throw new Error('at least one ingredient is required');
  return items.map(({ food, grams }) => {
    if (!validAmount(grams)) throw new Error('ingredient grams must be a finite number > 0');
    return {
      food: { ...food, per100: { ...food.per100 }, servings: food.servings.map((serving) => ({ ...serving })) },
      grams,
    };
  });
}

function validateRecipe(input: RecipeInput): Omit<Recipe, 'id' | 'updatedAt'> {
  if (!validAmount(input.yieldGrams)) throw new Error('yield grams must be a finite number > 0');
  if (!validAmount(input.servings)) throw new Error('servings must be a finite number > 0');
  return { name: cleanName(input.name), ingredients: snapshotItems(input.ingredients), yieldGrams: input.yieldGrams, servings: input.servings };
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const recipe: Recipe = newRecord(validateRecipe(input));
  await db.recipes.put(recipe);
  return recipe;
}

export async function updateRecipe(id: string, patch: Partial<RecipeInput>): Promise<void> {
  const existing = await db.recipes.get(id);
  if (!existing || !alive(existing)) throw new Error(`recipe ${id} not found`);
  const next = validateRecipe({
    name: patch.name ?? existing.name,
    ingredients: patch.ingredients ?? existing.ingredients,
    yieldGrams: patch.yieldGrams ?? existing.yieldGrams,
    servings: patch.servings ?? existing.servings,
  });
  await db.recipes.put({ ...existing, ...next, updatedAt: Date.now() });
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function createSavedMeal(input: SavedMealInput): Promise<SavedMeal> {
  const meal: SavedMeal = newRecord({ name: cleanName(input.name), items: snapshotItems(input.items) });
  await db.savedMeals.put(meal);
  return meal;
}

export async function updateSavedMeal(id: string, patch: Partial<SavedMealInput>): Promise<void> {
  const existing = await db.savedMeals.get(id);
  if (!existing || !alive(existing)) throw new Error(`saved meal ${id} not found`);
  const name = patch.name === undefined ? existing.name : cleanName(patch.name);
  const items = patch.items === undefined ? existing.items : snapshotItems(patch.items);
  await db.savedMeals.put({ ...existing, name, items, updatedAt: Date.now() });
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await db.savedMeals.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}
