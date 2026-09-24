import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label, NumberInput, Sheet } from '@/components/ui';
import type { DateKey } from '@/db/types';
import { today } from '@/lib/utils/date';
import { deleteWeight, fromDisplay, logWeight, toDisplay, updateWeight } from '@/lib/weight/actions';

export interface WeightSheetEntry {
  id: string;
  date: DateKey;
  kg: number;
  bodyFatPct?: number;
  note?: string;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function isValidKg(kg: number | undefined): kg is number {
  return kg !== undefined && Number.isFinite(kg) && kg >= 20 && kg <= 400;
}

export function WeightSheet({
  open,
  onClose,
  unit,
  entry,
  lastWeightKg,
}: {
  open: boolean;
  onClose: () => void;
  unit: 'kg' | 'lb';
  /** undefined = "new weigh-in" mode; provided = "edit" mode */
  entry?: WeightSheetEntry;
  /** used to prefill the weight field in "new" mode */
  lastWeightKg?: number;
}) {
  const isEdit = entry !== undefined;

  const [date, setDate] = useState<DateKey>(entry?.date ?? today());
  const [weight, setWeight] = useState<number | undefined>(() => {
    const kg = entry?.kg ?? lastWeightKg;
    return kg !== undefined ? round1(toDisplay(kg, unit)) : undefined;
  });
  const [bodyFat, setBodyFat] = useState<number | undefined>(entry?.bodyFatPct);
  const [note, setNote] = useState(entry?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kg = weight !== undefined ? fromDisplay(weight, unit) : undefined;
  const bodyFatValid = bodyFat === undefined || (Number.isFinite(bodyFat) && bodyFat > 0 && bodyFat < 75);
  const canSave = isValidKg(kg) && bodyFatValid && !saving;

  async function handleSave() {
    if (!isValidKg(kg) || !bodyFatValid) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateWeight(entry.id, { date, kg, bodyFatPct: bodyFat, note });
      } else {
        await logWeight({ date, kg, bodyFatPct: bodyFat, note: note.trim() || undefined });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteWeight(entry.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function step(delta: number) {
    setWeight((v) => round1((v ?? 0) + delta));
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? 'Edit weigh-in' : 'Log weight'}>
      <div key={entry?.id ?? 'new'} className="flex flex-col gap-4">
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <Label>Weight</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Decrease by 0.1 ${unit}`}
              onClick={() => step(-0.1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 hover:border-muted"
            >
              <Minus size={18} />
            </button>
            <NumberInput value={weight} onValue={setWeight} suffix={unit} autoFocus className="flex-1" />
            <button
              type="button"
              aria-label={`Increase by 0.1 ${unit}`}
              onClick={() => step(0.1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 hover:border-muted"
            >
              <Plus size={18} />
            </button>
          </div>
          {kg !== undefined && !isValidKg(kg) && <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>Enter a realistic weight</div>}
        </div>

        <div>
          <Label hint="Optional">Body fat</Label>
          <NumberInput value={bodyFat} onValue={setBodyFat} suffix="%" />
          {!bodyFatValid && <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>Must be between 0 and 75%</div>}
        </div>

        <div>
          <Label hint="Optional">Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after workout" />
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="primary" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </div>

        {isEdit && (
          <Button
            variant="danger"
            size="md"
            className="w-full"
            onClick={handleDelete}
            disabled={saving}
          >
            <Trash2 size={16} />
            {confirmDelete ? 'Tap again to delete' : 'Delete weigh-in'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
