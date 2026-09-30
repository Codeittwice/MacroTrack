import { useState } from 'react';
import { ChefHat, SlidersHorizontal } from 'lucide-react';
import { Button, NumberInput, Segmented } from '@/components/ui';
import type { DateKey } from '@/db/types';
import { fmtPortions, logFromBatch, useLeftovers, type BatchStatus } from '@/lib/batches/actions';
import { fmtG } from './format';

function LeftoverRow({ status, date, meal, onLogged }: { status: BatchStatus; date: DateKey; meal: number; onLogged: () => void }) {
  const [custom, setCustom] = useState(false);
  const [unit, setUnit] = useState<'portions' | 'grams'>('portions');
  const [amount, setAmount] = useState<number | undefined>(1);
  const [busy, setBusy] = useState(false);
  const { batch, remainingGrams, remainingPortions, gramsPerPortion } = status;
  // Tapping takes one portion, or whatever is left when less than one remains.
  const onePortion = Math.min(1, remainingPortions);

  const log = async (value: { portions?: number; grams?: number }) => {
    setBusy(true);
    try {
      await logFromBatch(batch, date, meal, value);
      onLogged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void log({ portions: onePortion })} aria-label={`Log ${fmtPortions(onePortion)} portion of ${batch.name}`} className="min-w-0 flex-1 text-left disabled:opacity-50">
          <div className="truncate font-medium">{batch.name}</div>
          <div className="text-xs text-muted">{fmtPortions(remainingPortions)} of {fmtPortions(batch.portions)} portions left · {fmtG(remainingGrams)} g · 1 portion ≈ {fmtG(gramsPerPortion)} g</div>
        </button>
        <button type="button" aria-label={`Choose amount of ${batch.name}`} aria-expanded={custom} onClick={() => setCustom((v) => !v)} className="rounded-lg p-2 text-muted hover:bg-surface"><SlidersHorizontal size={16} /></button>
      </div>
      {custom && (
        <div className="mt-2 flex items-center gap-2">
          <Segmented options={[{ value: 'portions', label: 'Portions' }, { value: 'grams', label: 'Grams' }]} value={unit} onChange={(u) => { setUnit(u); setAmount(u === 'grams' ? Math.round(gramsPerPortion) : 1); }} />
          <NumberInput aria-label={`Amount of ${batch.name}`} value={amount} onValue={setAmount} suffix={unit === 'grams' ? 'g' : undefined} className="w-24" />
          <Button size="sm" variant="primary" disabled={busy || !amount || amount <= 0} onClick={() => void log(unit === 'grams' ? { grams: amount } : { portions: amount })}>Add</Button>
        </div>
      )}
    </div>
  );
}

/** Open meal-prep batches, one tap to log a portion. Renders nothing when there are none. */
export function LeftoversStrip({ date, meal, onLogged, className = 'mb-4' }: { date: DateKey; meal: number; onLogged: () => void; className?: string }) {
  const leftovers = useLeftovers();
  if (!leftovers?.length) return null;
  return (
    <section aria-label="Leftovers" className={className}>
      <h3 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-medium text-muted"><ChefHat size={15} /> Leftovers</h3>
      <div className="flex flex-col gap-1.5">
        {leftovers.map((status) => <LeftoverRow key={status.batch.id} status={status} date={date} meal={meal} onLogged={onLogged} />)}
      </div>
    </section>
  );
}
