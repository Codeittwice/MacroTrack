import { useMemo } from 'react';
import type { DailyPoint } from '@/lib/nutrition';
import type { WeightEntry } from '@/db/types';
import { formatWeight } from '@/lib/weight/actions';
import { fromDateKey } from '@/lib/utils/date';

interface Group {
  key: string;
  label: string;
  rows: WeightEntry[];
}

function monthLabel(dateStr: string): string {
  return fromDateKey(dateStr).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dayLabel(dateStr: string): string {
  return fromDateKey(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function WeightHistory({
  weights,
  trend,
  unit,
  onSelect,
}: {
  weights: WeightEntry[];
  trend: DailyPoint[];
  unit: 'kg' | 'lb';
  onSelect: (entry: WeightEntry) => void;
}) {
  const trendByDate = useMemo(() => new Map(trend.map((p) => [p.date, p.value])), [trend]);

  const groups = useMemo(() => {
    const sorted = [...weights].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time ?? 0) - (a.time ?? 0);
    });
    const byMonth = new Map<string, Group>();
    for (const w of sorted) {
      const key = w.date.slice(0, 7);
      let g = byMonth.get(key);
      if (!g) {
        g = { key, label: monthLabel(w.date), rows: [] };
        byMonth.set(key, g);
      }
      g.rows.push(w);
    }
    return [...byMonth.values()];
  }, [weights]);

  if (weights.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-2 text-sm font-medium text-muted">{g.label}</div>
          <div className="flex flex-col gap-1">
            {g.rows.map((w) => {
              const trendVal = trendByDate.get(w.date);
              const diff = trendVal !== undefined ? w.kg - trendVal : undefined;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelect(w)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <div>
                    <div className="text-sm">{dayLabel(w.date)}</div>
                    {(w.note || w.bodyFatPct !== undefined) && (
                      <div className="text-xs text-muted">
                        {w.bodyFatPct !== undefined ? `${w.bodyFatPct.toFixed(1)}% BF` : ''}
                        {w.bodyFatPct !== undefined && w.note ? ' · ' : ''}
                        {w.note}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums font-medium">{formatWeight(w.kg, unit)}</div>
                    <div className="tabular-nums text-xs text-muted">
                      {trendVal !== undefined ? `trend ${formatWeight(trendVal, unit)}` : ''}
                      {diff !== undefined ? ` (${formatWeight(diff, unit, { signed: true })})` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
