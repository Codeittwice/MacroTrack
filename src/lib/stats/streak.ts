/**
 * Logging streak: consecutive days with entries, ending today (or yesterday if today
 * has no entry yet).
 */
import type { DateKey } from '@/db/types';
import { addDays } from '@/lib/utils/date';

/**
 * Consecutive days with entries ending today, or ending yesterday if today has none yet.
 * 0 otherwise. Input may be unsorted and contain duplicates.
 */
export function loggingStreak(datesWithEntries: DateKey[], today: DateKey): number {
  const dates = new Set(datesWithEntries);
  let anchor = today;
  if (!dates.has(anchor)) {
    anchor = addDays(today, -1);
    if (!dates.has(anchor)) return 0;
  }
  let count = 0;
  let d = anchor;
  while (dates.has(d)) {
    count++;
    d = addDays(d, -1);
  }
  return count;
}
