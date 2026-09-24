import type { DateKey } from '@/db/types';

export function toDateKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromDateKey(k);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

export const today = () => toDateKey();

export function ageOn(birthDate: DateKey, on: DateKey = today()): number {
  const b = fromDateKey(birthDate);
  const d = fromDateKey(on);
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age;
}
