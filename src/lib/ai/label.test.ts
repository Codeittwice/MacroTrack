import { describe, expect, it, vi } from 'vitest';
import { readNutritionLabel } from './label';

const image = { mediaType: 'image/jpeg', base64: 'AAAA' };
const claude = (payload: unknown) => vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] }), { status: 200 }));

describe('readNutritionLabel', () => {
  it('maps a Dutch label to per-100 values, derives sodium from salt and keeps the portion', async () => {
    const fetcher = claude({ name: 'Turks brood', brand: 'Albert Heijn', unit: 'g', per100: { kcal: 262, protein: 8.9, carbs: 49, fat: 2.4, fiber: 2.6, sugar: 2.1, satFat: 0.4, salt: 1.1 }, servingGrams: 90, servingLabel: '1 portie' });
    const r = await readNutritionLabel({ provider: 'claude', apiKey: 'k', image }, fetcher);
    expect(r).toMatchObject({ name: 'Turks brood', brand: 'Albert Heijn', unit: 'g', serving: { label: '1 portie', grams: 90 } });
    expect(r.per100).toMatchObject({ kcal: 262, protein: 8.9, salt: 1.1, sodium: 440 });
  });

  it('accepts fenced JSON and rejects impossible values', async () => {
    await expect(readNutritionLabel({ provider: 'claude', apiKey: 'k', image }, claude('```json\n{"per100":{"kcal":100,"protein":1,"carbs":20,"fat":1}}\n```'))).resolves.toMatchObject({ unit: 'g' });
    await expect(readNutritionLabel({ provider: 'claude', apiKey: 'k', image }, claude({ per100: { kcal: 2500, protein: 1, carbs: 1, fat: 1 } }))).rejects.toThrow("couldn't be read");
  });

  it('requires a key before sending anything', async () => {
    const fetcher = vi.fn();
    await expect(readNutritionLabel({ provider: 'openai', apiKey: ' ', image }, fetcher)).rejects.toThrow('Add an API key');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
