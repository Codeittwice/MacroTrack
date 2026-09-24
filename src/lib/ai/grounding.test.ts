import { describe, expect, it, vi } from 'vitest';
import type { FoodItem } from '@/db/types';
import { groundEstimate } from './grounding';

const COTTAGE_CHEESE: FoodItem = {
  id: 'nevo:42', source: 'nevo', name: 'Huttenkase', per100: { kcal: 90, protein: 12, carbs: 3, fat: 3 }, servings: [], unit: 'g',
};

describe('groundEstimate', () => {
  it('replaces an estimate with a strong NEVO/OFF name match', async () => {
    const search = vi.fn(async () => [COTTAGE_CHEESE]);
    const [item] = await groundEstimate({ items: [{ name: 'Huttenkase', grams: 150, nutrients: { kcal: 500, protein: 1, carbs: 1, fat: 1 }, confidence: 0.7 }] }, search);
    expect(search).toHaveBeenCalledWith('Huttenkase');
    expect(item).toMatchObject({ grounded: true, food: { id: 'nevo:42' } });
  });

  it('keeps a clearly labelled AI estimate when no match is strong enough', async () => {
    const [item] = await groundEstimate({ items: [{ name: 'Grandmas mystery bowl', grams: 200, nutrients: { kcal: 400, protein: 20, carbs: 30, fat: 15 }, confidence: 0.3 }] }, async () => [COTTAGE_CHEESE]);
    expect(item.grounded).toBe(false);
    expect(item.food).toMatchObject({ source: 'ai', name: 'Grandmas mystery bowl', per100: { kcal: 200, protein: 10, carbs: 15, fat: 7.5 } });
  });

  it('keeps validated estimates when catalogue search fails', async () => {
    const [item] = await groundEstimate({ items: [{ name: 'Rice bowl', grams: 100, nutrients: { kcal: 150, protein: 4, carbs: 28, fat: 2 }, confidence: 0.5 }] }, async () => { throw new Error('offline'); });
    expect(item).toMatchObject({ grounded: false, food: { source: 'ai', per100: { kcal: 150 } } });
  });

  it('rejects malformed provider output before it can reach food logging', async () => {
    await expect(groundEstimate({ items: [{ name: '', grams: -1, nutrients: { kcal: 1, protein: 1, carbs: 1, fat: 1 }, confidence: 2 }] })).rejects.toThrow();
  });
});
