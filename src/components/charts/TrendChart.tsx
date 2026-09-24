/**
 * Reusable weight trend chart (raw weigh-ins as dots + smoothed trend line + optional goal line).
 * Shared by the Weight page and the Progress page.
 */
import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from 'recharts';
import type { DateKey } from '@/db/types';
import type { DailyPoint } from '@/lib/nutrition';
import { toDisplay } from '@/lib/weight/actions';
import { addDays, fromDateKey, today } from '@/lib/utils/date';

export type TrendRange = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface TrendChartProps {
  weights: { date: DateKey; kg: number }[];
  trend: DailyPoint[];
  range: TrendRange;
  unit: 'kg' | 'lb';
  goalKg?: number;
  height?: number;
}

const RANGE_DAYS: Record<Exclude<TrendRange, 'ALL'>, number> = {
  '7D': 6,
  '1M': 29,
  '3M': 89,
  '6M': 181,
  '1Y': 364,
};

/** Start date (inclusive) for a range ending at `end`, or null for 'ALL' (no lower bound). */
export function rangeStart(range: TrendRange, end: DateKey): DateKey | null {
  if (range === 'ALL') return null;
  return addDays(end, -RANGE_DAYS[range]);
}

interface Point {
  date: DateKey;
  x: number;
  scale?: number;
  trend?: number;
}

function xTickFormatter(range: TrendRange) {
  return (x: number) => {
    const d = new Date(x);
    if (range === 'ALL' || range === '1Y') return format(d, "MMM ''yy");
    return format(d, 'd MMM');
  };
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: 'kg' | 'lb';
}) {
  if (!active || !payload || payload.length === 0 || label === undefined) return null;
  const scale = payload.find((p) => p.dataKey === 'scale')?.value;
  const trend = payload.find((p) => p.dataKey === 'trend')?.value;
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{format(new Date(label), 'EEE d MMM yyyy')}</div>
      {scale !== undefined && (
        <div>
          Scale: {scale.toFixed(1)} {unit}
        </div>
      )}
      {trend !== undefined && (
        <div style={{ color: 'var(--primary)' }}>
          Trend: {trend.toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}

export function TrendChart(props: TrendChartProps) {
  const { weights, trend, range, unit, goalKg, height = 240 } = props;

  const { data, yDomain } = useMemo(() => {
    const allDates = [...weights.map((w) => w.date), ...trend.map((t) => t.date)];
    const end = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : today();
    const start = rangeStart(range, end);

    const inRange = (d: DateKey) => (start === null || d >= start) && d <= end;

    const byDay = new Map<DateKey, { sum: number; n: number }>();
    for (const w of weights) {
      if (!inRange(w.date)) continue;
      const e = byDay.get(w.date);
      if (e) {
        e.sum += w.kg;
        e.n += 1;
      } else {
        byDay.set(w.date, { sum: w.kg, n: 1 });
      }
    }

    const points = new Map<DateKey, Point>();
    for (const [date, { sum, n }] of byDay) {
      points.set(date, { date, x: fromDateKey(date).getTime(), scale: toDisplay(sum / n, unit) });
    }
    for (const t of trend) {
      if (!inRange(t.date)) continue;
      const existing = points.get(t.date);
      const trendVal = toDisplay(t.value, unit);
      if (existing) existing.trend = trendVal;
      else points.set(t.date, { date: t.date, x: fromDateKey(t.date).getTime(), trend: trendVal });
    }

    const data = [...points.values()].sort((a, b) => a.x - b.x);

    const values: number[] = [];
    for (const p of data) {
      if (p.scale !== undefined) values.push(p.scale);
      if (p.trend !== undefined) values.push(p.trend);
    }

    let yDomain: [number, number] | undefined;
    if (values.length) {
      let min = Math.min(...values);
      let max = Math.max(...values);
      // Include the goal line only when it's within ~30% of the data span, so a far-off
      // goal doesn't flatten the chart.
      if (goalKg !== undefined) {
        const goalDisplay = toDisplay(goalKg, unit);
        const span = Math.max(max - min, 1);
        if (goalDisplay >= min - span * 0.3 && goalDisplay <= max + span * 0.3) {
          min = Math.min(min, goalDisplay);
          max = Math.max(max, goalDisplay);
        }
      }
      const pad = Math.max((max - min) * 0.1, 0.5);
      const step = niceStep(pad);
      yDomain = [Math.floor((min - pad) / step) * step, Math.ceil((max + pad) / step) * step];
    }

    return { data, yDomain };
  }, [weights, trend, range, unit, goalKg]);

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm"
      >
        <span style={{ color: 'var(--muted)' }}>No data in this range</span>
      </div>
    );
  }

  const goalDisplay = goalKg !== undefined ? toDisplay(goalKg, unit) : undefined;
  const showGoalLine =
    goalDisplay !== undefined && yDomain !== undefined && goalDisplay >= yDomain[0] && goalDisplay <= yDomain[1];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={xTickFormatter(range)}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          width={36}
          domain={yDomain ?? ['auto', 'auto']}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(v % 1 === 0 ? 0 : 1)}
        />
        <Tooltip
          content={<ChartTooltip unit={unit} />}
          cursor={{ stroke: 'var(--border)' }}
        />
        {showGoalLine && (
          <ReferenceLine
            y={goalDisplay}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{ value: 'Goal', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="scale"
          stroke="none"
          dot={{ r: 2.5, fill: 'var(--muted)', fillOpacity: 0.5, stroke: 'none' }}
          activeDot={{ r: 3, fill: 'var(--muted)', stroke: 'none' }}
          isAnimationActive={false}
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="trend"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default TrendChart;
