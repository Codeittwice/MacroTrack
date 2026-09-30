import type { MacroTargets, Nutrients } from '@/db/types';
import { fmtG, fmtKcal } from './format';

const MACRO_ROWS: { key: 'protein' | 'carbs' | 'fat'; short: string; label: string; color: string }[] = [
  { key: 'protein', short: 'P', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', short: 'C', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', short: 'F', label: 'Fat', color: 'var(--fat)' },
];

function Bar({ value, max, color, height = 'h-1.5' }: { value: number; max: number; color: string; height?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-surface-2`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} />
    </div>
  );
}

/**
 * Sticky day counter: eaten / target / left as three calm numbers, one calorie bar, and a thin
 * bar per macro with its numbers underneath (colour only on the bar and the letter).
 */
export function DaySummary({ totals, targets }: { totals: Nutrients; targets: MacroTargets | undefined }) {
  const kcalTarget = targets?.kcal ?? 0;
  const left = kcalTarget - totals.kcal;
  const over = kcalTarget > 0 && left < 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:border-border">
      <div className="mb-2 grid grid-cols-3 text-center">
        <div><div className="text-lg font-semibold">{fmtKcal(totals.kcal)}</div><div className="text-xs text-muted">eaten</div></div>
        <div><div className="text-lg font-semibold text-muted">{kcalTarget > 0 ? fmtKcal(kcalTarget) : '–'}</div><div className="text-xs text-muted">target</div></div>
        <div>
          <div className="text-lg font-semibold" style={{ color: over ? 'var(--danger)' : 'var(--kcal)' }}>{kcalTarget > 0 ? fmtKcal(Math.abs(left)) : '–'}</div>
          <div className="text-xs text-muted">{over ? 'over' : 'left'}</div>
        </div>
      </div>
      <Bar value={totals.kcal} max={kcalTarget} color="var(--kcal)" height="h-2" />

      <div className="mt-3 grid grid-cols-3 gap-3">
        {MACRO_ROWS.map(({ key, short, label, color }) => {
          const target = targets?.[key] ?? 0;
          return (
            <div key={key} aria-label={`${label}: ${fmtG(totals[key])}${target > 0 ? ` of ${fmtG(target)}` : ''} g`}>
              <Bar value={totals[key]} max={target} color={color} />
              <div className="mt-1 text-xs">
                <span className="font-medium" style={{ color }}>{short}</span>{' '}
                <span className="text-muted">{fmtG(totals[key])}{target > 0 ? ` / ${fmtG(target)}` : ''} g</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
