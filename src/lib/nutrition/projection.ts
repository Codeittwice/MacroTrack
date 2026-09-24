import type { DateKey } from '@/db/types';
import { addDays } from '@/lib/utils/date';

/** Date the trend reaches goalKg at weeklyRateKg, or null if moving away / flat / invalid. */
export function projectGoalDate(currentKg: number, goalKg: number, weeklyRateKg: number, from: DateKey): DateKey | null {
  if (!Number.isFinite(currentKg) || !Number.isFinite(goalKg) || !Number.isFinite(weeklyRateKg)) return null;
  const diff = goalKg - currentKg;
  if (Math.abs(diff) < 0.05) return from;
  if (weeklyRateKg === 0 || Math.sign(diff) !== Math.sign(weeklyRateKg)) return null;
  const days = Math.ceil((diff / weeklyRateKg) * 7);
  return days > 3650 ? null : addDays(from, days);
}
