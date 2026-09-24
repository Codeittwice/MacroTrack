import { Flame } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ExpenditureResult } from '@/lib/nutrition';
import type { DateKey } from '@/db/types';
import { fmt, formatGoalDate, kcalFmt } from './format';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs text-muted">{label}</div>
      {children}
    </Card>
  );
}

const CONFIDENCE_COLOR: Record<ExpenditureResult['confidence'], string> = {
  high: 'var(--success)',
  medium: 'var(--warning)',
  low: 'var(--muted)',
};

export function StatTiles({
  hasProfile,
  expenditure,
  streak,
  goalEta,
  goalWeightSet,
  weeklyAverage,
  today,
}: {
  hasProfile: boolean;
  expenditure: ExpenditureResult | undefined;
  streak: number | undefined;
  goalEta: DateKey | null | undefined;
  goalWeightSet: boolean;
  weeklyAverage: number | null | undefined;
  today: DateKey;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="Expenditure">
        {!hasProfile || !expenditure ? (
          <div className="text-lg font-semibold text-muted">—</div>
        ) : expenditure.daysUsed < 10 ? (
          <>
            <div className="text-lg font-semibold">Learning</div>
            <div className="text-xs text-muted">{expenditure.daysUsed}/10 days</div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-lg font-semibold">
              {kcalFmt(expenditure.expenditure)} kcal
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CONFIDENCE_COLOR[expenditure.confidence] }}
              />
            </div>
            <div className="text-xs text-muted">{expenditure.confidence} confidence</div>
          </>
        )}
      </Tile>

      <Tile label="Logging streak">
        <div className="flex items-center gap-1.5 text-lg font-semibold">
          <Flame size={16} className="text-[var(--kcal)]" />
          {streak === undefined ? '—' : `${streak} ${streak === 1 ? 'day' : 'days'}`}
        </div>
      </Tile>

      <Tile label="Goal ETA">
        {!goalWeightSet ? (
          <div className="text-sm text-muted">No goal weight set</div>
        ) : goalEta === undefined ? (
          <div className="text-lg font-semibold text-muted">—</div>
        ) : goalEta === null ? (
          <div className="text-sm text-muted">Not trending toward goal</div>
        ) : goalEta === today ? (
          <div className="text-lg font-semibold">Reached</div>
        ) : (
          <div className="text-lg font-semibold">{formatGoalDate(goalEta, today)}</div>
        )}
      </Tile>

      <Tile label="Weekly average">
        <div className="text-lg font-semibold">{weeklyAverage === undefined || weeklyAverage === null ? '—' : `${fmt(Math.round(weeklyAverage))} kcal`}</div>
        <div className="text-xs text-muted">last 7 days</div>
      </Tile>
    </div>
  );
}

export default StatTiles;
