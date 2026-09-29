import { useEffect, useState } from 'react';
import { Pill, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Input, Label, NumberInput, PageHeader, Sheet } from '@/components/ui';
import type { Supplement } from '@/db/types';
import { adherence, createSupplement, deleteSupplement, updateSupplement, useSupplements, type SupplementInput } from '@/lib/supplements/actions';
import { addDays, today } from '@/lib/utils/date';
import { SupplementChecklist } from './SupplementChecklist';

const UNITS = ['g', 'mg', 'µg', 'IU', 'ml', 'capsules', 'tablets', 'scoops'];

export default function SupplementsPage() {
  const supplements = useSupplements();
  const [editing, setEditing] = useState<Supplement | 'new' | null>(null);
  if (supplements === undefined) return <div className="py-10 text-center text-sm text-muted">Loading supplements…</div>;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Supplements" right={<Button variant="primary" size="sm" onClick={() => setEditing('new')}><Plus size={16} /> Add</Button>} />
      {supplements.length === 0 ? (
        <EmptyState icon={<Pill size={32} />} title="Track your supplements" body="Add creatine, vitamin D, protein powder and more. Tick them off each day, get reminders, and protein powder counts toward your macros." action={<Button variant="primary" onClick={() => setEditing('new')}><Plus size={18} /> Add supplement</Button>} />
      ) : (
        <>
          <SupplementChecklist title="Today" />
          {supplements.map((s) => <SupplementCard key={s.id} s={s} onEdit={() => setEditing(s)} />)}
        </>
      )}
      <SupplementSheet open={editing !== null} supplement={editing === 'new' ? undefined : editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  );
}

function SupplementCard({ s, onEdit }: { s: Supplement; onEdit: () => void }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adherence>>>();
  useEffect(() => { void adherence(s, today(), 30).then(setStats); }, [s]);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29));
  return (
    <Card onClick={onEdit}>
      <div className="flex items-baseline justify-between gap-3">
        <div><div className="font-medium">{s.name}</div><div className="text-sm text-muted">{s.dose} {s.unit}{s.timesPerDay > 1 ? ` × ${s.timesPerDay} a day` : ' a day'}{s.reminderTime ? ` · reminder ${s.reminderTime}` : ''}{s.nutrients ? ` · ${Math.round(s.nutrients.kcal)} kcal per dose` : ''}</div></div>
        {stats && <div className="text-right text-sm"><div className="font-semibold">{stats.pct}%</div><div className="text-xs text-muted">{stats.streak}-day streak</div></div>}
      </div>
      {stats && (
        <div className="mt-3 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5" aria-label={`Last 30 days: ${stats.pct}% of doses taken`}>
          {days.map((d) => {
            const n = Math.min(stats.byDay[d] ?? 0, s.timesPerDay);
            return <span key={d} title={d} className="h-3 rounded-sm" style={{ background: n === 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--primary) ${Math.round(35 + (65 * n) / s.timesPerDay)}%, var(--surface-2))` }} />;
          })}
        </div>
      )}
    </Card>
  );
}

function SupplementSheet({ open, supplement, onClose }: { open: boolean; supplement?: Supplement; onClose: () => void }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState<number | undefined>();
  const [unit, setUnit] = useState('g');
  const [times, setTimes] = useState<number | undefined>(1);
  const [reminder, setReminder] = useState('');
  const [counts, setCounts] = useState(false);
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(supplement?.name ?? ''); setDose(supplement?.dose); setUnit(supplement?.unit ?? 'g'); setTimes(supplement?.timesPerDay ?? 1);
    setReminder(supplement?.reminderTime ?? ''); setCounts(!!supplement?.nutrients); setKcal(supplement?.nutrients?.kcal);
    setProtein(supplement?.nutrients?.protein); setCarbs(supplement?.nutrients?.carbs); setFat(supplement?.nutrients?.fat); setError(undefined);
  }, [open, supplement]);

  const save = async () => {
    const input: SupplementInput = {
      name, dose: dose ?? 0, unit, timesPerDay: times ?? 1, active: true,
      reminderTime: reminder || undefined,
      nutrients: counts ? { kcal: kcal ?? 0, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 } : undefined,
    };
    try {
      if (supplement) await updateSupplement(supplement.id, input); else await createSupplement(input);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={supplement ? 'Edit supplement' : 'Add supplement'}>
      <div className="flex flex-col gap-4">
        <div><Label>Name</Label><Input aria-label="Supplement name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Creatine monohydrate" autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Dose</Label><NumberInput aria-label="Dose" value={dose} onValue={setDose} placeholder="5" /></div>
          <div><Label>Unit</Label><select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Times per day</Label><NumberInput aria-label="Times per day" value={times} onValue={(v) => setTimes(v === undefined ? undefined : Math.round(v))} /></div>
          <div><Label hint="optional">Reminder</Label><Input aria-label="Reminder time" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} /></div>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span><span className="block font-medium">Counts toward my food log</span><span className="block text-sm text-muted">For protein powder, gainers or anything with calories.</span></span>
          <input aria-label="Counts toward my food log" type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
        </label>
        {counts && (
          <div className="grid grid-cols-4 gap-2">
            <div><Label>kcal</Label><NumberInput aria-label="Calories per dose" value={kcal} onValue={setKcal} /></div>
            <div><Label>Protein</Label><NumberInput aria-label="Protein per dose" value={protein} onValue={setProtein} suffix="g" /></div>
            <div><Label>Carbs</Label><NumberInput aria-label="Carbs per dose" value={carbs} onValue={setCarbs} suffix="g" /></div>
            <div><Label>Fat</Label><NumberInput aria-label="Fat per dose" value={fat} onValue={setFat} suffix="g" /></div>
          </div>
        )}
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button variant="primary" size="lg" onClick={() => void save()}>{supplement ? 'Save changes' : 'Add supplement'}</Button>
        {supplement && <Button variant="danger" onClick={async () => { await deleteSupplement(supplement.id); onClose(); }}>Delete</Button>}
      </div>
    </Sheet>
  );
}

