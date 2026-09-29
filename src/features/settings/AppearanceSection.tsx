import './settings.css';
import { clsx } from 'clsx';
import { Segmented } from '@/components/ui';
import { Section } from './Section';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { Accent, ThemeMode } from '@/db/types';

const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: 'green', label: 'Green', swatch: 'swatch-green' },
  { value: 'ocean', label: 'Ocean', swatch: 'swatch-ocean' },
  { value: 'sunset', label: 'Sunset', swatch: 'swatch-sunset' },
];

export function AppearanceSection() {
  const settings = useSettings();
  return (
    <Section title="Appearance">
      <div className="mb-4">
        <div className="mb-1.5 text-sm text-muted">Theme</div>
        <Segmented<ThemeMode>
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
        />
      </div>
      <div>
        <div className="mb-1.5 text-sm text-muted">Accent colour</div>
        <div className="flex gap-4">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => updateSettings({ accent: a.value })}
              className="flex flex-col items-center gap-1"
              aria-label={a.label}
              aria-pressed={settings.accent === a.value}
            >
              <span
                className={clsx('h-9 w-9 rounded-full', a.swatch)}
                style={settings.accent === a.value ? { boxShadow: '0 0 0 3px var(--primary)', outlineOffset: 2 } : undefined}
              />
              <span className="text-xs text-muted">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
