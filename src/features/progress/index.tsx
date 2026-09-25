import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, EmptyState, PageHeader, Segmented, Stat } from '@/components/ui';
import { TrendChart, type TrendRange } from '@/components/charts/TrendChart';
import { getTargetSetFor, useProfile, useSettings, useTargets } from '@/app/hooks';
import { getDailyIntake } from '@/lib/log/queries';
import { averageIntake, adherence, currentExpenditure } from '@/lib/stats';
import { summarizeTrend, useWeights } from '@/lib/weight/queries';
import { addDays, toDateKey, today } from '@/lib/utils/date';
import { toDisplay } from '@/lib/weight/actions';

const RANGES: { value: TrendRange; label: string }[] = [
  { value: '1M', label: '1M' }, { value: '3M', label: '3M' }, { value: '6M', label: '6M' }, { value: '1Y', label: '1Y' }, { value: 'ALL', label: 'All' },
];

export default function ProgressPage() {
  const profile = useProfile();
  const settings = useSettings();
  const weights = useWeights();
  const date = today();
  const targets = useTargets(date);
  const targetSet = useLiveQuery(() => getTargetSetFor(date), [date]);
  const [range, setRange] = useState<TrendRange>('3M');
  const intake = useLiveQuery(
    () => profile ? getDailyIntake(toDateKey(new Date(profile.onboardedAt)), date) : Promise.resolve([]),
    [profile?.onboardedAt, date],
  );
  const trend = useMemo(() => weights ? summarizeTrend(weights) : undefined, [weights]);
  const expenditure = useMemo(() => profile && weights && intake ? currentExpenditure({ profile, weights, intake, previous: targetSet?.tdee, previousDate: targetSet?.effectiveFrom, today: date }) : undefined, [profile, weights, intake, targetSet, date]);
  const monthAverage = useMemo(() => intake ? averageIntake(intake, 28, date) : null, [intake, date]);
  const monthAdherence = useMemo(() => intake && targets ? adherence(intake.filter((item) => item.date >= addDays(date, -27)), targets.kcal) : null, [intake, targets, date]);

  if (profile === undefined || weights === undefined || intake === undefined) return <div className="py-10 text-center text-sm text-muted">Loading progress...</div>;
  if (profile === null) return <EmptyState title="Finish onboarding first" body="Progress is built from your weight and food log." />;

  const unit = settings.weightUnit;
  return <div className="mx-auto flex max-w-3xl flex-col gap-4"><PageHeader title="Progress" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Card><Stat label="Trend weight" value={trend?.latestTrendKg === undefined ? 'No data' : `${toDisplay(trend.latestTrendKg, unit).toFixed(1)} ${unit}`} /></Card><Card><Stat label="Weekly rate" value={trend?.latestTrendKg === undefined ? 'No data' : `${trend.weeklyRateKg > 0 ? '+' : ''}${trend.weeklyRateKg.toFixed(2)} kg`} /></Card><Card><Stat label="28-day intake" value={monthAverage === null ? 'No data' : `${Math.round(monthAverage)} kcal`} /></Card><Card><Stat label="Adherence" value={monthAdherence === null ? 'No data' : `${Math.round(monthAdherence)}%`} /></Card></div>

    <Card><div className="mb-3 flex items-center justify-between"><div><div className="font-semibold">Weight trend</div><div className="text-sm text-muted">Scale readings and smoothed trend</div></div></div><Segmented options={RANGES} value={range} onChange={setRange} className="mb-3" /><TrendChart weights={weights.map((weight) => ({ date: weight.date, kg: weight.kg }))} trend={trend?.trend ?? []} range={range} unit={unit} goalKg={profile.goalWeightKg} /></Card>

    <Card><div className="mb-3 font-semibold">Current estimate</div><div className="grid grid-cols-2 gap-4"><Stat label="Expenditure" value={expenditure ? `${expenditure.expenditure} kcal` : 'No data'} sub={expenditure ? `${expenditure.confidence} confidence` : undefined} /><Stat label="Logged days" value={`${intake.length}`} sub="Since onboarding" /></div></Card>
  </div>;
}
