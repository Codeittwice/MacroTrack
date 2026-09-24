import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { addWater, getWater, setWater } from './actions';

beforeEach(async () => db.water.clear());

describe('water actions', () => {
  it('sets a daily total and replaces it on subsequent writes', async () => {
    await setWater('2026-09-24', 500);
    await setWater('2026-09-24', 750);
    expect(await getWater('2026-09-24')).toBe(750);
    expect(await db.water.where('date').equals('2026-09-24').count()).toBe(1);
  });

  it('adds and removes water without allowing a negative total', async () => {
    await addWater('2026-09-24', 250);
    await addWater('2026-09-24', -500);
    expect(await getWater('2026-09-24')).toBe(0);
    await expect(setWater('2026-09-24', 20_001)).rejects.toThrow();
  });
});
