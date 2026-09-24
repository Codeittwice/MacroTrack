import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { formatWeight } from '@/lib/weight/actions';
import type { DateKey } from '@/db/types';
import { fromDateKey } from '@/lib/utils/date';
import { isTowardGoal, type ToWardGoal } from './stats';
import type { GoalType } from '@/db/types';

function rateColor(state: ToWardGoal | undefined): string | undefined {
  if (state === 'toward') return 'var(--success)';
  if (state === 'away') return 'var(--danger)';
  if (state === 'flat') return 'var(--muted)';
  return undefined;
}

export function WeightHeader({
  latestTrendKg,
  weeklyRateKg,
  unit,
  goalWeightKg,
  goalType,
  firstTrendKg,
  firstTrendDate,
  startWeightKg,
  startDate,
}: {
  latestTrendKg: number | undefined;
  weeklyRateKg: number;
  unit: 'kg' | 'lb';
  goalWeightKg: number | undefined;
  goalType: GoalType | undefined;
  firstTrendKg: number | undefined;
  firstTrendDate: DateKey | undefined;
  startWeightKg: number | undefined;
  startDate: DateKey | undefined;
}) {
  const towardState = isTowardGoal(weeklyRateKg, latestTrendKg, goalWeightKg, goalType);
  const color = rateColor(towardState);
  const Arrow = weeklyRateKg < -0.05 ? TrendingDown : weeklyRateKg > 0.05 ? TrendingUp : Minus;

  const baseKg = firstTrendKg ?? startWeightKg;
  const baseDate = firstTrendKg !== undefined ? firstTrendDate : startDate;
  const totalChange = baseKg !== undefined && latestTrendKg !== undefined ? latestTrendKg - baseKg : undefined;

  return (
    <div className="mb-4">
      <div className="text-xs text-muted">Trend weight</div>
      <div className="text-4xl font-semibold tabular-nums">{formatWeight(latestTrendKg ?? NaN, unit)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 tabular-nums" style={color ? { color } : undefined}>
          <Arrow size={16} />
          {formatWeight(weeklyRateKg, unit, { signed: true })}/wk
        </span>
        {totalChange !== undefined && (
          <span className="tabular-nums text-muted">
            {formatWeight(totalChange, unit, { signed: true })} since{' '}
            {baseDate ? fromDateKey(baseDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </span>
        )}
      </div>
    </div>
  );
}
