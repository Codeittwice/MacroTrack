import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/db/repo';
import { oneShotsFor, parseTime, remindersFor, syncNativeReminders } from './reminders';

describe('reminders', () => {
  it('parses HH:MM and rejects invalid times', () => {
    expect(parseTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('maps settings to stable notification ids', () => {
    const list = remindersFor({ ...DEFAULT_SETTINGS, weighInReminderEnabled: true });
    expect(list.map((r) => r.id)).toEqual([101, 102, 103, 104, 110, 111, 112, 113, 114, 115, 116]);
    expect(remindersFor({ ...DEFAULT_SETTINGS, checkInReminderEnabled: true }, 1).find((r) => r.id === 104)).toMatchObject({ enabled: true, weekday: 1 });
    expect(remindersFor({ ...DEFAULT_SETTINGS, checkInReminderEnabled: true }).find((r) => r.id === 104)?.enabled).toBe(false);
    expect(list.find((r) => r.id === 101)).toMatchObject({ enabled: true, time: '07:30' });
  });

  it('is a no-op outside the Android app', async () => {
    await expect(syncNativeReminders({ ...DEFAULT_SETTINGS, logReminderEnabled: true })).resolves.toBe(true);
  });
});

describe('training and conditional reminders', () => {
  it('fires training reminders on the chosen weekdays only', () => {
    const list = remindersFor({ ...DEFAULT_SETTINGS, trainingReminderEnabled: true, trainingReminderTime: '17:30', trainingDays: [1, 4] });
    expect(list.filter((r) => r.id >= 110 && r.id <= 116 && r.enabled).map((r) => r.weekday)).toEqual([1, 4]);
  });

  it('skips today’s nudge for a meal that is already logged, and schedules the next days', () => {
    const now = new Date(2026, 8, 30, 9, 0);
    const shots = oneShotsFor({ ...DEFAULT_SETTINGS, mealNudgesEnabled: true }, { today: '2026-09-30', loggedMeals: [0], now });
    const today = shots.filter((s) => s.id < 310);
    expect(today.map((s) => s.id)).toEqual([301, 302, 303]); // breakfast (300) is logged
    expect(shots.filter((s) => s.id === 310)).toHaveLength(1); // tomorrow's breakfast still comes
    expect(shots.every((s) => s.at > now)).toBe(true);
    expect(today[0]).toMatchObject({ title: 'Log your lunch' });
  });

  it('warns about leftovers three days after cooking', () => {
    const shots = oneShotsFor({ ...DEFAULT_SETTINGS, leftoverReminderEnabled: true }, {
      today: '2026-09-30', now: new Date(2026, 8, 30, 9, 0), leftovers: [{ name: 'Protein mash', cookedOn: '2026-09-29', portionsLeft: 2.5 }, { name: 'Old chili', cookedOn: '2026-09-20', portionsLeft: 1 }],
    });
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ id: 400, title: 'Protein mash: 2.5 portions left' });
    expect(shots[0].at.getDate()).toBe(2);
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
