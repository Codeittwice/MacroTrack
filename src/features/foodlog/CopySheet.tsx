import { useState } from 'react';
import { Button, Label, Segmented, Sheet } from '@/components/ui';
import type { DateKey } from '@/db/types';

/** Sheet for "copy to another date/meal" flows (used for both single-meal and whole-day copies). */
export function CopySheet({
  open, onClose, title, defaultDate, mealNames, defaultMeal = 0, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultDate: DateKey;
  /** When provided, a meal selector is shown and passed to onConfirm. */
  mealNames?: string[];
  defaultMeal?: number;
  onConfirm: (date: DateKey, meal: number) => Promise<number>;
}) {
  const [date, setDate] = useState(defaultDate);
  const [meal, setMeal] = useState(defaultMeal);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setDate(defaultDate);
    setMeal(defaultMeal);
    setStatus(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const count = await onConfirm(date, meal);
      setStatus(count > 0 ? `Copied ${count} item${count === 1 ? '' : 's'}` : 'Nothing to copy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-4">
        <div>
          <Label>Date</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value as DateKey)}
            className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-primary"
          />
        </div>
        {mealNames && (
          <div>
            <Label>Meal</Label>
            <Segmented
              options={mealNames.map((n, i) => ({ value: i, label: n }))}
              value={meal}
              onChange={setMeal}
            />
          </div>
        )}
        {status && <div className="text-sm text-muted">{status}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>Close</Button>
          <Button variant="primary" disabled={busy} onClick={confirm}>Copy</Button>
        </div>
      </div>
    </Sheet>
  );
}
