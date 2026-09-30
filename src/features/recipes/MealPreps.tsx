import { useState } from 'react';
import { ChefHat, RotateCcw, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { db } from '@/db/schema';
import { createBatch, deleteBatch, finishBatch, fmtPortions, isOpen, reopenBatch, useBatchStatuses, type BatchStatus } from '@/lib/batches/actions';
import { fromDateKey } from '@/lib/utils/date';
import { fmtG } from '@/features/addfood/format';

function cookedLabel(date: string): string {
  return fromDateKey(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function PrepRow({ status }: { status: BatchStatus }) {
  const [confirm, setConfirm] = useState(false);
  const { batch, remainingPortions, remainingGrams } = status;
  const open = isOpen(status);
  const pct = Math.max(0, Math.min(100, (remainingGrams / batch.yieldGrams) * 100));
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{batch.name}</div>
          <div className="text-xs text-muted">Cooked {cookedLabel(batch.cookedOn)} · {fmtPortions(batch.portions)} portions · {fmtG(batch.yieldGrams)} g</div>
        </div>
        <span className={open ? 'text-sm font-medium text-primary' : 'text-sm text-muted'}>{open ? `${fmtPortions(remainingPortions)} left` : 'Finished'}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${open ? pct : 0}%` }} /></div>
      <div className="flex flex-wrap gap-2">
        {open
          ? <Button size="sm" variant="secondary" onClick={() => void finishBatch(batch.id)}>Mark eaten or thrown away</Button>
          : <Button size="sm" variant="ghost" onClick={() => void reopenBatch(batch.id)}>Reopen</Button>}
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            const recipe = await db.recipes.get(batch.recipeId);
            if (recipe) await createBatch({ recipe, portions: batch.portions, yieldGrams: batch.yieldGrams });
          }}
        ><RotateCcw size={14} /> Cook again</Button>
        <Button size="sm" variant="ghost" aria-label={`Delete ${batch.name}`} onClick={() => { if (!confirm) { setConfirm(true); return; } void deleteBatch(batch.id); }}>
          <Trash2 size={14} /> {confirm ? 'Tap again to delete' : 'Delete'}
        </Button>
      </div>
    </Card>
  );
}

/** Cooked batches: what is left of each, newest first, finished ones below. */
export function MealPreps() {
  const statuses = useBatchStatuses();
  if (statuses === undefined) return <div className="py-8 text-center text-sm text-muted">Loading...</div>;
  if (statuses.length === 0) {
    return <EmptyState icon={<ChefHat size={32} />} title="No meal preps yet" body='Describe a batch you cooked under Add food → Describe meal (e.g. "makes 4 portions") and save it as a meal prep. What is left shows up here and under Leftovers.' />;
  }
  const open = statuses.filter(isOpen);
  const done = statuses.filter((s) => !isOpen(s)).slice(0, 10);
  return (
    <div className="flex flex-col gap-2">
      {open.map((s) => <PrepRow key={s.batch.id} status={s} />)}
      {done.length > 0 && <h3 className="mt-3 px-1 text-sm font-medium text-muted">Finished</h3>}
      {done.map((s) => <PrepRow key={s.batch.id} status={s} />)}
    </div>
  );
}
