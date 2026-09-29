import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import { getWeights } from './queries';
import {
  LB_PER_KG,
  kgToLb,
  lbToKg,
  toDisplay,
  fromDisplay,
  formatWeight,
  logWeight,
  updateWeight,
  deleteWeight,
} from './actions';

beforeEach(async () => {
  await db.weights.clear();
});

describe('unit conversion', () => {
  it('kgToLb / lbToKg known values', () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462, 4);
    expect(lbToKg(100)).toBeCloseTo(45.359, 2);
  });

  it('round-trips kg -> lb -> kg', () => {
    const kg = 82.3;
    expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
  });

  it('LB_PER_KG matches the constant used internally', () => {
    expect(kgToLb(1)).toBe(LB_PER_KG);
  });

  it('toDisplay / fromDisplay round-trip for both units', () => {
    expect(toDisplay(80, 'kg')).toBe(80);
    expect(toDisplay(80, 'lb')).toBeCloseTo(176.37, 1);
    expect(fromDisplay(176.4, 'lb')).toBeCloseTo(80.01, 1);
    expect(fromDisplay(80, 'kg')).toBe(80);
  });
});

describe('formatWeight', () => {
  it('formats kg with default decimals and unit label', () => {
    expect(formatWeight(80, 'kg')).toBe('80.0 kg');
  });

  it('formats lb converting from kg', () => {
    expect(formatWeight(80, 'lb')).toBe('176.4 lb');
  });

  it('respects custom decimals', () => {
    expect(formatWeight(80.456, 'kg', { decimals: 2 })).toBe('80.46 kg');
    expect(formatWeight(80, 'kg', { decimals: 0 })).toBe('80 kg');
  });

  it('omits the unit label when unitLabel is false', () => {
    expect(formatWeight(80, 'kg', { unitLabel: false })).toBe('80.0');
  });

  it('signs positive, negative and zero deltas', () => {
    expect(formatWeight(0.5, 'kg', { signed: true })).toBe('+0.5 kg');
    expect(formatWeight(-0.5, 'kg', { signed: true })).toBe('−0.5 kg');
    expect(formatWeight(0, 'kg', { signed: true })).toBe('0.0 kg');
  });

  it('converts signed deltas to lb linearly', () => {
    const deltaKg = 1;
    const out = formatWeight(deltaKg, 'lb', { signed: true, decimals: 2 });
    expect(out).toBe(`+${kgToLb(deltaKg).toFixed(2)} lb`);
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatWeight(NaN, 'kg')).toBe('—');
    expect(formatWeight(Infinity, 'kg')).toBe('—');
  });
});

describe('logWeight', () => {
  it('writes a record with time set and the given date, returning the new id', async () => {
    const before = Date.now();
    const id = await logWeight({ date: '2026-09-24', kg: 80.2 });
    const after = Date.now();
    expect(id).toBeTruthy();

    const rec = await db.weights.get(id);
    expect(rec).toBeDefined();
    expect(rec!.date).toBe('2026-09-24');
    expect(rec!.kg).toBe(80.2);
    expect(rec!.time).toBeGreaterThanOrEqual(before);
    expect(rec!.time).toBeLessThanOrEqual(after);
  });

  it('allows two logs on the same date and both are returned by getWeights()', async () => {
    await logWeight({ date: '2026-09-24', kg: 80 });
    await logWeight({ date: '2026-09-24', kg: 80.4 });
    const rows = await getWeights();
    expect(rows.filter((r) => r.date === '2026-09-24')).toHaveLength(2);
  });

  it('drops bodyFatPct when not finite', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80, bodyFatPct: NaN });
    const rec = await db.weights.get(id);
    expect(rec!.bodyFatPct).toBeUndefined();
  });

  it('trims note and omits it when empty', async () => {
    const id1 = await logWeight({ date: '2026-09-24', kg: 80, note: '  hi there  ' });
    const rec1 = await db.weights.get(id1);
    expect(rec1!.note).toBe('hi there');

    const id2 = await logWeight({ date: '2026-09-24', kg: 80, note: '   ' });
    const rec2 = await db.weights.get(id2);
    expect(rec2!.note).toBeUndefined();
  });

  it('rejects kg <= 0 or NaN', async () => {
    await expect(logWeight({ date: '2026-09-24', kg: 0 })).rejects.toThrow();
    await expect(logWeight({ date: '2026-09-24', kg: -5 })).rejects.toThrow();
    await expect(logWeight({ date: '2026-09-24', kg: NaN })).rejects.toThrow();
  });
});

describe('updateWeight', () => {
  it('patches fields and bumps updatedAt', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80 });
    const before = (await db.weights.get(id))!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));

    await updateWeight(id, { kg: 79.5, date: '2026-09-25' });
    const rec = await db.weights.get(id);
    expect(rec!.kg).toBe(79.5);
    expect(rec!.date).toBe('2026-09-25');
    expect(rec!.updatedAt).toBeGreaterThan(before);
  });

  it('rejects an invalid kg patch', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80 });
    await expect(updateWeight(id, { kg: -1 })).rejects.toThrow();
  });

  it('clears note when patched with empty string', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80, note: 'hello' });
    await updateWeight(id, { note: '' });
    const rec = await db.weights.get(id);
    expect(rec!.note).toBeUndefined();
    expect('note' in rec!).toBe(false);
  });

  it('clears bodyFatPct when patched with undefined', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80, bodyFatPct: 20 });
    await updateWeight(id, { bodyFatPct: undefined });
    const rec = await db.weights.get(id);
    expect(rec!.bodyFatPct).toBeUndefined();
    expect('bodyFatPct' in rec!).toBe(false);
  });
});

describe('deleteWeight', () => {
  it('sets deletedAt and excludes the row from getWeights()', async () => {
    const id = await logWeight({ date: '2026-09-24', kg: 80 });
    await deleteWeight(id);
    const rec = await db.weights.get(id);
    expect(rec!.deletedAt).toBeGreaterThan(0);

    const rows = await getWeights();
    expect(rows.find((r) => r.id === id)).toBeUndefined();
  });
});
