/**
 * Food-log read API (contract, Wave 2). Dashboard/Progress/Coach import these; W5 owns lib/log and
 * adds mutations in lib/log/actions.ts. Signatures here are stable.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { DateKey, LogEntry, Nutrients } from '@/db/types';
import { sum, ZERO } from '@/lib/utils/nutrients';

export async function getDayEntries(date: DateKey): Promise<LogEntry[]> {
  return (await db.logEntries.where('date').equals(date).toArray())
    .filter(alive)
    .sort((a, b) => a.meal - b.meal || a.loggedAt - b.loggedAt);
}

export function useDayEntries(date: DateKey): LogEntry[] | undefined {
  return useLiveQuery(() => getDayEntries(date), [date]);
}

export function useDayTotals(date: DateKey): Nutrients {
  const entries = useDayEntries(date);
  return entries ? sum(entries.map((e) => e.nutrients)) : ZERO;
}

/** Daily kcal totals for dates in [from, to]; days without entries are omitted. */
export async function getDailyIntake(from: DateKey, to: DateKey): Promise<{ date: DateKey; kcal: number; nutrients: Nutrients }[]> {
  const rows = (await db.logEntries.where('date').between(from, to, true, true).toArray()).filter(alive);
  const byDay = new Map<DateKey, Nutrients[]>();
  for (const r of rows) {
    const a = byDay.get(r.date) ?? [];
    a.push(r.nutrients);
    byDay.set(r.date, a);
  }
  const incomplete = new Set(
    (await db.notes.where('date').between(from, to, true, true).toArray()).filter((n) => alive(n) && n.incomplete).map((n) => n.date),
  );
  return [...byDay.entries()]
    .filter(([d]) => !incomplete.has(d))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const nutrients = sum(list);
      return { date, kcal: nutrients.kcal, nutrients };
    });
}
