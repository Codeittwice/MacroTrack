import { Card, Stat } from '@/components/ui';
import type { DailyPoint } from '@/lib/nutrition';
import { formatWeight } from '@/lib/weight/actions';
import { projectGoalDate } from '@/lib/nutrition';
import { fromDateKey, today, daysBetween } from '@/lib/utils/date';
import { trendChangeOverDays, averageWeeklyRate, trendExtremes } from './stats';

function fmtDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function WeightStats({
  trend,
  unit,
  goalWeightKg,
  weeklyRateKg,
  latestTrendKg,
}: {
  trend: DailyPoint[];
  unit: 'kg' | 'lb';
  goalWeightKg: number | undefined;
  weeklyRateKg: number;
  latestTrendKg: number | undefined;
}) {
  const change7 = trendChangeOverDays(trend, 7);
  const change30 = trendChangeOverDays(trend, 30);
  const avgRate = averageWeeklyRate(trend);
  const extremes = trendExtremes(trend);

  const projected =
    latestTrendKg !== undefined && goalWeightKg !== undefined
      ? projectGoalDate(latestTrendKg, goalWeightKg, weeklyRateKg, today())
      : null;
  const weeksOut = projected ? Math.round(daysBetween(today(), projected) / 7) : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card>
        <Stat label="7-day change" value={change7 !== undefined ? formatWeight(change7, unit, { signed: true }) : '—'} />
      </Card>
      <Card>
        <Stat label="30-day change" value={change30 !== undefined ? formatWeight(change30, unit, { signed: true }) : '—'} />
      </Card>
      <Card>
        <Stat label="Average weekly rate" value={avgRate !== undefined ? `${formatWeight(avgRate, unit, { signed: true })}/wk` : '—'} />
      </Card>
      <Card>
        <Stat
          label="Goal weight"
          value={goalWeightKg !== undefined ? formatWeight(goalWeightKg, unit) : '—'}
          sub={goalWeightKg === undefined ? 'Set in settings' : undefined}
        />
      </Card>
      <Card>
        <Stat
          label="Projected goal date"
          value={projected ? fmtDate(projected) : '—'}
          sub={projected ? (weeksOut && weeksOut > 0 ? `in ${weeksOut} week${weeksOut === 1 ? '' : 's'}` : 'This week') : 'Not on current trend'}
        />
      </Card>
      <Card>
        <Stat
          label="Lowest trend"
          value={extremes ? formatWeight(extremes.lowest.value, unit) : '—'}
          sub={extremes ? fmtDate(extremes.lowest.date) : undefined}
        />
      </Card>
      <Card>
        <Stat
          label="Highest trend"
          value={extremes ? formatWeight(extremes.highest.value, unit) : '—'}
          sub={extremes ? fmtDate(extremes.highest.date) : undefined}
        />
      </Card>
    </div>
  );
}
