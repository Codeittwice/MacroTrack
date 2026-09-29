import { useEffect, useState } from 'react';
import { Button, Label, NumberInput } from '@/components/ui';
import { Section } from './Section';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import { validateWaterGoalMl } from './helpers';

export function WaterSection() {
  const settings = useSettings();
  const [value, setValue] = useState<number | undefined>(settings.waterGoalMl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(settings.waterGoalMl), [settings.waterGoalMl]);

  function commit() {
    if (value === undefined || !validateWaterGoalMl(value)) {
      setError('Enter a goal between 250 and 10,000 ml.');
      return;
    }
    setError(null);
    updateSettings({ waterGoalMl: value });
  }

  return (
    <Section title="Water goal">
      <Label>Daily goal</Label>
      <div className="flex items-center gap-3">
        <NumberInput value={value} onValue={setValue} onBlur={commit} suffix="ml" className="max-w-[160px]" />
        <Button onClick={commit}>Save</Button>
      </div>
      {error && <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Section>
  );
}
