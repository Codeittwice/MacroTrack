import { z } from 'zod';
import type { AiProviderId, Nutrients } from '@/db/types';
import { askProvider, stripJsonFence, validateImage, type MealImage } from './client';

const num = z.number().finite().min(0);
const labelSchema = z.object({
  name: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(80).optional(),
  unit: z.enum(['g', 'ml']).default('g'),
  per100: z.object({
    kcal: num.max(950),
    protein: num.max(100),
    carbs: num.max(100),
    fat: num.max(100),
    fiber: num.max(100).optional(),
    sugar: num.max(100).optional(),
    satFat: num.max(100).optional(),
    salt: num.max(100).optional(),
  }),
  servingGrams: num.max(2000).optional(),
  servingLabel: z.string().trim().max(40).optional(),
});

export interface LabelReading {
  name?: string;
  brand?: string;
  unit: 'g' | 'ml';
  per100: Nutrients;
  serving?: { label: string; grams: number };
}

const INSTRUCTIONS = `You read food nutrition labels, usually Dutch ("Voedingswaarde", "per 100 g", "Energie", "Vetten", "waarvan verzadigde vetzuren", "Koolhydraten", "waarvan suikers", "Voedingsvezel", "Eiwitten", "Zout").
Return JSON only: {"name":string?,"brand":string?,"unit":"g"|"ml","per100":{"kcal":number,"protein":number,"carbs":number,"fat":number,"fiber":number?,"sugar":number?,"satFat":number?,"salt":number?},"servingGrams":number?,"servingLabel":string?}.
Values are per 100 g or 100 ml exactly as printed. Use kcal, not kJ (divide kJ by 4.184 only if kcal is missing). If the label only lists values per portion, convert them to per 100 using the portion size. Include a portion as servingGrams/servingLabel (e.g. "1 plak") only if printed. Use the product name and brand only if they are visible. Never guess numbers that aren't on the label.`;

/** Reads a nutrition label photo into per-100 values for a custom food. The user reviews them before saving. */
export async function readNutritionLabel(input: { provider: AiProviderId; apiKey: string; image: MealImage }, fetcher: typeof fetch = fetch): Promise<LabelReading> {
  validateImage(input.image);
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error('Add an API key for the selected provider in Settings.');
  const text = await askProvider({ provider: input.provider, apiKey, instructions: INSTRUCTIONS, userText: 'Read the nutrition label in this photo.', image: input.image }, fetcher);
  let parsed: z.infer<typeof labelSchema>;
  try {
    parsed = labelSchema.parse(JSON.parse(stripJsonFence(text)));
  } catch {
    throw new Error("The label couldn't be read. Try a sharper, straight-on photo of the nutrition table.");
  }
  const { per100 } = parsed;
  const nutrients: Nutrients = { kcal: per100.kcal, protein: per100.protein, carbs: per100.carbs, fat: per100.fat };
  if (per100.fiber !== undefined) nutrients.fiber = per100.fiber;
  if (per100.sugar !== undefined) nutrients.sugar = per100.sugar;
  if (per100.satFat !== undefined) nutrients.satFat = per100.satFat;
  if (per100.salt !== undefined) {
    nutrients.salt = per100.salt;
    nutrients.sodium = Math.round((per100.salt / 2.5) * 1000);
  }
  return {
    name: parsed.name || undefined,
    brand: parsed.brand || undefined,
    unit: parsed.unit,
    per100: nutrients,
    serving: parsed.servingGrams ? { label: parsed.servingLabel || '1 portion', grams: parsed.servingGrams } : undefined,
  };
}
