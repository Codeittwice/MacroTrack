import type { DateKey, Settings, Supplement } from '@/db/types';
import { addDays, fromDateKey } from '@/lib/utils/date';
import { isNativeApp } from './platform';

/**
 * Notification id ranges (all cancelled and rescheduled on every sync):
 * 101–104 daily/weekly basics · 110–116 training weekdays · 200–249 supplements ·
 * 300–339 meal nudges (one-shot, day offset × 10 + meal) · 400–419 leftovers (one-shot).
 */
const SUPPLEMENT_ID_BASE = 200;
const TRAINING_ID_BASE = 110;
const MEAL_NUDGE_ID_BASE = 300;
const LEFTOVER_ID_BASE = 400;
/** Meal nudges are scheduled this many days ahead, so they keep coming if the app isn't opened daily. */
const NUDGE_DAYS = 3;
/** A meal prep is flagged this many days after cooking (common fridge guidance is 3–4 days). */
const LEFTOVER_DAYS = 3;

export const DEFAULT_MEAL_NUDGE_TIMES = ['10:00', '14:00', '20:00', '16:30'];

interface Reminder { id: number; enabled: boolean; time: string; title: string; body: string; /** 0 = Sunday; omitted = daily */ weekday?: number }

/** A one-off notification at a set moment. */
export interface OneShot { id: number; at: Date; title: string; body: string }

export interface ReminderContext {
  checkInWeekday?: number;
  supplements?: Supplement[];
  /** today's date and the meal indexes that already have food logged */
  today?: DateKey;
  loggedMeals?: number[];
  /** open meal preps */
  leftovers?: { name: string; cookedOn: DateKey; portionsLeft: number }[];
  now?: Date;
}

export function remindersFor(s: Settings, checkInWeekday?: number, supplements: Supplement[] = []): Reminder[] {
  const trainingOn = !!s.trainingReminderEnabled && !!s.trainingReminderTime;
  return [
    { id: 101, enabled: s.weighInReminderEnabled, time: s.weighInReminderTime, title: 'Time to weigh in', body: 'Step on the scale before breakfast to keep your trend accurate.' },
    { id: 102, enabled: s.logReminderEnabled, time: s.logReminderTime, title: 'Log today’s food', body: 'A complete log keeps your expenditure estimate on track.' },
    { id: 103, enabled: s.waterReminderEnabled, time: s.waterReminderTime, title: 'Drink some water', body: 'Check today’s water against your goal.' },
    { id: 104, enabled: s.checkInReminderEnabled && checkInWeekday !== undefined, time: s.checkInReminderTime, weekday: checkInWeekday, title: 'Weekly check-in ready', body: 'Review your trend and update this week’s targets.' },
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      id: TRAINING_ID_BASE + day,
      enabled: trainingOn && (s.trainingDays ?? []).includes(day),
      time: s.trainingReminderTime ?? '',
      weekday: day,
      title: 'Training day',
      body: 'Your workout is planned for today. Open Training to start it.',
    })),
    ...supplements
      .filter((sup) => sup.active && !sup.deletedAt && sup.reminderTime)
      .slice(0, 50)
      .map((sup, i) => ({ id: SUPPLEMENT_ID_BASE + i, enabled: true, time: sup.reminderTime!, title: `Time for your ${sup.name}`, body: `${sup.dose} ${sup.unit}. Tick it off in MacroTrack.` })),
  ];
}

function at(date: DateKey, time: string): Date | null {
  const t = parseTime(time);
  if (!t) return null;
  const d = fromDateKey(date);
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

/**
 * Conditional notifications, which Android can't express as repeating ones: meal nudges for the next
 * few days (today's skipped for meals already logged) and a nudge about leftovers getting old.
 */
export function oneShotsFor(s: Settings, ctx: ReminderContext): OneShot[] {
  const today = ctx.today;
  const now = ctx.now ?? new Date();
  if (!today) return [];
  const out: OneShot[] = [];
  if (s.mealNudgesEnabled) {
    const logged = new Set(ctx.loggedMeals ?? []);
    s.mealNames.slice(0, 10).forEach((meal, m) => {
      const time = s.mealNudgeTimes?.[m] ?? DEFAULT_MEAL_NUDGE_TIMES[m];
      if (!time) return;
      for (let day = 0; day < NUDGE_DAYS; day++) {
        if (day === 0 && logged.has(m)) continue;
        const when = at(addDays(today, day), time);
        if (when && when > now) out.push({ id: MEAL_NUDGE_ID_BASE + day * 10 + m, at: when, title: `Log your ${meal.toLowerCase()}`, body: `Nothing logged for ${meal.toLowerCase()} yet. It takes a few seconds with a photo or your voice.` });
      }
    });
  }
  if (s.leftoverReminderEnabled) {
    (ctx.leftovers ?? []).slice(0, 20).forEach((l, i) => {
      const when = at(addDays(l.cookedOn, LEFTOVER_DAYS), '12:00');
      if (!when) return;
      const moment = when > now ? when : null;
      if (!moment) return;
      const portions = Math.round(l.portionsLeft * 2) / 2;
      out.push({ id: LEFTOVER_ID_BASE + i, at: moment, title: `${l.name}: ${portions} portion${portions === 1 ? '' : 's'} left`, body: `Cooked ${LEFTOVER_DAYS} days ago. Eat it today, freeze it, or mark it finished in MacroTrack.` });
    });
  }
  return out;
}

export function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Asks for notification permission (Android 13+). Scheduling itself is left to ReminderSync. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') ({ display } = await LocalNotifications.requestPermissions());
  return display === 'granted';
}

const range = (base: number, n: number) => Array.from({ length: n }, (_, i) => base + i);
const ALL_MANAGED_IDS = [101, 102, 103, 104, ...range(TRAINING_ID_BASE, 7), ...range(SUPPLEMENT_ID_BASE, 50), ...range(MEAL_NUDGE_ID_BASE, 40), ...range(LEFTOVER_ID_BASE, 20)];

/**
 * Mirrors reminder settings into local notifications on Android. Returns false when the user
 * declined notification permission (Android 13+ asks at runtime). Browser/desktop builds keep the
 * in-app prompts.
 */
export async function syncNativeReminders(settings: Settings, checkInWeekday?: number, supplements: Supplement[] = [], ctx: ReminderContext = {}): Promise<boolean> {
  if (!isNativeApp()) return true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const repeating = remindersFor(settings, checkInWeekday, supplements).filter((r) => r.enabled && parseTime(r.time));
  const oneShots = oneShotsFor(settings, ctx);
  await LocalNotifications.cancel({ notifications: ALL_MANAGED_IDS.map((id) => ({ id })) });
  if (repeating.length === 0 && oneShots.length === 0) return true;
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') ({ display } = await LocalNotifications.requestPermissions());
  if (display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: [
      ...repeating.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { on: { ...parseTime(r.time)!, ...(r.weekday !== undefined ? { weekday: r.weekday + 1 } : {}) }, allowWhileIdle: true },
      })),
      ...oneShots.map((o) => ({ id: o.id, title: o.title, body: o.body, schedule: { at: o.at, allowWhileIdle: true } })),
    ],
  });
  return true;
}
