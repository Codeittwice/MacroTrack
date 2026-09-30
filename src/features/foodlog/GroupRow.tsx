import { useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import type { LogEntry } from '@/db/types';
import { ungroupLogEntries } from '@/lib/log/actions';
import { EntryRow } from './EntryRow';
import { fmtG, fmtKcal } from './format';

/** Log entries of one group (a saved meal) as a single row; expand to edit the ingredients. */
export function GroupRow({ entries, onEditEntry }: { entries: LogEntry[]; onEditEntry: (entry: LogEntry) => void }) {
  const [open, setOpen] = useState(false);
  const first = entries[0];
  const total = (key: 'kcal' | 'protein' | 'carbs' | 'fat') => entries.reduce((t, e) => t + e.nutrients[key], 0);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${first.groupName ?? 'Meal'}, ${entries.length} items`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="shrink-0 text-muted" />
            <span className="truncate font-medium">{first.groupName ?? 'Meal'}</span>
          </div>
          <div className="text-xs text-muted">{entries.length} item{entries.length === 1 ? '' : 's'} · {fmtG(entries.reduce((t, e) => t + e.grams, 0))} g</div>
          <div className="mt-0.5 text-xs text-muted">P {fmtG(total('protein'))} · C {fmtG(total('carbs'))} · F {fmtG(total('fat'))}</div>
        </div>
        <div className="shrink-0 text-sm font-medium text-kcal">{fmtKcal(total('kcal'))}</div>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mb-2 ml-4 border-l border-border pl-2">
          {entries.map((e) => <EntryRow key={e.id} entry={e} onClick={() => onEditEntry(e)} />)}
          <button type="button" onClick={() => void ungroupLogEntries(first.groupId!)} className="px-2 py-1.5 text-xs text-muted hover:text-text">
            Show as separate items
          </button>
        </div>
      )}
    </div>
  );
}

/** Splits a meal's entries into single entries and groups, in logged order. */
export function toRows(entries: LogEntry[]): ({ kind: 'entry'; entry: LogEntry } | { kind: 'group'; id: string; entries: LogEntry[] })[] {
  const rows: ({ kind: 'entry'; entry: LogEntry } | { kind: 'group'; id: string; entries: LogEntry[] })[] = [];
  const groups = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    if (!entry.groupId) {
      rows.push({ kind: 'entry', entry });
      continue;
    }
    const existing = groups.get(entry.groupId);
    if (existing) existing.push(entry);
    else {
      const list = [entry];
      groups.set(entry.groupId, list);
      rows.push({ kind: 'group', id: entry.groupId, entries: list });
    }
  }
  return rows;
}
