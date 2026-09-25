import { Label, NumberInput, RangePicker } from '@/components/ui';
import { Info } from 'lucide-react';
import type { WizardData } from '../wizardState';
import { bodyFatErrorMsg, weightErrorMsg } from '../validation';

export default function CurrentWeight({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  const weightErr = weightErrorMsg(data.weightKg);
  const bfErr = bodyFatErrorMsg(data.bodyFatPct);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Current weight</h2>
        <p className="text-sm text-muted">This becomes your first weigh-in.</p>
      </div>

      <div>
        <Label hint={weightErr ? <span style={{ color: 'var(--danger)' }}>{weightErr}</span> : undefined}>Weight</Label>
        <RangePicker
          value={data.weightKg}
          onValue={(weightKg) => onChange({ weightKg })}
          min={30}
          max={300}
          step={0.5}
          suggestedValue={75}
          suffix="kg"
          label="Weight"
        />
      </div>

      <div>
        <Label hint={bfErr ? <span style={{ color: 'var(--danger)' }}>{bfErr}</span> : 'optional'}>Body fat %</Label>
        <NumberInput value={data.bodyFatPct} onValue={(v) => onChange({ bodyFatPct: v })} suffix="%" placeholder="e.g. 20" />
      </div>

      <div className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" />
        <p>
          Entering your body fat percentage lets us use the Katch-McArdle formula, which is based on lean
          mass and tends to be more accurate for lean or muscular people. Leave it blank if you're not sure.
        </p>
      </div>
    </div>
  );
}
