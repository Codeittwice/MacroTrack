import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useActiveWorkout, useWorkouts } from '@/lib/training/actions';
import { useWater } from '@/lib/water/actions';
import { addDays } from '@/lib/utils/date';
import { signedWeightFmt, weightFmt } from './format';

function Tile({ to, label, value, sub, subColor }: { to: string; label: string; value: ReactNode; sub: ReactNode; subColor?: string }) {
  return (
    <Link to={to} className="flex min-w-0 flex-col rounded-2xl bg-surface p-3 hover:bg-surface-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="truncate text-lg font-semibold">{value}</span>
      <span className="truncate text-xs" style={{ color: subColor ?? 'var(--muted)' }}>{sub}</span>
    </Link>
  );
}

/** Weight trend, this week's training and today's water, side by side. */
export function GlanceTiles({ today, latestTrendKg, weeklyRateKg, unit, waterGoalMl, losing }: {
  today: string;
  latestTrendKg: number | undefined;
  weeklyRateKg: number | undefined;
  unit: 'kg' | 'lb';
  waterGoalMl: number;
  /** whether the goal is to lose weight (a falling rate shows as good news) */
  losing: boolean;
}) {
  const workouts = useWorkouts();
  const active = useActiveWorkout();
  const water = useWater(today);
  const week = (workouts ?? []).filter((w) => w.finishedAt && w.date > addDays(today, -7)).length;
  const rateGood = weeklyRateKg !== undefined && Math.abs(weeklyRateKg) >= 0.05 && (losing ? weeklyRateKg < 0 : weeklyRateKg > 0);
  const litres = (ml: number) => (ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        to="/weight"
        label="Weight"
        value={latestTrendKg === undefined ? '–' : weightFmt(latestTrendKg, unit).replace(` ${unit}`, '')}
        sub={latestTrendKg === undefined ? 'Log a weigh-in' : `${signedWeightFmt(weeklyRateKg, unit)}/wk`}
        subColor={rateGood ? 'var(--success)' : undefined}
      />
      <Tile
        to={active ? `/training/workout/${active.id}` : '/training'}
        label="Training"
        value={active ? 'Live' : String(week)}
        sub={active ? active.name : 'last 7 days'}
        subColor={active ? 'var(--primary)' : undefined}
      />
      <Tile to="/extras/water" label="Water" value={water === undefined ? '–' : `${litres(water)} L`} sub={`of ${litres(waterGoalMl)} L`} />
    </div>
  );
}
