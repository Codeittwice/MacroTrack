/**
 * Weight mutation API (Wave contract). Pairs with the read API in './queries.ts'.
 * Unit conversion + formatting helpers live here too so both the Weight page and
 * TrendChart share one source of truth.
 */
import { db } from '@/db/schema';
import { newRecord, softDelete } from '@/db/repo';
import type { DateKey, WeightEntry } from '@/db/types';

export const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Convert kg to the display unit (no rounding). */
export function toDisplay(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

/** Convert a value entered in the display unit back to kg. */
export function fromDisplay(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

export function formatWeight(
  kg: number,
  unit: 'kg' | 'lb',
  opts?: { decimals?: number; unitLabel?: boolean; signed?: boolean },
): string {
  if (!Number.isFinite(kg)) return '—';
  const decimals = opts?.decimals ?? 1;
  const unitLabel = opts?.unitLabel ?? true;
  const signed = opts?.signed ?? false;
  const value = toDisplay(kg, unit);
  const abs = Math.abs(value);
  let out = abs.toFixed(decimals);
  if (signed) {
    if (value > 0) out = `+${out}`;
    else if (value < 0) out = `−${out}`;
    // value === 0 (or rounds to it): no sign prefix
  } else if (value < 0) {
    out = `-${out}`;
  }
  return unitLabel ? `${out} ${unit}` : out;
}

export interface LogWeightInput {
  date: DateKey;
  kg: number;
  bodyFatPct?: number;
  note?: string;
}

function validateKg(kg: number): void {
  if (!Number.isFinite(kg) || kg <= 0) {
    throw new Error('kg must be a finite number greater than 0');
  }
}

/**
 * Adds a new weigh-in. Multiple entries per day are allowed; the trend averages them.
 * Returns the new record's id.
 */
export async function logWeight(input: LogWeightInput): Promise<string> {
  validateKg(input.kg);
  const bodyFatPct = Number.isFinite(input.bodyFatPct) ? input.bodyFatPct : undefined;
  const note = input.note?.trim();
  const entry: WeightEntry = newRecord({
    date: input.date,
    kg: input.kg,
    ...(bodyFatPct !== undefined ? { bodyFatPct } : {}),
    ...(note ? { note } : {}),
    time: Date.now(),
  });
  await db.weights.add(entry);
  return entry.id;
}

/**
 * Patches date/kg/bodyFatPct/note and stamps updatedAt. Passing bodyFatPct: undefined or
 * note: '' clears the field. Dexie's `update()` does not reliably delete keys when patched
 * with `undefined`, so clears are done via a read-modify-put instead.
 */
export async function updateWeight(id: string, patch: Partial<LogWeightInput>): Promise<void> {
  const existing = await db.weights.get(id);
  if (!existing) return;

  if ('kg' in patch && patch.kg !== undefined) validateKg(patch.kg);

  const next: WeightEntry = { ...existing, updatedAt: Date.now() };

  if ('date' in patch && patch.date !== undefined) next.date = patch.date;
  if ('kg' in patch && patch.kg !== undefined) next.kg = patch.kg;

  if ('bodyFatPct' in patch) {
    const v = patch.bodyFatPct;
    if (v === undefined || !Number.isFinite(v)) delete next.bodyFatPct;
    else next.bodyFatPct = v;
  }

  if ('note' in patch) {
    const trimmed = patch.note?.trim();
    if (!trimmed) delete next.note;
    else next.note = trimmed;
  }

  await db.weights.put(next);
}

/** Soft delete via softDelete(db.weights, id). */
export async function deleteWeight(id: string): Promise<void> {
  await softDelete(db.weights, id);
}
