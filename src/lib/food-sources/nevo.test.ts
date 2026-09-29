import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nevoSource, __setNevoDataForTest, type NevoRow } from './nevo';

const ROWS: NevoRow[] = [
  [1001, 'Brood Turks', 'Bread Turkish', 'Turks brood', 'Brood', 'g', 270, 9.1, 50.2, 3.4, 2.5, 2.1, 0.6, 480, null],
  [1002, 'Kipfilet rauw', 'Chicken breast raw', '', 'Vlees en gevogelte', 'g', 110, 23.5, 0, 1.8, null, null, 0.5, 60, null],
  [1003, 'Pindakaas', 'Peanut butter', '', 'Noten', 'g', 620, 24, 12, 50, 7, 5, 9, 400, null],
  [1004, 'Yoghurt volle', 'Yoghurt full fat', '', 'Melkproducten', 'ml', 60, 3.5, 4.5, 3, null, 4.5, 2, 45, null],
  [1005, 'Kwark mager', 'Quark low fat', '', 'Melkproducten', 'g', 60, 12, 4, 0.2, null, 4, 0.1, 40, null],
  [1006, 'Melk halfvol', 'Milk semi-skimmed', '', 'Melkproducten', 'ml', 46, 3.4, 4.7, 1.5, null, 4.7, 1, 44, null],
];

beforeEach(() => {
  __setNevoDataForTest(ROWS);
});

describe('nevoSource.search', () => {
  it('finds "Brood Turks" first for a brand-prefixed Dutch query', async () => {
    const results = await nevoSource.search('AH turkse broodjes');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('nevo:1001');
  });

  it('is fuzzy-tolerant of typos', async () => {
    const results = await nevoSource.search('kipfilt');
    expect(results.some((r) => r.id === 'nevo:1002')).toBe(true);
  });

  it('maps sodium to salt and drops null fields', async () => {
    const results = await nevoSource.search('kipfilet');
    const kip = results.find((r) => r.id === 'nevo:1002')!;
    expect(kip.per100.sodium).toBe(60);
    expect(kip.per100.salt).toBeCloseTo(0.15, 2);
    expect(kip.per100.fiber).toBeUndefined();
  });

  it('finds peanut butter via the English synonym', async () => {
    const results = await nevoSource.search('peanut butter');
    expect(results.some((r) => r.id === 'nevo:1003')).toBe(true);
  });

  it('finds yoghurt via the "yogurt" synonym', async () => {
    const results = await nevoSource.search('yogurt');
    expect(results.some((r) => r.id === 'nevo:1004')).toBe(true);
  });

  it('returns [] and does not throw for an empty dataset', async () => {
    __setNevoDataForTest([]);
    const results = await nevoSource.search('pindakaas');
    expect(results).toEqual([]);
  });

  it('returns [] and does not throw when fetch fails', async () => {
    __setNevoDataForTest(null);
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const results = await nevoSource.search('pindakaas');
    expect(results).toEqual([]);
    fetchSpy.mockRestore();
    __setNevoDataForTest(ROWS);
  });
});

describe('nevoSource.getById', () => {
  it('resolves a known code', async () => {
    const item = await nevoSource.getById!('nevo:1003');
    expect(item?.name).toBe('Pindakaas');
  });

  it('returns undefined for an unknown code', async () => {
    const item = await nevoSource.getById!('nevo:9999');
    expect(item).toBeUndefined();
  });
});
