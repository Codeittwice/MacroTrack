import { describe, expect, it } from 'vitest';
import { isWaterReminderDue } from './water';

describe('isWaterReminderDue', () => {
  it('shows after the selected time when water is below the goal', () => {
    expect(isWaterReminderDue({ enabled: true, reminderTime: '20:00', currentMl: 1700, goalMl: 2500, now: new Date(2026, 8, 24, 20, 1) })).toBe(true);
  });

  it('does not show before the reminder time, when disabled, or after the goal', () => {
    expect(isWaterReminderDue({ enabled: true, reminderTime: '20:00', currentMl: 1700, goalMl: 2500, now: new Date(2026, 8, 24, 19, 59) })).toBe(false);
    expect(isWaterReminderDue({ enabled: false, reminderTime: '20:00', currentMl: 1700, goalMl: 2500 })).toBe(false);
    expect(isWaterReminderDue({ enabled: true, reminderTime: '20:00', currentMl: 2500, goalMl: 2500 })).toBe(false);
  });
});
