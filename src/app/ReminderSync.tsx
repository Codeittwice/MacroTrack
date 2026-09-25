import { useEffect } from 'react';
import { useProfile, useSettings } from './hooks';
import { syncNativeReminders } from '@/lib/native/reminders';

/** Keeps Android's scheduled notifications in step with the reminder settings. */
export function ReminderSync() {
  const s = useSettings();
  const weekday = useProfile()?.checkInWeekday;
  const key = [s.weighInReminderEnabled, s.weighInReminderTime, s.logReminderEnabled, s.logReminderTime, s.waterReminderEnabled, s.waterReminderTime, s.checkInReminderEnabled, s.checkInReminderTime, weekday].join('|');
  useEffect(() => {
    if (!s.updatedAt) return; // defaults not yet loaded or never saved
    void syncNativeReminders(s, weekday).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when a reminder changes
  }, [key, !!s.updatedAt]);
  return null;
}
