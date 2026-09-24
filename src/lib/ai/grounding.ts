import { z } from 'zod';
import type { FoodItem, Nutrients } from '@/db/types';
import { searchFoods } from '@/lib/food-sources/search';
import { normalizeText } from '@/lib/food-sources/normalize';

const nutrientsSchema = z.object({
  kcal: z.number().finite().min(0),
  protein: z.number().finite().min(0),
  carbs: z.number().finite().min(0),
  fat: z.number().finite().min(0),
});

export const aiEstimateItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().finite().positive().max(5000),
  nutrients: nutrientsSchema,
  confidence: z.number().finite().min(0).max(1),
  foodQuery: z.string().trim().min(1).max(120).optional(),
});

export const aiMealEstimateSchema = z.object({
  items: z.array(aiEstimateItemSchema).min(1).max(20),
});

export type AiEstimateItem = z.infer<typeof aiEstimateItemSchema>;
export type AiMealEstimate = z.infer<typeof aiMealEstimateSchema>;

export interface GroundedEstimateItem {
  estimate: AiEstimateItem;
  food: FoodItem;
  grounded: boolean;
}

export type FoodSearcher = (query: string) => Promise<FoodItem[]>;

function nameMatchScore(query: string, candidate: string): number {
  const left = normalizeText(query);
  const right = normalizeText(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return common / Math.max(leftTokens.size, rightTokens.size);
}

function aiFood(item: AiEstimateItem): FoodItem {
  const factor = 100 / item.grams;
  const per100: Nutrients = {
    kcal: item.nutrients.kcal * factor,
    protein: item.nutrients.protein * factor,
    carbs: item.nutrients.carbs * factor,
    fat: item.nutrients.fat * factor,
  };
  return {
    id: `ai:${crypto.randomUUID()}`,
    source: 'ai',
    name: item.name,
    per100,
    servings: [{ label: 'Estimated portion', grams: item.grams }],
    unit: 'g',
  };
}

/**
 * Replace an AI estimate only when an offline/online food-source result strongly matches its name.
 * The estimated portion remains intact; users can still adjust it in the existing amount screen.
 */
export async function groundEstimate(
  estimate: AiMealEstimate,
  search: FoodSearcher = (query) => searchFoods(query, { sources: ['nevo', 'off'], limit: 10 }),
): Promise<GroundedEstimateItem[]> {
  const validated = aiMealEstimateSchema.parse(estimate);
  return Promise.all(validated.items.map(async (item) => {
    const query = item.foodQuery ?? item.name;
    try {
      const candidates = await search(query);
      const best = candidates
        .filter((candidate) => candidate.source === 'nevo' || candidate.source === 'off')
        .map((candidate) => ({ candidate, score: nameMatchScore(query, candidate.name) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= 0.8) return { estimate: item, food: best.candidate, grounded: true };
    } catch {
      // A local estimate remains useful when catalogue search is temporarily unavailable.
    }
    return { estimate: item, food: aiFood(item), grounded: false };
  }));
}
