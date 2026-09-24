import { useRef } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';
import type { DateKey } from '@/db/types';
import { addDays, today, toDateKey, fromDateKey } from '@/lib/utils/date';

function dayLabel(date: DateKey): string {
  const t = today();
  if (date === t) return 'Today';
  if (date === addDays(t, -1)) return 'Yesterday';
  if (date === addDays(t, 1)) return 'Tomorrow';
  return fromDateKey(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function DateHeader({ date, onChange, onMenu }: { date: DateKey; onChange: (d: DateKey) => void; onMenu: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isToday = date === today();

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      try {
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker!();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={20} />
      </Button>

      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          className="rounded-lg px-2 py-1 text-base font-semibold hover:bg-surface-2"
        >
          {dayLabel(date)}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value as DateKey)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden
          tabIndex={-1}
        />
        {!isToday && (
          <Button variant="secondary" size="sm" onClick={() => onChange(toDateKey())}>
            Today
          </Button>
        )}
      </div>

      <Button variant="ghost" size="sm" aria-label="Next day" onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight size={20} />
      </Button>
      <Button variant="ghost" size="sm" aria-label="Day options" onClick={onMenu}>
        <MoreHorizontal size={20} />
      </Button>
    </div>
  );
}
