import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, EmptyState, PageHeader, ProgressBar, Segmented, Stat } from '@/components/ui';
import { TrendChart, rangeStart, type TrendRange } from '@/components/charts/TrendChart';
import { getTargetSetFor, useProfile, useSettings, useTargets } from '@/app/hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { DateKey, Nutrients } from '@/db/types';
import { getDailyIntake } from '@/lib/log/queries';
import { averageIntake, adherence, currentExpenditure } from '@/lib/stats';
import { expenditureSeries, projectGoalDate, targetsFromProfile } from '@/lib/nutrition';
import { summarizeTrend, useWeights } from '@/lib/weight/queries';
import { addDays, ageOn, fromDateKey, toDateKey, today } from '@/lib/utils/date';
import { toDisplay } from '@/lib/weight/actions';
import { EnergyChart, MeasurementChart, NutrientChart } from './charts';

const RANGES: { value: TrendRange; label: string }[] = [
  { value: '1M', label: '1M' }, { value: '3M', label: '3M' }, { value: '6M', label: '6M' }, { value: '1Y', label: '1Y' }, { value: 'ALL', label: 'All' },
];

type NutrientKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
const NUTRIENTS: { value: NutrientKey; label: string; color: string; unit: string }[] = [
  { value: 'kcal', label: 'Calories', color: 'var(--kcal)', unit: 'kcal' },
  { value: 'protein', label: 'Protein', color: 'var(--protein)', unit: 'g' },
  { value: 'carbs', label: 'Carbs', color: 'var(--carbs)', unit: 'g' },
  { value: 'fat', label: 'Fat', color: 'var(--fat)', unit: 'g' },
  { value: 'fiber', label: 'Fibre', color: 'var(--primary)', unit: 'g' },
];

const inRange = (range: TrendRange, end: DateKey) => {
  const start = rangeStart(range, end);
  return (d: DateKey) => start === null || d >= start;
};

const longDate = (d: DateKey) => fromDateKey(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function ProgressPage() {
  const profile = useProfile();
  const settings = useSettings();
  const weights = useWeights();
  const date = today();
  const targets = useTargets(date);
  const targetSet = useLiveQuery(() => getTargetSetFor(date), [date]);
  const measurements = useLiveQuery(async () => (await db.measurements.orderBy('date').toArray()).filter(alive), []);
  const [range, setRange] = useState<TrendRange>('3M');
  const [nutrient, setNutrient] = useState<NutrientKey>('kcal');
  const [macroDays, setMacroDays] = useState<7 | 28>(7);
  const intake = useLiveQuery(
    () => profile ? getDailyIntake(toDateKey(new Date(profile.onboardedAt - 365 * 86_400_000)), date) : Promise.resolve([]),
    [profile?.onboardedAt, date],
  );
  const trend = useMemo(() => weights ? summarizeTrend(weights) : undefined, [weights]);
  const expenditure = useMemo(() => profile && weights && intake ? currentExpenditure({ profile, weights, intake, previous: targetSet?.tdee, previousDate: targetSet?.effectiveFrom, today: date }) : undefined, [profile, weights, intake, targetSet, date]);
  const monthAverage = useMemo(() => intake ? averageIntake(intake, 28, date) : null, [intake, date]);
  const monthAdherence = useMemo(() => intake && targets ? adherence(intake.filter((item) => item.date >= addDays(date, -27)), targets.kcal) : null, [intake, targets, date]);

  const energy = useMemo(() => {
    if (!profile || !intake || !trend || trend.trend.length === 0) return [];
    const prior = targetsFromProfile(profile, trend.trend[0].value, ageOn(profile.birthDate, trend.trend[0].date)).tdee;
    const series = expenditureSeries(intake, trend.trend, prior);
    const byDate = new Map(intake.map((d) => [d.date, d.kcal]));
    const keep = inRange(range, date);
    return series.filter((p) => keep(p.date)).map((p) => ({ date: p.date, expenditure: p.value, intake: byDate.get(p.date) }));
  }, [profile, intake, trend, range, date]);

  const nutrientData = useMemo(() => {
    if (!intake) return [];
    const keep = inRange(range, date);
    return intake.filter((d) => keep(d.date)).map((d) => ({ date: d.date, value: d.nutrients[nutrient] }));
  }, [intake, nutrient, range, date]);

  const macroAverages = useMemo(() => {
    if (!intake) return undefined;
    const days = intake.filter((d) => d.date > addDays(date, -macroDays) && d.date <= date);
    if (days.length === 0) return undefined;
    const avg = (k: keyof Nutrients) => days.reduce((s, d) => s + (d.nutrients[k] ?? 0), 0) / days.length;
    return { days: days.length, kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') };
  }, [intake, macroDays, date]);

  const measurementData = useMemo(() => {
    if (!measurements || measurements.length === 0) return undefined;
    const keys = [...new Set(measurements.flatMap((m) => Object.keys(m.values)))];
    return { keys, rows: measurements.map((m) => ({ date: m.date, ...m.values })) };
  }, [measurements]);

  if (profile === undefined || weights === undefined || intake === undefined) return <div className="py-10 text-center text-sm text-muted">Loading progress…</div>;
  if (profile === null) return <EmptyState title="Finish onboarding first" body="Progress is built from your weight and food log." />;

  const unit = settings.weightUnit;
  const fmtKg = (kg: number, signed = false) => `${signed && kg > 0 ? '+' : ''}${toDisplay(kg, unit).toFixed(signed ? 2 : 1)} ${unit}`;
  const latest = trend?.latestTrendKg;
  const goalKg = profile.goalWeightKg;
  const goalDate = latest !== undefined && goalKg !== undefined ? projectGoalDate(latest, goalKg, trend?.weeklyRateKg ?? 0, date) : null;
  const toGo = latest !== undefined && goalKg !== undefined ? goalKg - latest : undefined;
  const startKg = profile.startWeightKg;
  const goalProgress = latest !== undefined && goalKg !== undefined && goalKg !== startKg ? Math.min(1, Math.max(0, (startKg - latest) / (startKg - goalKg))) : undefined;
  const nutrientMeta = NUTRIENTS.find((n) => n.value === nutrient)!;
  const nutrientTarget = targets && nutrient !== 'fiber' ? targets[nutrient] : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Progress" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Stat label="Trend weight" value={latest === undefined ? 'No data' : fmtKg(latest)} /></Card>
        <Card><Stat label="Weekly rate" value={latest === undefined ? 'No data' : fmtKg(trend?.weeklyRateKg ?? 0, true)} sub="last 2 weeks" /></Card>
        <Card><Stat label="28-day intake" value={monthAverage === null ? 'No data' : `${Math.round(monthAverage)} kcal`} sub="average per logged day" /></Card>
        <Card><Stat label="Adherence" value={monthAdherence === null ? 'No data' : `${Math.round(monthAdherence)}%`} sub="days within 10% of target" /></Card>
      </div>

      <Segmented options={RANGES} value={range} onChange={setRange} />

      <Card>
        <div className="mb-3"><div className="font-semibold">Weight trend</div><div className="text-sm text-muted">Scale readings and smoothed trend</div></div>
        <TrendChart weights={weights.map((w) => ({ date: w.date, kg: w.kg }))} trend={trend?.trend ?? []} range={range} unit={unit} goalKg={goalKg} />
      </Card>

      {goalKg !== undefined && (
        <Card>
          <div className="mb-3 font-semibold">Goal</div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Goal weight" value={fmtKg(goalKg)} />
            <Stat label="To go" value={toGo === undefined ? '—' : fmtKg(Math.abs(toGo))} />
            <Stat label="Projected" value={goalDate ? fromDateKey(goalDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'} sub={goalDate ? longDate(goalDate).split(' ').at(-1) : 'at current rate'} />
          </div>
          {goalProgress !== undefined && <div className="mt-4"><ProgressBar value={goalProgress} max={1} color="var(--primary)" /><div className="mt-1 text-xs text-muted">{Math.round(goalProgress * 100)}% of the way from {fmtKg(startKg)}</div></div>}
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div><div className="font-semibold">Energy balance</div><div className="text-sm text-muted">Daily intake against your adaptive expenditure</div></div>
          <Stat label="Expenditure now" value={expenditure ? `${expenditure.expenditure} kcal` : '—'} sub={expenditure ? `${expenditure.confidence} confidence` : undefined} />
        </div>
        {energy.length > 1 ? <EnergyChart data={energy} /> : <p className="py-6 text-center text-sm text-muted">Log food and weight for a couple of weeks to see this chart.</p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Average macros</div>
          <Segmented options={[{ value: 7, label: '7 days' }, { value: 28, label: '28 days' }]} value={macroDays} onChange={setMacroDays} className="w-44" />
        </div>
        {macroAverages ? (
          <div className="flex flex-col gap-3">
            {([['kcal', 'Calories', 'var(--kcal)', 'kcal'], ['protein', 'Protein', 'var(--protein)', 'g'], ['carbs', 'Carbs', 'var(--carbs)', 'g'], ['fat', 'Fat', 'var(--fat)', 'g']] as const).map(([k, label, color, u]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-muted">{Math.round(macroAverages[k])}{targets ? ` / ${targets[k]}` : ''} {u}</span></div>
                <ProgressBar value={macroAverages[k]} max={targets?.[k] ?? macroAverages[k]} color={color} />
              </div>
            ))}
            <div className="text-xs text-muted">Averaged over {macroAverages.days} logged {macroAverages.days === 1 ? 'day' : 'days'}.</div>
          </div>
        ) : <p className="py-4 text-center text-sm text-muted">No food logged in this period.</p>}
      </Card>

      <Card>
        <div className="mb-3 font-semibold">Nutrient history</div>
        <Segmented options={NUTRIENTS.map((n) => ({ value: n.value, label: n.label }))} value={nutrient} onChange={setNutrient} className="mb-3" />
        {nutrientData.length > 0 ? <NutrientChart data={nutrientData} color={nutrientMeta.color} target={nutrientTarget} unit={nutrientMeta.unit} /> : <p className="py-6 text-center text-sm text-muted">No food logged in this range.</p>}
      </Card>

      {measurementData && (
        <Card>
          <div className="mb-3 font-semibold">Body measurements</div>
          <MeasurementChart data={measurementData.rows} keys={measurementData.keys} />
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Logged days" value={`${intake.length}`} sub="with food entries" />
          <Stat label="Weigh-ins" value={`${weights.length}`} sub={weights[0] ? `since ${longDate(weights[0].date)}` : undefined} />
        </div>
      </Card>
    </div>
  );
}
