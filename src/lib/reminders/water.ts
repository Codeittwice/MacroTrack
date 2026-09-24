export function isWaterReminderDue({
  enabled,
  reminderTime,
  currentMl,
  goalMl,
  now = new Date(),
}: {
  enabled: boolean;
  reminderTime: string;
  currentMl: number;
  goalMl: number;
  now?: Date;
}): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(reminderTime);
  if (!enabled || !match || currentMl >= goalMl || goalMl <= 0) return false;
  const reminderMinutes = Number(match[1]) * 60 + Number(match[2]);
  if (reminderMinutes > 1_439) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= reminderMinutes;
}
