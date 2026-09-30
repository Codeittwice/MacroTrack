import { useMemo } from 'react';
import { Bar, BarChart, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui';
import { BAND_FILL, fmtSets } from '@/components/MuscleMap';
import type { Muscle, Workout } from '@/db/types';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { BAND_LABEL, LANDMARKS, volumeBand, weeklyHistory, type ExerciseLookup, type WeekVolume } from '@/lib/training/volume';
import { fromDateKey, today } from '@/lib/utils/date';

const WEEKS = 8;

export function useWeeklyHistory(workouts: Workout[], lookup: ExerciseLookup): WeekVolume[] {
  return useMemo(() => weeklyHistory(workouts, today(), WEEKS, lookup), [workouts, lookup]);
}

const weekLabel = (start: string) => fromDateKey(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Trend({ now, before }: { now: number; before: number }) {
  if (Math.abs(now - before) < 1) return <Minus size={12} className="text-muted" aria-label="about the same" />;
  return now > before
    ? <ArrowUp size={12} className="text-muted" aria-label="up" />
    : <ArrowDown size={12} className="text-muted" aria-label="down" />;
}

/**
 * The last 7 days against the 7 days before and the 4 weeks before that, per trained muscle, with
 * each muscle's band. Tapping a row opens the muscle's history.
 */
export function WeeklyVolume({ history, onSelect }: { history: WeekVolume[]; onSelect: (m: Muscle) => void }) {
  const current = history[history.length - 1];
  const previous = history[history.length - 2];
  const prior4 = history.slice(-6, -2);
  const rows = useMemo(() => {
    const trained = new Set<Muscle>();
    for (const w of history.slice(-5)) for (const m of Object.keys(w.sets) as Muscle[]) if ((w.sets[m] ?? 0) > 0) trained.add(m);
    return [...trained]
      .map((m) => ({
        m,
        now: current?.sets[m] ?? 0,
        last: previous?.sets[m] ?? 0,
        avg: prior4.length ? prior4.reduce((t, w) => t + (w.sets[m] ?? 0), 0) / prior4.length : 0,
      }))
      .sort((a, b) => b.now - a.now || b.last - a.last);
  }, [history, current, previous, prior4]);

  if (!rows.length) return null;
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between"><div className="font-semibold">Weekly volume</div><div className="text-xs text-muted">hard sets per muscle</div></div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-normal">Muscle</th>
            <th className="py-1 text-right font-normal">Last 7 d</th>
            <th className="py-1 text-right font-normal">Week before</th>
            <th className="py-1 text-right font-normal">4-wk avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, now, last, avg }) => {
            const band = volumeBand(m, now);
            return (
              <tr key={m} onClick={() => onSelect(m)} className="cursor-pointer border-t border-border hover:bg-surface-2">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BAND_FILL[band] }} />
                    <span>{MUSCLE_LABEL[m]}</span>
                  </div>
                  <div className="pl-4.5 text-[11px] text-muted">{BAND_LABEL[band]} · aim {LANDMARKS[m].low}–{LANDMARKS[m].high}</div>
                </td>
                <td className="py-2 text-right font-medium"><span className="inline-flex items-center gap-1">{fmtSets(now)} <Trend now={now} before={last} /></span></td>
                <td className="py-2 text-right text-muted">{fmtSets(last)}</td>
                <td className="py-2 text-right text-muted">{fmtSets(Math.round(avg * 2) / 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">Weeks are rolling 7-day blocks ending today, the same as the map. The average covers the 4 weeks before those two.</p>
    </Card>
  );
}

/** One muscle's weekly sets over the last 8 weeks, with its productive range shaded. */
export function MuscleHistoryChart({ history, muscle }: { history: WeekVolume[]; muscle: Muscle }) {
  const l = LANDMARKS[muscle];
  const data = history.map((w) => ({ week: weekLabel(w.weekEnd), sets: w.sets[muscle] ?? 0 }));
  const max = Math.max(l.mrv + 2, ...data.map((d) => d.sets));
  return (
    <div>
      <div className="mb-1 text-xs text-muted">Last {WEEKS} weeks (labelled by week end) · shaded: {l.low}–{l.high} sets</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <ReferenceArea y1={l.low} y2={l.high} fill="var(--primary)" fillOpacity={0.12} />
          <XAxis dataKey="week" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
          <YAxis domain={[0, max]} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }} formatter={(v: number) => [`${fmtSets(v)} sets`, MUSCLE_LABEL[muscle]]} />
          <Bar dataKey="sets" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={BAND_FILL[volumeBand(muscle, d.sets)]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
