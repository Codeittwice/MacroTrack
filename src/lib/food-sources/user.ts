import MiniSearch from 'minisearch';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { FoodItem, FoodSource, Nutrients, Recipe, StoredFood } from '@/db/types';
import { scale, sum, round } from '@/lib/utils/nutrients';
import { normalizeForIndex, normalizeQuery, normalizeText } from './normalize';
import { runQuery } from './query';

function storedFoodToFoodItem(f: StoredFood): FoodItem {
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

interface Doc {
  id: string;
  name: string;
  brand: string;
}

function buildFoodIndex(foods: StoredFood[]): MiniSearch<Doc> {
  const mini = new MiniSearch<Doc>({
    fields: ['name', 'brand'],
    storeFields: ['name', 'brand'],
    processTerm: normalizeForIndex,
  });
  const docs: Doc[] = foods.map((f) => ({ id: f.id, name: f.name, brand: f.brand ?? '' }));
  if (docs.length) mini.addAll(docs);
  return mini;
}

async function searchUserFoods(query: string, limit = 25): Promise<FoodItem[]> {
  const all = (await db.foods.toArray()).filter(alive);
  const q = query.trim();

  if (!q) {
    return all
      .slice()
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || (b.useCount ?? 0) - (a.useCount ?? 0))
      .slice(0, limit)
      .map(storedFoodToFoodItem);
  }

  const { text } = normalizeQuery(q);
  const mini = buildFoodIndex(all);
  const results = runQuery(mini, text || normalizeText(q));
  const byId = new Map(all.map((f) => [f.id, f]));
  return results
    .slice(0, limit)
    .map((r) => byId.get(String(r.id)))
    .filter((f): f is StoredFood => !!f)
    .map(storedFoodToFoodItem);
}

async function getUserFoodById(id: string): Promise<FoodItem | undefined> {
  const f = await db.foods.get(id);
  if (!f || !alive(f)) return undefined;
  return storedFoodToFoodItem(f);
}

export const userFoodsSource: FoodSource = {
  id: 'user',
  search: searchUserFoods,
  getById: getUserFoodById,
};

/** Derive a FoodItem (per-100 nutrients) from a recipe's ingredients and yield. */
export function recipeToFoodItem(r: Recipe): FoodItem {
  const totals = sum(r.ingredients.map((i) => scale(i.food.per100, i.grams)));
  const ingredientGrams = r.ingredients.reduce((acc, i) => acc + i.grams, 0);
  const denom = r.yieldGrams > 0 ? r.yieldGrams : ingredientGrams;
  const f = denom > 0 ? 100 / denom : 0;

  const per100: Nutrients = { kcal: round(totals.kcal * f, 4), protein: round(totals.protein * f, 4), carbs: round(totals.carbs * f, 4), fat: round(totals.fat * f, 4) };
  if (totals.fiber !== undefined) per100.fiber = round(totals.fiber * f, 4);
  if (totals.sugar !== undefined) per100.sugar = round(totals.sugar * f, 4);
  if (totals.satFat !== undefined) per100.satFat = round(totals.satFat * f, 4);
  if (totals.sodium !== undefined) per100.sodium = round(totals.sodium * f, 4);
  if (totals.salt !== undefined) per100.salt = round(totals.salt * f, 4);
  if (totals.alcohol !== undefined) per100.alcohol = round(totals.alcohol * f, 4);

  const servingsCount = Math.max(1, r.servings);

  return {
    id: `recipe:${r.id}`,
    source: 'recipe',
    name: r.name,
    per100,
    unit: 'g',
    servings: [
      { label: '1 serving', grams: denom / servingsCount },
      { label: '100 g', grams: 100 },
    ],
  };
}

async function searchRecipes(query: string, limit = 25): Promise<FoodItem[]> {
  const all = (await db.recipes.toArray()).filter(alive);
  const q = query.trim();

  if (!q) {
    return all
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map(recipeToFoodItem);
  }

  const { text } = normalizeQuery(q);
  const mini = new MiniSearch<{ id: string; name: string }>({
    fields: ['name'],
    storeFields: ['name'],
    processTerm: normalizeForIndex,
  });
  const docs = all.map((r) => ({ id: r.id, name: r.name }));
  if (docs.length) mini.addAll(docs);
  const results = runQuery(mini, text || normalizeText(q));
  const byId = new Map(all.map((r) => [r.id, r]));
  return results
    .slice(0, limit)
    .map((r) => byId.get(String(r.id)))
    .filter((r): r is Recipe => !!r)
    .map(recipeToFoodItem);
}

async function getRecipeById(id: string): Promise<FoodItem | undefined> {
  const rid = id.startsWith('recipe:') ? id.slice(7) : id;
  const r = await db.recipes.get(rid);
  if (!r || !alive(r)) return undefined;
  return recipeToFoodItem(r);
}

export const recipesSource: FoodSource = {
  id: 'recipe',
  search: searchRecipes,
  getById: getRecipeById,
};
