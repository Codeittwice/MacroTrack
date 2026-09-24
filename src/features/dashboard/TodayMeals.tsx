import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, EmptyState, Button } from '@/components/ui';
import type { LogEntry } from '@/db/types';
import { kcalFmt } from './format';

export function TodayMeals({ mealNames, entries }: { mealNames: string[]; entries: LogEntry[] | undefined }) {
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const kcalByMeal = new Array(mealNames.length).fill(0) as number[];
    const countByMeal = new Array(mealNames.length).fill(0) as number[];
    for (const e of entries ?? []) {
      const idx = e.meal >= 0 && e.meal < mealNames.length ? e.meal : mealNames.length - 1;
      if (idx < 0) continue;
      kcalByMeal[idx] += e.nutrients.kcal;
      countByMeal[idx] += 1;
    }
    return mealNames.map((name, i) => ({ name, kcal: kcalByMeal[i] ?? 0, count: countByMeal[i] ?? 0 }));
  }, [mealNames, entries]);

  const hasEntries = (entries?.length ?? 0) > 0;

  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/log')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/log');
        }}
        className="cursor-pointer outline-none"
      >
        <div className="mb-2 text-sm text-muted">Today's meals</div>
        {!hasEntries ? (
          <EmptyState
            title="Log your first meal"
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/log?add=0');
                }}
              >
                Log food
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between text-sm">
                <span>
                  {r.name}
                  {r.count > 0 && <span className="ml-1 text-xs text-muted">({r.count})</span>}
                </span>
                <span className="font-medium">{r.kcal > 0 ? `${kcalFmt(r.kcal)} kcal` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default TodayMeals;
