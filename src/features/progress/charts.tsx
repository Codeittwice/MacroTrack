import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DateKey } from '@/db/types';
import { fromDateKey } from '@/lib/utils/date';

const shortDate = (d: DateKey) => fromDateKey(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 12 },
  labelStyle: { color: 'var(--muted)' },
  labelFormatter: (d: unknown) => shortDate(String(d)),
} as const;

export interface EnergyPoint { date: DateKey; intake?: number; expenditure?: number }

/** Daily intake bars against the adaptive expenditure line: the energy balance at a glance. */
export function EnergyChart({ data, height = 220 }: { data: EnergyPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
        <YAxis domain={['auto', 'auto']} width={48} {...axis} />
        <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${Math.round(v)} kcal`, name === 'intake' ? 'Intake' : 'Expenditure']} />
        <Bar dataKey="intake" fill="var(--kcal)" fillOpacity={0.35} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line dataKey="expenditure" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** One nutrient per day with an optional target line. */
export function NutrientChart({ data, color, target, unit, height = 200 }: {
  data: { date: DateKey; value?: number }[]; color: string; target?: number; unit: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
        <YAxis width={48} {...axis} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Math.round(v)} ${unit}`, 'Logged']} />
        {target !== undefined && <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="4 4" />}
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Body measurements over time, one line per site. */
export function MeasurementChart({ data, keys, height = 200 }: { data: Record<string, number | string>[]; keys: string[]; height?: number }) {
  const colors = ['var(--protein)', 'var(--carbs)', 'var(--fat)', 'var(--kcal)', 'var(--primary)'];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
        <YAxis domain={['auto', 'auto']} width={48} {...axis} />
        <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v} cm`, name]} />
        {keys.map((key, i) => (
          <Line key={key} dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
