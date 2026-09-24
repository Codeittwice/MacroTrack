import { Input } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import { Section } from './Section';

export function RemindersSection() {
  const settings = useSettings();
  return (
    <Section title="Reminders">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span><span className="block font-medium">Water reminder</span><span className="block text-sm text-muted">Show a dashboard prompt when today is below your goal.</span></span>
        <input aria-label="Enable water reminder" type="checkbox" checked={settings.waterReminderEnabled} onChange={(event) => void updateSettings({ waterReminderEnabled: event.target.checked })} className="h-5 w-5 accent-[var(--primary)]" />
      </label>
      {settings.waterReminderEnabled && <div className="mt-4 max-w-[180px]"><div className="mb-1.5 text-sm text-muted">Remind me after</div><Input aria-label="Water reminder time" type="time" value={settings.waterReminderTime} onChange={(event) => void updateSettings({ waterReminderTime: event.target.value })} /></div>}
    </Section>
  );
}
