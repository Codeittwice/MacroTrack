import { cx } from '@/components/ui';
import { DIET_OPTIONS } from '../options';
import type { WizardData } from '../wizardState';

export default function Diet({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Diet preference</h2>
        <p className="text-sm text-muted">This shapes how your calories are split into protein, carbs and fat.</p>
      </div>

      <div className="flex flex-col gap-2">
        {DIET_OPTIONS.map((o) => {
          const selected = data.diet === o.value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange({ diet: o.value })}
              aria-pressed={selected}
              className={cx(
                'min-h-[56px] rounded-2xl border bg-surface p-4 text-left transition',
                selected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted',
              )}
            >
              <div className="font-medium">{o.label}</div>
              <div className="text-sm text-muted">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
