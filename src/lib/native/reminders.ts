import type { Settings, Supplement } from '@/db/types';
import { isNativeApp } from './platform';

/** Supplement reminders use ids 200–249; they are all cancelled and rescheduled on every sync. */
const SUPPLEMENT_ID_BASE = 200;

interface Reminder { id: number; enabled: boolean; time: string; title: string; body: string; /** 0 = Sunday; omitted = daily */ weekday?: number }

export function remindersFor(s: Settings, checkInWeekday?: number, supplements: Supplement[] = []): Reminder[] {
  return [
    { id: 101, enabled: s.weighInReminderEnabled, time: s.weighInReminderTime, title: 'Time to weigh in', body: 'Step on the scale before breakfast to keep your trend accurate.' },
    { id: 102, enabled: s.logReminderEnabled, time: s.logReminderTime, title: 'Log today’s food', body: 'A complete log keeps your expenditure estimate on track.' },
    { id: 103, enabled: s.waterReminderEnabled, time: s.waterReminderTime, title: 'Drink some water', body: 'Check today’s water against your goal.' },
    { id: 104, enabled: s.checkInReminderEnabled && checkInWeekday !== undefined, time: s.checkInReminderTime, weekday: checkInWeekday, title: 'Weekly check-in ready', body: 'Review your trend and update this week’s targets.' },
    ...supplements
      .filter((sup) => sup.active && !sup.deletedAt && sup.reminderTime)
      .slice(0, 50)
      .map((sup, i) => ({ id: SUPPLEMENT_ID_BASE + i, enabled: true, time: sup.reminderTime!, title: `Time for your ${sup.name}`, body: `${sup.dose} ${sup.unit}. Tick it off in MacroTrack.` })),
  ];
}

export function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/**
 * Mirrors reminder settings into daily local notifications on Android. Returns false when the
 * user declined notification permission. The browser/desktop builds keep the in-app prompts.
 */
export async function syncNativeReminders(settings: Settings, checkInWeekday?: number, supplements: Supplement[] = []): Promise<boolean> {
  if (!isNativeApp()) return true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const all = remindersFor(settings, checkInWeekday, supplements);
  const stale = Array.from({ length: 50 }, (_, i) => SUPPLEMENT_ID_BASE + i);
  await LocalNotifications.cancel({ notifications: [...new Set([...all.map((r) => r.id), ...stale])].map((id) => ({ id })) });
  const active = all.filter((r) => r.enabled && parseTime(r.time));
  if (active.length === 0) return true;
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') ({ display } = await LocalNotifications.requestPermissions());
  if (display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: active.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { on: { ...parseTime(r.time)!, ...(r.weekday !== undefined ? { weekday: r.weekday + 1 } : {}) }, allowWhileIdle: true },
    })),
  });
  return true;
}
