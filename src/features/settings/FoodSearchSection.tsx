import { Segmented } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { Settings } from '@/db/types';
import { Section } from './Section';

/** Food name language, and which country's branded products (Open Food Facts) appear in search. */
export function FoodSearchSection() {
  const settings = useSettings();
  return (
    <Section title="Food search">
      <div className="flex flex-col gap-3">
        <div className="text-sm text-muted">Food names</div>
        <div role="group" aria-label="Food names">
          <Segmented<Settings['foodNames']>
            options={[{ value: 'en', label: 'English' }, { value: 'nl', label: 'Nederlands' }, { value: 'both', label: 'Both' }]}
            value={settings.foodNames ?? 'en'}
            onChange={(foodNames) => void updateSettings({ foodNames, foodNamesChosen: true })}
          />
        </div>
        <p className="text-sm text-muted">"Both" shows the English name with the Dutch one underneath. All NEVO foods have both; supermarket products show English only when Open Food Facts has it.</p>
        <div className="text-sm text-muted">Supermarket products from</div>
        <Segmented<Settings['productRegion']>
          options={[{ value: 'nl', label: 'Netherlands' }, { value: 'bg', label: 'Bulgaria' }, { value: 'both', label: 'Both' }]}
          value={settings.productRegion ?? 'nl'}
          onChange={(productRegion) => void updateSettings({ productRegion })}
        />
        <p className="text-sm text-muted">Branded products come from Open Food Facts (free, open data). Generic foods always come from the Dutch NEVO table; Bulgarian descriptions are translated to English first, so they still match.</p>
      </div>
    </Section>
  );
}
