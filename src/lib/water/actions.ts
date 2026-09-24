import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { DateKey, WaterEntry } from '@/db/types';
import { today } from '@/lib/utils/date';

function validMl(ml: number): boolean {
  return Number.isFinite(ml) && ml >= 0 && ml <= 20_000;
}

export async function getWater(date: DateKey): Promise<number> {
  const entries = (await db.water.where('date').equals(date).toArray()).filter(alive);
  return entries.reduce((total, entry) => total + entry.ml, 0);
}

export function useWater(date: DateKey = today()): number | undefined {
  return useLiveQuery(() => getWater(date), [date]);
}

/** Store a day total in one syncable entry, replacing an existing active total for that date. */
export async function setWater(date: DateKey, ml: number): Promise<WaterEntry> {
  if (!validMl(ml)) throw new Error('water must be a finite number between 0 and 20,000 ml');
  const existing = (await db.water.where('date').equals(date).toArray()).find(alive);
  const entry: WaterEntry = existing ? { ...existing, ml, updatedAt: Date.now() } : newRecord({ date, ml });
  await db.water.put(entry);
  return entry;
}

export async function addWater(date: DateKey, deltaMl: number): Promise<WaterEntry> {
  if (!Number.isFinite(deltaMl)) throw new Error('water delta must be finite');
  return setWater(date, Math.max(0, await getWater(date) + deltaMl));
}
