import { useEffect } from 'react';
import { useSettings } from './hooks';
import { syncNativeReminders } from '@/lib/native/reminders';

/** Keeps Android's scheduled notifications in step with the reminder settings. */
export function ReminderSync() {
  const s = useSettings();
  const key = [s.weighInReminderEnabled, s.weighInReminderTime, s.logReminderEnabled, s.logReminderTime, s.waterReminderEnabled, s.waterReminderTime].join('|');
  useEffect(() => {
    if (!s.updatedAt) return; // defaults not yet loaded or never saved
    void syncNativeReminders(s).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when a reminder changes
  }, [key, !!s.updatedAt]);
  return null;
}
