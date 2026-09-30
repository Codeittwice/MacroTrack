import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/** Anchor id for a section title, e.g. "Water goal" → "water-goal" (More links to /settings#water-goal). */
export const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Card wrapper with a heading, used by every Settings section. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={sectionId(title)} className="scroll-mt-4">
      <Card className="mb-4">
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        {children}
      </Card>
    </section>
  );
}
