import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Nutrients } from '@/db/types';
import { fmtG } from './format';

function row(label: string, value: number | undefined, unit: string) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span>{value === undefined ? '–' : `${fmtG(value)} ${unit}`}</span>
    </div>
  );
}

export function MicrosPanel({ totals }: { totals: Nutrients }) {
  const [open, setOpen] = useState(false);
  const salt = totals.salt ?? (totals.sodium !== undefined ? (totals.sodium * 2.5) / 1000 : undefined);

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="font-semibold">Micronutrients</h3>
        <ChevronDown size={18} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="mt-2 divide-y divide-border">
          {row('Fibre', totals.fiber, 'g')}
          {row('Sugar', totals.sugar, 'g')}
          {row('Saturated fat', totals.satFat, 'g')}
          {row('Salt', salt, 'g')}
          {row('Sodium', totals.sodium, 'mg')}
          {row('Alcohol', totals.alcohol, 'g')}
        </div>
      )}
    </Card>
  );
}
