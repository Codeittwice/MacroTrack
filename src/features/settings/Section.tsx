import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/** Card wrapper with a heading, used by every Settings section. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}
