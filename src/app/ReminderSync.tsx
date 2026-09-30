import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import { useProfile, useSettings } from './hooks';
import { syncNativeReminders } from '@/lib/native/reminders';
import { useSupplements } from '@/lib/supplements/actions';
import { useLeftovers } from '@/lib/batches/actions';
import { today as todayFn } from '@/lib/utils/date';

/**
 * Keeps Android's scheduled notifications in step with the reminder settings. It also reschedules
 * when today's log or the leftovers change, because meal nudges skip meals already logged.
 */
export function ReminderSync() {
  const s = useSettings();
  const weekday = useProfile()?.checkInWeekday;
  const supplements = useSupplements();
  const today = todayFn();
  const loggedMeals = useLiveQuery(async () => [...new Set((await db.logEntries.where('date').equals(today).toArray()).filter(alive).map((e) => e.meal))].sort(), [today]);
  const leftovers = useLeftovers();
  const supKey = (supplements ?? []).map((x) => `${x.id}:${x.name}:${x.reminderTime ?? ''}:${x.active}`).join(',');
  const leftKey = (leftovers ?? []).map((l) => `${l.batch.id}:${l.batch.cookedOn}:${Math.round(l.remainingPortions * 2)}`).join(',');
  const key = [
    s.weighInReminderEnabled, s.weighInReminderTime, s.logReminderEnabled, s.logReminderTime, s.waterReminderEnabled, s.waterReminderTime, s.checkInReminderEnabled, s.checkInReminderTime,
    s.trainingReminderEnabled, s.trainingReminderTime, (s.trainingDays ?? []).join(''), s.mealNudgesEnabled, (s.mealNudgeTimes ?? []).join(','), s.mealNames.join(','), s.leftoverReminderEnabled,
    weekday, supKey, today, (loggedMeals ?? []).join(','), leftKey,
  ].join('|');
  useEffect(() => {
    if (!s.updatedAt && !supKey) return; // nothing configured yet
    void syncNativeReminders(s, weekday, supplements ?? [], {
      today,
      loggedMeals,
      leftovers: (leftovers ?? []).map((l) => ({ name: l.batch.name, cookedOn: l.batch.cookedOn, portionsLeft: l.remainingPortions })),
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when a reminder input changes
  }, [key, !!s.updatedAt]);
  return null;
}
