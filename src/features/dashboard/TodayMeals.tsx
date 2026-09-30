import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { LogEntry } from '@/db/types';
import { kcalFmt } from './format';

/** Today's meals as compact rows; an empty meal offers a quick add instead of a dash. */
export function TodayMeals({ mealNames, entries }: { mealNames: string[]; entries: LogEntry[] | undefined }) {
  const rows = useMemo(() => {
    const kcal = new Array(mealNames.length).fill(0) as number[];
    const count = new Array(mealNames.length).fill(0) as number[];
    for (const e of entries ?? []) {
      const i = e.meal >= 0 && e.meal < mealNames.length ? e.meal : mealNames.length - 1;
      if (i < 0) continue;
      kcal[i] += e.nutrients.kcal;
      count[i] += 1;
    }
    return mealNames.map((name, i) => ({ name, i, kcal: kcal[i] ?? 0, count: count[i] ?? 0 }));
  }, [mealNames, entries]);

  return (
    <section aria-label="Today's meals" className="overflow-hidden rounded-2xl bg-surface">
      <Link to="/log" className="block px-4 pt-3 pb-1 text-xs text-muted hover:text-text">Today's meals</Link>
      <ul className="divide-y divide-border px-4">
        {rows.map((r) => (
          <li key={r.name}>
            {r.count > 0 ? (
              <Link to="/log" className="flex items-center justify-between py-2.5 text-sm">
                <span>{r.name}</span>
                <span className="text-muted">{kcalFmt(r.kcal)} kcal</span>
              </Link>
            ) : (
              <Link to={`/log?add=${r.i}`} aria-label={`Add food to ${r.name.toLowerCase()}`} className="flex items-center justify-between py-2.5 text-sm text-muted hover:text-text">
                <span>{r.name}</span>
                <Plus size={16} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TodayMeals;
