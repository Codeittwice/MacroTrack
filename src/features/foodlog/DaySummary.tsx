import { ProgressBar } from '@/components/ui';
import type { MacroTargets, Nutrients } from '@/db/types';
import { fmtG, fmtKcal } from './format';

const MACRO_ROWS: { key: 'protein' | 'carbs' | 'fat'; label: string; color: string }[] = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)' },
];

export function DaySummary({ totals, targets }: { totals: Nutrients; targets: MacroTargets | undefined }) {
  const kcalTarget = targets?.kcal ?? 0;
  const diff = kcalTarget > 0 ? kcalTarget - totals.kcal : undefined;

  return (
    <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:border-border">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-lg font-semibold">
          {fmtKcal(totals.kcal)}
          {kcalTarget > 0 && <span className="text-muted"> / {fmtKcal(kcalTarget)} kcal</span>}
          {kcalTarget === 0 && <span className="text-muted"> kcal</span>}
        </div>
        {diff !== undefined && (
          <div className={diff < 0 ? 'text-sm text-danger' : 'text-sm text-muted'}>
            {diff < 0 ? `${fmtKcal(Math.abs(diff))} over` : `${fmtKcal(diff)} left`}
          </div>
        )}
      </div>
      <ProgressBar value={totals.kcal} max={kcalTarget} color="var(--kcal)" />

      <div className="mt-3 grid grid-cols-3 gap-3">
        {MACRO_ROWS.map(({ key, label, color }) => {
          const target = targets?.[key] ?? 0;
          return (
            <div key={key}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">{label}</span>
                <span style={{ color }}>
                  {fmtG(totals[key])}
                  {target > 0 ? ` / ${fmtG(target)} g` : ' g'}
                </span>
              </div>
              <ProgressBar value={totals[key]} max={target} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
