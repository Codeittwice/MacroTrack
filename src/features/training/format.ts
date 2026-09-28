import { fromDateKey } from '@/lib/utils/date';

export const fmtDate = (d: string) => fromDateKey(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export const fmtKg = (kg: number) => Math.round(kg).toLocaleString();

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
