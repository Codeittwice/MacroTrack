import { useEffect, useState } from 'react';
import { loadNevo, nevoCredit } from '@/lib/food-sources/nevo';
import { Section } from './Section';
import { APP_VERSION } from './version';

export function AboutSection() {
  const [nevo, setNevo] = useState<{ credit: string; count: number } | null>(null);
  useEffect(() => {
    void loadNevo().then((file) => setNevo({ credit: nevoCredit(file.header.version !== 'none' ? file.header.version : undefined), count: file.header.count })).catch(() => undefined);
  }, []);
  return (
    <Section title="About">
      <div className="space-y-2 text-sm text-muted">
        <div>MacroTrack v{APP_VERSION}</div>
        <p>
          {nevo && nevo.count > 0
            ? `${nevo.credit}. NEVO values are shown unchanged; foods marked OFF, Mine, Recipe or AI estimate are additions from other sources.`
            : 'The Dutch food composition table (NEVO, RIVM) is not installed in this build.'}
        </p>
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
