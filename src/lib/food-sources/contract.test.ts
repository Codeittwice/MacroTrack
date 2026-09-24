/**
 * Contract test: the rows written by scripts/build-nevo.ts must be consumable by the
 * runtime NEVO source unchanged (synthetic fixture → parser → JSON round-trip → search).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseNevoCsv, buildNevoFile, decodeBuffer } from '../../../scripts/build-nevo';
import { nevoSource, __setNevoDataForTest } from './nevo';
import { NEVO_ROW_LENGTH, type NevoFile } from './nevo-format';
import { searchFoods, getFoodById } from './search';
import { synonymVariants } from './normalize';
import { db } from '@/db/schema';

function fixtureFile(): NevoFile {
  const buf = readFileSync(path.resolve(process.cwd(), 'scripts/fixtures/nevo-sample.csv'));
  const file = buildNevoFile(parseNevoCsv(decodeBuffer(buf)), 'nevo-sample.csv');
  // Round-trip through JSON exactly like the app does via fetch().
  return JSON.parse(JSON.stringify(file)) as NevoFile;
}

describe('nevo.json contract (build script ↔ runtime)', () => {
  beforeEach(async () => {
    await db.foods.clear();
    __setNevoDataForTest(fixtureFile().rows);
  });
  afterEach(() => __setNevoDataForTest(null));

  it('every generated row has the 15-position tuple shape', () => {
    const file = fixtureFile();
    expect(file.header.count).toBe(file.rows.length);
    for (const r of file.rows) {
      expect(r).toHaveLength(NEVO_ROW_LENGTH);
      expect(typeof r[0]).toBe('number');
      expect(['g', 'ml']).toContain(r[5]);
      for (const i of [6, 7, 8, 9]) expect(typeof r[i]).toBe('number');
      for (const i of [10, 11, 12, 13, 14]) expect(r[i] === null || typeof r[i] === 'number').toBe(true);
    }
  });

  it('"AH turkse broodjes" finds the fixture Brood Turks row first', async () => {
    const res = await nevoSource.search('AH turkse broodjes');
    expect(res[0]?.name).toBe('Brood, Turks');
    expect(res[0]?.id).toBe('nevo:101');
  });

  it('maps fixture values into FoodItem per100 (ml unit, salt, missing optionals)', async () => {
    const yoghurt = await getFoodById('nevo:104');
    expect(yoghurt?.unit).toBe('ml');
    expect(yoghurt?.servings[0]).toEqual({ label: '100 ml', grams: 100 });
    const brood = await getFoodById('nevo:101');
    expect(brood?.per100.kcal).toBeCloseTo(250.5);
    expect(brood?.per100.salt).toBeCloseTo(1.2);
    const empty = await getFoodById('nevo:107');
    expect(empty?.per100).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('multi-word synonyms work in both directions', async () => {
    expect(synonymVariants('peanut butter')).toContain('pindakaas');
    expect(synonymVariants('kipfilet')).toContain('chicken breast');
    const pb = await nevoSource.search('peanut butter');
    expect(pb[0]?.id).toBe('nevo:103');
    // a user food named in English is found by its Dutch synonym
    await db.foods.put({ id: 'user:cb', source: 'user', name: 'Chicken breast grilled', per100: { kcal: 150, protein: 30, carbs: 0, fat: 3 }, servings: [], updatedAt: 1 });
    const res = await searchFoods('kipfilet');
    expect(res.map((r) => r.id)).toContain('user:cb');
    expect(res.map((r) => r.id)).toContain('nevo:102');
  });
});
