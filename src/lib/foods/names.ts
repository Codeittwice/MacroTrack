import type { Settings } from '@/db/types';
import { normalizeText } from '@/lib/food-sources/normalize';

export type FoodNameMode = Settings['foodNames'];

/**
 * The name to show for a food, and the second-language name under it when the mode is 'both'.
 * `name` is the source's own name (Dutch for NEVO and most Dutch products); `nameEn` is the English one.
 */
export function foodNames(item: { name: string; nameEn?: string }, mode: FoodNameMode): { primary: string; secondary?: string } {
  const en = item.nameEn?.trim();
  if (!en || mode === 'nl') return { primary: item.name };
  if (mode === 'en' || normalizeText(en) === normalizeText(item.name)) return { primary: en };
  return { primary: en, secondary: item.name };
}
