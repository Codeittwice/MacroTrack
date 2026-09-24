import { Segmented } from '@/components/ui';
import { Section } from './Section';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';

export function UnitsSection() {
  const settings = useSettings();
  return (
    <Section title="Units">
      <div className="mb-4">
        <div className="mb-1.5 text-sm text-muted">Weight</div>
        <Segmented
          value={settings.weightUnit}
          onChange={(weightUnit) => updateSettings({ weightUnit })}
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
        />
      </div>
      <div>
        <div className="mb-1.5 text-sm text-muted">Energy</div>
        <Segmented
          value={settings.energyUnit}
          onChange={(energyUnit) => updateSettings({ energyUnit })}
          options={[{ value: 'kcal', label: 'kcal' }, { value: 'kJ', label: 'kJ' }]}
        />
      </div>
    </Section>
  );
}
