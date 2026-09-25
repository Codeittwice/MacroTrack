/**
 * Single source of truth for the compact `public/data/nevo.json` format.
 * Written by scripts/build-nevo.ts, read by ./nevo.ts. Type-only + constants, no runtime deps,
 * so the Node build script can import it without pulling in browser code.
 */

/** One NEVO food, per 100 g (or 100 ml when unit === 'ml'). Values exactly as published by RIVM (no rounding). */
export type NevoRow = [
  code: number,
  nameNl: string,
  nameEn: string /* '' if missing */,
  synonyms: string /* '' if missing */,
  group: string /* '' if missing */,
  unit: 'g' | 'ml',
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number | null,
  sugar: number | null,
  satFat: number | null,
  sodium: number | null /* mg */,
  alcohol: number | null,
];

export interface NevoHeader {
  version: string;
  source: string;
  attribution: string;
  count: number;
}

export interface NevoFile {
  header: NevoHeader;
  rows: NevoRow[];
}

/** Number of positions in a NevoRow tuple. */
export const NEVO_ROW_LENGTH = 15;
