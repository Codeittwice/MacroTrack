import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DateKey, LogEntry } from '@/db/types';
import { addDays, fromDateKey, today } from '@/lib/utils/date';
import { useSettings, useTargets } from '@/app/hooks';
import { useDayEntries, useDayTotals } from '@/lib/log/queries';
import { useDayNote } from '@/lib/log/actions';
import { AddFoodSheet, FoodDetailSheet } from '@/features/addfood';
import { DateHeader } from './DateHeader';
import { DaySummary } from './DaySummary';
import { MealCard } from './MealCard';
import { MicrosPanel } from './MicrosPanel';
import { DayMenu } from './DayMenu';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(raw: string | undefined): DateKey {
  if (!raw || !DATE_RE.test(raw)) return today();
  const d = fromDateKey(raw);
  if (Number.isNaN(d.getTime())) return today();
  return raw;
}

export default function FoodLogPage() {
  const params = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = validDate(params.date);

  const settings = useSettings();
  const mealNames = settings.mealNames;
  const targets = useTargets(date);
  const entries = useDayEntries(date);
  const totals = useDayTotals(date);
  const note = useDayNote(date);

  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<number | null>(null);
  const [addTab, setAddTab] = useState<string | undefined>();
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const sheetOpen = dayMenuOpen || addMeal !== null || editEntry !== null;

  // ?add=<mealIndex> deep link.
  useEffect(() => {
    const raw = searchParams.get('add');
    if (raw === null) return;
    const n = Number(raw);
    if (Number.isNaN(n)) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
      return;
    }
    const clamped = Math.min(Math.max(Math.trunc(n), 0), Math.max(0, mealNames.length - 1));
    setAddMeal(clamped);
    setAddTab(searchParams.get('tab') ?? undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    next.delete('tab');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount/param change
  }, [searchParams]);

  const goto = (d: DateKey) => navigate(d === today() ? '/log' : `/log/${d}`);

  const byMeal = useMemo(() => {
    const map = new Map<number, LogEntry[]>();
    for (const e of entries ?? []) {
      const arr = map.get(e.meal) ?? [];
      arr.push(e);
      map.set(e.meal, arr);
    }
    return map;
  }, [entries]);

  const otherEntries = useMemo(
    () => [...byMeal.entries()].filter(([m]) => m < 0 || m >= mealNames.length).flatMap(([, es]) => es),
    [byMeal, mealNames.length],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (sheetOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [role="dialog"]')) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || sheetOpen) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      goto(dx < 0 ? addDays(date, 1) : addDays(date, -1));
    }
  };

  return (
    <div ref={containerRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="mx-auto flex max-w-2xl flex-col gap-4">
      <DateHeader date={date} onChange={goto} onMenu={() => setDayMenuOpen(true)} />

      {note?.incomplete && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          This day is marked incomplete and excluded from the expenditure estimate.
        </div>
      )}
      {note?.text && <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{note.text}</div>}

      <DaySummary totals={totals} targets={targets} />

      {entries === undefined ? (
        <div className="flex flex-col gap-4">
          {mealNames.map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mealNames.map((name, i) => (
            <MealCard
              key={i}
              date={date}
              meal={i}
              mealName={name}
              mealNames={mealNames}
              entries={byMeal.get(i) ?? []}
              onAddFood={() => setAddMeal(i)}
              onEditEntry={setEditEntry}
            />
          ))}
          {otherEntries.length > 0 && (
            <MealCard
              date={date}
              meal={otherEntries[0].meal}
              mealName="Other"
              mealNames={mealNames}
              entries={otherEntries}
              onAddFood={() => setAddMeal(0)}
              onEditEntry={setEditEntry}
            />
          )}
        </div>
      )}

      <MicrosPanel totals={totals} />

      <DayMenu open={dayMenuOpen} onClose={() => setDayMenuOpen(false)} date={date} note={note} />

      <AddFoodSheet open={addMeal !== null} onClose={() => { setAddMeal(null); setAddTab(undefined); }} date={date} meal={addMeal ?? 0} initialTab={addTab} />

      <FoodDetailSheet
        open={editEntry !== null}
        onClose={() => setEditEntry(null)}
        entry={editEntry ?? undefined}
        date={editEntry?.date ?? date}
        meal={editEntry?.meal ?? 0}
        onDone={() => setEditEntry(null)}
      />
    </div>
  );
}
