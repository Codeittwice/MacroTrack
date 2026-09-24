import { useNavigate } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Card, EmptyState } from '@/components/ui';
import type { DailyPoint } from '@/lib/nutrition';
import { signedWeightFmt, weightFmt } from './format';

export function WeightCard({
  latestTrendKg,
  weeklyRateKg,
  weekAgoDelta,
  sparkline,
  unit,
}: {
  latestTrendKg: number | undefined;
  weeklyRateKg: number | undefined;
  weekAgoDelta: number | undefined;
  sparkline: DailyPoint[] | undefined;
  unit: 'kg' | 'lb';
}) {
  const navigate = useNavigate();
  const hasData = latestTrendKg !== undefined && sparkline && sparkline.length > 0;

  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/weight')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/weight');
        }}
        className="cursor-pointer outline-none"
      >
        <div className="mb-2 text-sm text-muted">Trend weight</div>
        {!hasData ? (
          <EmptyState title="No weigh-ins yet" body="Log a weigh-in to start tracking your trend." />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold">{weightFmt(latestTrendKg, unit)}</div>
                <div className="mt-1 flex gap-3 text-xs text-muted">
                  <span>7d: {signedWeightFmt(weekAgoDelta, unit)}</span>
                  <span>Rate: {signedWeightFmt(weeklyRateKg, unit)}/wk</span>
                </div>
              </div>
              <div className="h-14 w-28">
                <ResponsiveContainer width="100%" height={56}>
                  <LineChart data={sparkline}>
                    <YAxis hide domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                    <Line dataKey="value" stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default WeightCard;
