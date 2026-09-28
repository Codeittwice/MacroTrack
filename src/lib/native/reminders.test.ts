import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/db/repo';
import { parseTime, remindersFor, syncNativeReminders } from './reminders';

describe('reminders', () => {
  it('parses HH:MM and rejects invalid times', () => {
    expect(parseTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('maps settings to stable notification ids', () => {
    const list = remindersFor({ ...DEFAULT_SETTINGS, weighInReminderEnabled: true });
    expect(list.map((r) => r.id)).toEqual([101, 102, 103, 104]);
    expect(remindersFor({ ...DEFAULT_SETTINGS, checkInReminderEnabled: true }, 1).find((r) => r.id === 104)).toMatchObject({ enabled: true, weekday: 1 });
    expect(remindersFor({ ...DEFAULT_SETTINGS, checkInReminderEnabled: true }).find((r) => r.id === 104)?.enabled).toBe(false);
    expect(list.find((r) => r.id === 101)).toMatchObject({ enabled: true, time: '07:30' });
  });

  it('is a no-op outside the Android app', async () => {
    await expect(syncNativeReminders({ ...DEFAULT_SETTINGS, logReminderEnabled: true })).resolves.toBe(true);
  });
});

describe('supplement reminders', () => {
  it('adds one daily reminder per active supplement with a time', () => {
    const sup = (name: string, reminderTime?: string, active = true) => ({ id: name, updatedAt: 0, name, dose: 5, unit: 'g', timesPerDay: 1, active, reminderTime });
    const list = remindersFor(DEFAULT_SETTINGS, undefined, [sup('Creatine', '08:00'), sup('Magnesium'), sup('Old', '09:00', false)]);
    const s = list.filter((r) => r.id >= 200);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: 200, enabled: true, time: '08:00', title: 'Time for your Creatine' });
  });
});
