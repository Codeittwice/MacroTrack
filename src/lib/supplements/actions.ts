/**
 * Supplements: a daily checklist of doses. Supplements with calories (protein powder, gainers)
 * also add a food-log entry per dose, which unticking removes again.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, getSettings, newRecord } from '@/db/repo';
import type { DateKey, FoodItem, Supplement, SupplementLog } from '@/db/types';
import { addLogEntry, deleteLogEntry } from '@/lib/log/actions';
import { addDays } from '@/lib/utils/date';

export type SupplementInput = Omit<Supplement, 'id' | 'updatedAt' | 'deletedAt'>;

function validate(input: SupplementInput): void {
  if (!input.name.trim()) throw new Error('Give the supplement a name.');
  if (!(input.dose > 0)) throw new Error('Enter a dose above 0.');
  if (!Number.isInteger(input.timesPerDay) || input.timesPerDay < 1 || input.timesPerDay > 6) throw new Error('Take it 1 to 6 times a day.');
  if (input.reminderTime && !/^\d{2}:\d{2}$/.test(input.reminderTime)) throw new Error('Use HH:MM for the reminder.');
}

export async function createSupplement(input: SupplementInput): Promise<Supplement> {
  validate(input);
  const s = newRecord({ ...input, name: input.name.trim() }) as Supplement;
  await db.supplements.put(s);
  return s;
}

export async function updateSupplement(id: string, input: SupplementInput): Promise<void> {
  validate(input);
  const cur = await db.supplements.get(id);
  if (!cur) throw new Error('Supplement not found.');
  await db.supplements.put({ ...cur, ...input, name: input.name.trim(), updatedAt: Date.now() });
}

export async function deleteSupplement(id: string): Promise<void> {
  const now = Date.now();
  await db.supplements.update(id, { deletedAt: now, updatedAt: now });
}

export function useSupplements(): Supplement[] | undefined {
  return useLiveQuery(async () => (await db.supplements.toArray()).filter(alive).sort((a, b) => a.name.localeCompare(b.name)), []);
}

export async function logsForDate(date: DateKey): Promise<SupplementLog[]> {
  return (await db.supplementLogs.where('date').equals(date).toArray()).filter(alive);
}

export function useSupplementLogs(date: DateKey): SupplementLog[] | undefined {
  return useLiveQuery(() => logsForDate(date), [date]);
}

/** The food the log entry is built from: nutrients are per dose, logged as 100 "grams" = 1 dose. */
function doseFood(s: Supplement): FoodItem {
  return { id: `supplement:${s.id}`, source: 'quick', name: `${s.name} (${s.dose} ${s.unit})`, per100: s.nutrients!, servings: [{ label: '1 dose', grams: 100 }] };
}

/** Tick or untick one dose. Returns true when the dose is now marked as taken. */
export async function toggleTaken(date: DateKey, s: Supplement, doseIndex = 0): Promise<boolean> {
  const existing = (await logsForDate(date)).find((l) => l.supplementId === s.id && l.doseIndex === doseIndex);
  if (existing) {
    const now = Date.now();
    await db.supplementLogs.update(existing.id, { deletedAt: now, updatedAt: now });
    if (existing.logEntryId) await deleteLogEntry(existing.logEntryId);
    return false;
  }
  let logEntryId: string | undefined;
  if (s.nutrients && s.nutrients.kcal > 0) {
    const settings = await getSettings();
    const snacks = Math.max(0, Math.min(3, settings.mealNames.length - 1));
    logEntryId = (await addLogEntry({ date, meal: snacks, food: doseFood(s), grams: 100, servingLabel: '1 dose' })).id;
  }
  await db.supplementLogs.put(newRecord({ date, supplementId: s.id, doseIndex, takenAt: Date.now(), logEntryId }) as SupplementLog);
  return true;
}

/** Share of scheduled doses taken over the `days` days ending on `endDate`, plus the current streak. */
export async function adherence(s: Supplement, endDate: DateKey, days = 30): Promise<{ pct: number; streak: number; byDay: Record<DateKey, number> }> {
  const start = addDays(endDate, -(days - 1));
  const logs = (await db.supplementLogs.where('date').between(start, endDate, true, true).toArray()).filter((l) => alive(l) && l.supplementId === s.id);
  const byDay: Record<DateKey, number> = {};
  for (const l of logs) byDay[l.date] = (byDay[l.date] ?? 0) + 1;
  const taken = Object.values(byDay).reduce((a, n) => a + Math.min(n, s.timesPerDay), 0);
  let streak = 0;
  // Today still counts as open: the streak runs through yesterday unless today is already complete.
  let d = (byDay[endDate] ?? 0) >= s.timesPerDay ? endDate : addDays(endDate, -1);
  while ((byDay[d] ?? 0) >= s.timesPerDay) { streak++; d = addDays(d, -1); }
  return { pct: Math.round((taken / (days * s.timesPerDay)) * 100), streak, byDay };
}
