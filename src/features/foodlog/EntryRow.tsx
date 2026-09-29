import { SourceBadge } from '@/components/ui';
import type { LogEntry } from '@/db/types';
import { fmtAmount, fmtG, fmtKcal } from './format';

export function EntryRow({ entry, onClick }: { entry: LogEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Edit ${entry.name}`}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{entry.name}</span>
          <SourceBadge source={entry.source} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {entry.brand && <span className="truncate">{entry.brand}</span>}
          <span>{entry.source === 'quick' ? 'Quick add' : fmtAmount(entry.grams, entry.servingLabel)}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          P {fmtG(entry.nutrients.protein)} · C {fmtG(entry.nutrients.carbs)} · F {fmtG(entry.nutrients.fat)}
        </div>
      </div>
      <div className="shrink-0 text-sm font-medium text-kcal">{fmtKcal(entry.nutrients.kcal)}</div>
    </button>
  );
}
