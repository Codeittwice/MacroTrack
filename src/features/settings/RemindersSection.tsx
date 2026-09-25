import { useState } from 'react';
import { Input } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { Settings } from '@/db/types';
import { isNativeApp } from '@/lib/native/platform';
import { syncNativeReminders } from '@/lib/native/reminders';
import { Section } from './Section';

type Pair = { enabled: keyof Settings; time: keyof Settings; title: string; hint: string; timeLabel: string };

const REMINDERS: Pair[] = [
  { enabled: 'weighInReminderEnabled', time: 'weighInReminderTime', title: 'Weigh-in reminder', hint: 'Daily nudge to weigh in, ideally after waking up.', timeLabel: 'Remind me at' },
  { enabled: 'logReminderEnabled', time: 'logReminderTime', title: 'Food log reminder', hint: 'Evening nudge to finish today’s food log.', timeLabel: 'Remind me at' },
  { enabled: 'waterReminderEnabled', time: 'waterReminderTime', title: 'Water reminder', hint: 'Prompt when today is below your water goal.', timeLabel: 'Remind me after' },
];

export function RemindersSection() {
  const settings = useSettings();
  const [denied, setDenied] = useState(false);
  const native = isNativeApp();

  const update = async (patch: Partial<Settings>) => {
    await updateSettings(patch);
    if (native) setDenied(!(await syncNativeReminders({ ...settings, ...patch })));
  };

  return (
    <Section title="Reminders">
      <div className="flex flex-col gap-5">
        {REMINDERS.map((r) => {
          const enabled = settings[r.enabled] as boolean;
          return (
            <div key={r.title}>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span><span className="block font-medium">{r.title}</span><span className="block text-sm text-muted">{r.hint}</span></span>
                <input aria-label={`Enable ${r.title.toLowerCase()}`} type="checkbox" checked={enabled} onChange={(event) => void update({ [r.enabled]: event.target.checked })} className="h-5 w-5 accent-[var(--primary)]" />
              </label>
              {enabled && (
                <div className="mt-3 max-w-[180px]">
                  <div className="mb-1.5 text-sm text-muted">{r.timeLabel}</div>
                  <Input aria-label={`${r.title} time`} type="time" value={settings[r.time] as string} onChange={(event) => void update({ [r.time]: event.target.value })} />
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted">
          {native
            ? 'Reminders arrive as notifications, even when the app is closed.'
            : 'In the browser and desktop app, reminders show on the dashboard. Install the Android app for notifications.'}
        </p>
        {denied && <p className="text-sm" style={{ color: 'var(--danger)' }}>Notifications are turned off for MacroTrack. Allow them in Android settings to get reminders.</p>}
      </div>
    </Section>
  );
}
