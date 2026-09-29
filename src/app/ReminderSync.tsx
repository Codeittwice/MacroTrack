import { useEffect } from 'react';
import { useProfile, useSettings } from './hooks';
import { syncNativeReminders } from '@/lib/native/reminders';
import { useSupplements } from '@/lib/supplements/actions';

/** Keeps Android's scheduled notifications in step with the reminder settings. */
export function ReminderSync() {
  const s = useSettings();
  const weekday = useProfile()?.checkInWeekday;
  const supplements = useSupplements();
  const supKey = (supplements ?? []).map((x) => `${x.id}:${x.name}:${x.reminderTime ?? ''}:${x.active}`).join(',');
  const key = [s.weighInReminderEnabled, s.weighInReminderTime, s.logReminderEnabled, s.logReminderTime, s.waterReminderEnabled, s.waterReminderTime, s.checkInReminderEnabled, s.checkInReminderTime, weekday, supKey].join('|');
  useEffect(() => {
    if (!s.updatedAt && !supKey) return; // nothing configured yet
    void syncNativeReminders(s, weekday, supplements ?? []).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when a reminder changes
  }, [key, !!s.updatedAt]);
  return null;
}
