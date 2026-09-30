import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Input } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { Settings } from '@/db/types';
import { isNativeApp } from '@/lib/native/platform';
import { DEFAULT_MEAL_NUDGE_TIMES, ensureNotificationPermission } from '@/lib/native/reminders';
import { Section } from './Section';

type Pair = { enabled: keyof Settings; time: keyof Settings; title: string; hint: string; timeLabel: string };

const REMINDERS: Pair[] = [
  { enabled: 'weighInReminderEnabled', time: 'weighInReminderTime', title: 'Weigh-in reminder', hint: 'Daily nudge to weigh in, ideally after waking up.', timeLabel: 'Remind me at' },
  { enabled: 'logReminderEnabled', time: 'logReminderTime', title: 'Food log reminder', hint: 'Evening nudge to finish today’s food log.', timeLabel: 'Remind me at' },
  { enabled: 'checkInReminderEnabled', time: 'checkInReminderTime', title: 'Check-in reminder', hint: 'On your weekly check-in day, to review your trend and targets.', timeLabel: 'Remind me at' },
  { enabled: 'waterReminderEnabled', time: 'waterReminderTime', title: 'Water reminder', hint: 'Prompt when today is below your water goal.', timeLabel: 'Remind me after' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday first, as most training plans are written. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Toggle({ title, hint, checked, onChange, children }: { title: string; hint: string; checked: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span><span className="block font-medium">{title}</span><span className="block text-sm text-muted">{hint}</span></span>
        <input aria-label={`Enable ${title.toLowerCase()}`} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
      </label>
      {checked && children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function RemindersSection() {
  const settings = useSettings();
  const [denied, setDenied] = useState(false);
  const native = isNativeApp();

  const update = async (patch: Partial<Settings>) => {
    await updateSettings(patch);
    // ReminderSync reschedules everything; here we only need to ask for permission when turning one on.
    if (native && Object.values(patch).some((v) => v === true)) setDenied(!(await ensureNotificationPermission()));
  };

  const trainingDays = settings.trainingDays ?? [];
  const nudgeTimes = settings.mealNames.map((_, i) => settings.mealNudgeTimes?.[i] ?? DEFAULT_MEAL_NUDGE_TIMES[i] ?? '12:00');

  return (
    <Section title="Reminders">
      <div className="flex flex-col gap-5">
        {REMINDERS.map((r) => (
          <Toggle key={r.title} title={r.title} hint={r.hint} checked={settings[r.enabled] as boolean} onChange={(on) => void update({ [r.enabled]: on })}>
            <div className="max-w-[180px]">
              <div className="mb-1.5 text-sm text-muted">{r.timeLabel}</div>
              <Input aria-label={`${r.title} time`} type="time" value={settings[r.time] as string} onChange={(event) => void update({ [r.time]: event.target.value })} />
            </div>
          </Toggle>
        ))}

        <Toggle title="Training days" hint="A reminder on the days you plan to train." checked={!!settings.trainingReminderEnabled} onChange={(on) => void update({ trainingReminderEnabled: on, trainingReminderTime: settings.trainingReminderTime ?? '17:30', trainingDays: settings.trainingDays ?? [1, 3, 5] })}>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Training days">
            {WEEK_ORDER.map((d) => {
              const on = trainingDays.includes(d);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => void update({ trainingDays: on ? trainingDays.filter((x) => x !== d) : [...trainingDays, d].sort() })}
                  className={clsx('h-9 w-11 rounded-lg text-sm', on ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted')}>
                  {WEEKDAYS[d]}
                </button>
              );
            })}
          </div>
          <div className="max-w-[180px]">
            <div className="mb-1.5 text-sm text-muted">Remind me at</div>
            <Input aria-label="Training reminder time" type="time" value={settings.trainingReminderTime ?? '17:30'} onChange={(event) => void update({ trainingReminderTime: event.target.value })} />
          </div>
        </Toggle>

        <Toggle title="Meal nudges" hint="Only when that meal has nothing logged yet." checked={!!settings.mealNudgesEnabled} onChange={(on) => void update({ mealNudgesEnabled: on })}>
          <div className="grid grid-cols-2 gap-3">
            {settings.mealNames.map((meal, i) => (
              <div key={meal}>
                <div className="mb-1.5 text-sm text-muted">{meal}</div>
                <Input aria-label={`${meal} nudge time`} type="time" value={nudgeTimes[i]} onChange={(event) => void update({ mealNudgeTimes: nudgeTimes.map((t, j) => (j === i ? event.target.value : t)) })} />
              </div>
            ))}
          </div>
        </Toggle>

        <Toggle title="Leftovers" hint="When a meal prep is 3 days old and still has portions left." checked={!!settings.leftoverReminderEnabled} onChange={(on) => void update({ leftoverReminderEnabled: on })} />

        <p className="text-sm text-muted">Supplement reminders are set per supplement on the <Link to="/supplements" className="text-primary">Supplements</Link> page.</p>
        <p className="text-xs text-muted">
          {native
            ? 'Reminders arrive as notifications, even when the app is closed.'
            : 'In the browser and desktop app, reminders show on the dashboard. Install the Android app for notifications.'}
        </p>
        {denied && <p className="text-sm text-danger">Notifications are turned off for MacroTrack. Allow them in Android settings to get reminders.</p>}
      </div>
    </Section>
  );
}
