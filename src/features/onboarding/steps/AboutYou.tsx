import { Label, Segmented, NumberInput, Input } from '@/components/ui';
import type { WizardData } from '../wizardState';
import { cmToFtIn } from '../wizardState';
import { ageErrorMsg, heightErrorMsg } from '../validation';
import type { Sex } from '@/db/types';

export default function AboutYou({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  const heightErr = heightErrorMsg(data.heightCm);
  const ageErr = ageErrorMsg(data.birthDate);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 text-xl font-semibold">About you</h2>
        <p className="text-sm text-muted">We use this to estimate your calorie needs.</p>
      </div>

      <div>
        <Label>Sex</Label>
        <Segmented<Sex>
          value={data.sex ?? 'male'}
          onChange={(v) => onChange({ sex: v })}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
        />
      </div>

      <div>
        <Label hint={ageErr ? <span style={{ color: 'var(--danger)' }}>{ageErr}</span> : undefined}>Birth date</Label>
        <Input
          type="date"
          value={data.birthDate ?? ''}
          onChange={(e) => onChange({ birthDate: e.target.value || undefined })}
        />
      </div>

      <div>
        <Label hint={heightErr ? <span style={{ color: 'var(--danger)' }}>{heightErr}</span> : (data.heightCm ? `≈ ${cmToFtIn(data.heightCm)}` : undefined)}>
          Height
        </Label>
        <NumberInput value={data.heightCm} onValue={(v) => onChange({ heightCm: v })} suffix="cm" placeholder="e.g. 175" />
      </div>
    </div>
  );
}
