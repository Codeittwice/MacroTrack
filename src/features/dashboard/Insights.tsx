import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ExpenditureResult } from '@/lib/nutrition';
import type { DateKey } from '@/db/types';
import { fmt, formatGoalDate, kcalFmt } from './format';

const CONFIDENCE_COLOR: Record<ExpenditureResult['confidence'], string> = {
  high: 'var(--success)',
  medium: 'var(--warning)',
  low: 'var(--muted)',
};

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="truncate font-semibold">{value}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

/** Expenditure, 7-day average intake and goal date in one quiet strip; opens the Coach. */
export function Insights({ expenditure, goalEta, goalWeightSet, weeklyAverage, today }: {
  expenditure: ExpenditureResult | undefined;
  goalEta: DateKey | 'learning' | null | undefined;
  goalWeightSet: boolean;
  weeklyAverage: number | null | undefined;
  today: DateKey;
}) {
  const exp = !expenditure
    ? <Stat label="Expenditure" value="–" />
    : expenditure.daysUsed < 10
      ? <Stat label="Expenditure" value="Learning" sub={`${expenditure.daysUsed}/10 days`} />
      : <Stat label="Expenditure" value={<span className="inline-flex items-center gap-1.5">{kcalFmt(expenditure.expenditure)}<span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CONFIDENCE_COLOR[expenditure.confidence] }} /></span>} sub={`kcal · ${expenditure.confidence} confidence`} />;

  const goal = !goalWeightSet ? <Stat label="Goal" value="–" sub="no goal weight" />
    : goalEta === undefined ? <Stat label="Goal" value="–" />
    : goalEta === 'learning' ? <Stat label="Goal" value="Soon" sub="weigh in for a week" />
    : goalEta === null ? <Stat label="Goal" value="–" sub="not trending there" />
    : goalEta === today ? <Stat label="Goal" value="Reached" />
    : <Stat label="Goal" value={formatGoalDate(goalEta, today)} sub="at this rate" />;

  return (
    <Link to="/coach" className="grid grid-cols-3 gap-3 rounded-2xl bg-surface px-4 py-3 hover:bg-surface-2">
      {exp}
      <Stat label="7-day average" value={weeklyAverage === undefined || weeklyAverage === null ? '–' : fmt(Math.round(weeklyAverage))} sub="kcal a day" />
      {goal}
    </Link>
  );
}
