import { Section } from './Section';
import { APP_VERSION } from './version';

export function AboutSection() {
  return (
    <Section title="About">
      <div className="space-y-2 text-sm text-muted">
        <div>MacroTrack v{APP_VERSION}</div>
        <p>Contains data from NEVO-online 2023, RIVM, Bilthoven</p>
        <p>
          Product data from Open Food Facts, available under the Open Database License (ODbL). See{' '}
          <a href="https://openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            openfoodfacts.org
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
