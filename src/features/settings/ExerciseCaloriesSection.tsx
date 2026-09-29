import { Segmented } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { Settings } from '@/db/types';
import { Section } from './Section';

const HELP: Record<Settings['exerciseCalories'], string> = {
  off: 'Recommended with coached targets. Your expenditure estimate already learns how much you burn, training included, so workouts are not counted twice.',
  half: 'Half of each workout’s estimated net burn is added to that day’s target as carbs. A middle ground if you want to eat more on training days.',
  full: 'The full estimated net burn is added to that day’s target. Burn estimates are rough, so this can slow fat loss; the weekly coach corrects over time.',
};

export function ExerciseCaloriesSection() {
  const settings = useSettings();
  const mode = settings.exerciseCalories ?? 'off';
  return (
    <Section title="Exercise calories">
      <div className="flex flex-col gap-3">
        <Segmented<Settings['exerciseCalories']>
          options={[{ value: 'off', label: 'Off' }, { value: 'half', label: 'Half' }, { value: 'full', label: 'Full' }]}
          value={mode}
          onChange={(exerciseCalories) => void updateSettings({ exerciseCalories })}
        />
        <p className="text-sm text-muted">{HELP[mode]}</p>
      </div>
    </Section>
  );
}
