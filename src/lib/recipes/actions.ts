/** Recipe and saved-meal mutations. Food snapshots are retained in ingredients/items for offline reuse. */
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { DateKey, FoodItem, LogEntry, Recipe, SavedMeal } from '@/db/types';
import { addLogEntry } from '@/lib/log/actions';

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

function logEntryToFood(entry: LogEntry): FoodItem {
  const per100 = entry.per100 ?? (entry.grams > 0
    ? { kcal: (entry.nutrients.kcal * 100) / entry.grams, protein: (entry.nutrients.protein * 100) / entry.grams, carbs: (entry.nutrients.carbs * 100) / entry.grams, fat: (entry.nutrients.fat * 100) / entry.grams }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return { id: entry.foodId, source: entry.source, name: entry.name, brand: entry.brand, per100, servings: [], unit: 'g' };
}

/** Save a meal's logged snapshots for future offline reuse. */
export async function saveLogEntriesAsMeal(name: string, entries: LogEntry[]): Promise<SavedMeal> {
  return createSavedMeal({ name, items: entries.map((entry) => ({ food: logEntryToFood(entry), grams: entry.grams })) });
}

/** Log every item in a saved meal, snapshotting current serving amounts into the target meal. */
export async function logSavedMeal(savedMeal: SavedMeal, date: DateKey, meal: number): Promise<LogEntry[]> {
  if (!alive(savedMeal)) throw new Error(`saved meal ${savedMeal.id} not found`);
  return Promise.all(savedMeal.items.map((item) => addLogEntry({ date, meal, food: item.food, grams: item.grams })));
}
