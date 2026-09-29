import { Link } from 'react-router-dom';
import { Check, Pill } from 'lucide-react';
import { Card, cx } from '@/components/ui';
import { toggleTaken, useSupplementLogs, useSupplements } from '@/lib/supplements/actions';
import { today as todayFn } from '@/lib/utils/date';

/** Today's doses as tick-off chips. Renders nothing when no supplements are set up. */
export function SupplementChecklist({ title = 'Supplements', date = todayFn(), linkToPage = false }: { title?: string; date?: string; linkToPage?: boolean }) {
  const supplements = useSupplements()?.filter((s) => s.active);
  const logs = useSupplementLogs(date);
  if (!supplements?.length || !logs) return null;
  const total = supplements.reduce((n, s) => n + s.timesPerDay, 0);
  const taken = supplements.reduce((n, s) => n + Math.min(s.timesPerDay, logs.filter((l) => l.supplementId === s.id).length), 0);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold"><Pill size={18} className="text-primary" /> {title}</div>
        {linkToPage ? <Link to="/supplements" className="text-sm text-muted hover:text-text">{taken}/{total} taken</Link> : <span className="text-sm text-muted">{taken}/{total} taken</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {supplements.flatMap((s) =>
          Array.from({ length: s.timesPerDay }, (_, i) => {
            const done = logs.some((l) => l.supplementId === s.id && l.doseIndex === i);
            const label = `${s.name}${s.timesPerDay > 1 ? ` (${i + 1}/${s.timesPerDay})` : ''}`;
            return (
              <button
                key={`${s.id}-${i}`}
                type="button"
                aria-pressed={done}
                aria-label={`${done ? 'Untick' : 'Tick'} ${label}`}
                onClick={() => void toggleTaken(date, s, i)}
                className={cx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition', done ? 'border-primary bg-primary text-on-primary' : 'border-border hover:border-muted')}
              >
                {done && <Check size={14} />} {label} <span className={done ? 'opacity-80' : 'text-muted'}>{s.dose} {s.unit}</span>
              </button>
            );
          }),
        )}
      </div>
    </Card>
  );
}
