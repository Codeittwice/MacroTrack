import { cx } from '@/components/ui';
import { WEEKDAY_OPTIONS } from '../options';
import type { WizardData } from '../wizardState';

export default function CheckInDay({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Weekly check-in</h2>
        <p className="text-sm text-muted">Pick the day we review your progress and update your targets.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {WEEKDAY_OPTIONS.map((o) => {
          const selected = data.checkInWeekday === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange({ checkInWeekday: o.value })}
              className={cx(
                'min-h-[48px] rounded-2xl border px-4 text-left font-medium transition',
                selected ? 'border-primary bg-primary/10 text-text' : 'border-border bg-surface text-text hover:border-muted',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
