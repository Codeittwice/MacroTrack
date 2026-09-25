import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/schema';
import { __resetOffSearchStateForTest, cacheOffFood, offProductToFoodItem, offSearchTerms, offSource } from './off';

const PRODUCT = {
  code: '8710000000012',
  product_name: 'Test yoghurt',
  product_name_en: 'Test yogurt',
  brands: 'Test brand',
  nutriments: {
    'energy-kcal_100g': 62,
    proteins_100g: 4.5,
    carbohydrates_100g: 5.2,
    fat_100g: 2.1,
    fiber_100g: 0.3,
    sugars_100g: 5.1,
    'saturated-fat_100g': 1.3,
    sodium_100g: 0.04,
    salt_100g: 0.1,
  },
};

beforeEach(async () => {
  __resetOffSearchStateForTest();
  await db.foods.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('offProductToFoodItem', () => {
  it('maps product names, barcode, macros, and key micronutrients', () => {
    const food = offProductToFoodItem(PRODUCT)!;
    expect(food).toMatchObject({
      id: 'off:8710000000012',
      source: 'off',
      name: 'Test yoghurt',
      nameEn: 'Test yogurt',
      brand: 'Test brand',
      barcode: '8710000000012',
      per100: { kcal: 62, protein: 4.5, carbs: 5.2, fat: 2.1, fiber: 0.3, sugar: 5.1, satFat: 1.3, sodium: 40, salt: 0.1 },
    });
    expect(food.servings).toEqual([{ label: '100 g', grams: 100 }]);
  });

  it('drops a product without both a barcode and a usable name', () => {
    expect(offProductToFoodItem({ code: '1', nutriments: {} })).toBeUndefined();
    expect(offProductToFoodItem({ product_name: 'No barcode', nutriments: {} })).toBeUndefined();
  });
});

describe('offSource', () => {
  it('searches the Netherlands endpoint and caches mapped products', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: [PRODUCT] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const [food] = await offSource.search('test yoghurt');
    expect(food.id).toBe('off:8710000000012');
    expect(String(fetchMock.mock.calls[0][0])).toContain('countries_tags=netherlands');
    expect((await db.foods.get(food.id))?.source).toBe('off');
  });

  it('uses the cached product when an online search fails', async () => {
    const food = offProductToFoodItem(PRODUCT)!;
    await cacheOffFood(food);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const results = await offSource.search('test yoghurt');
    expect(results.map((item) => item.id)).toContain(food.id);
  });

  it('resolves a barcode once online, then from cache without another request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ product: PRODUCT }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await offSource.getByBarcode!('8710000000012');
    const second = await offSource.getByBarcode!('8710000000012');
    expect(first?.id).toBe('off:8710000000012');
    expect(second?.id).toBe(first?.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('offSearchTerms', () => {
  it('turns Dutch plurals, adjectives and shop prefixes into OFF search terms', () => {
    expect(offSearchTerms('AH turkse broodjes')).toEqual({ terms: 'turks brood albert heijn', withoutBrand: 'turks brood' });
    expect(offSearchTerms('jumbo pindakaas')).toEqual({ terms: 'pindakaas jumbo', withoutBrand: 'pindakaas' });
    expect(offSearchTerms('kipfilet')).toEqual({ terms: 'kipfilet', withoutBrand: 'kipfilet' });
    expect(offSearchTerms('chocolademousse').withoutBrand).toBe('chocolademousse');
  });
});

describe('OFF rate limiting', () => {
  it('serves repeated queries from memory and stops calling the API past the budget', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ products: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await offSource.search('yoghurt');
    await offSource.search('yoghurt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) await offSource.search(`product ${i}`);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(8);
    vi.unstubAllGlobals();
  });
});

describe('OFF servings', () => {
  it('adds the printed portion before 100 g and ignores nonsense', () => {
    const base = { code: '8718907976695', product_name: 'Turks brood', nutriments: { 'energy-kcal_100g': 262 } };
    expect(offProductToFoodItem({ ...base, serving_size: '1 broodje (90 g)', serving_quantity: '90' } as never)!.servings).toEqual([{ label: '1 broodje (90 g)', grams: 90 }, { label: '100 g', grams: 100 }]);
    expect(offProductToFoodItem({ ...base, serving_quantity: 0 } as never)!.servings).toEqual([{ label: '100 g', grams: 100 }]);
  });
});
