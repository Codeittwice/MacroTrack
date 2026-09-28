import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, Input, Label, Segmented, Sheet, cx } from '@/components/ui';
import type { Equipment, ExerciseDef, Muscle } from '@/db/types';
import { allExercises, createCustomExercise, searchExercises, useCustomExercises } from '@/lib/training/actions';
import { MUSCLE_LABEL, MUSCLES } from '@/lib/training/exercises';

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'cardio', 'other'];

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (def: ExerciseDef) => void }) {
  const custom = useCustomExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [creating, setCreating] = useState(false);
  const results = useMemo(() => searchExercises(allExercises(custom), query, muscle || undefined).slice(0, 60), [custom, query, muscle]);

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'New exercise' : 'Add exercise'}>
      {creating ? (
        <CustomExerciseForm initialName={query} onCancel={() => setCreating(false)} onCreated={(def) => { setCreating(false); onPick(def); }} />
      ) : (
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input autoFocus aria-label="Search exercises" placeholder="Search exercises, e.g. bankdrukken" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </label>
          <select aria-label="Filter by muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')} className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm">
            <option value="">All muscles</option>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>)}
          </select>
          <div className="max-h-[50dvh] divide-y divide-border overflow-y-auto">
            {results.map((e) => (
              <button key={e.id} type="button" onClick={() => onPick(e)} className="flex w-full flex-col items-start py-2.5 text-left hover:bg-surface-2">
                <span className="font-medium">{e.name}{e.id.startsWith('custom:') && <span className="ml-2 rounded bg-surface-2 px-1.5 text-[10px] text-muted">Mine</span>}</span>
                <span className="text-xs text-muted">{e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}{e.secondary.length ? ` · also ${e.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}</span>
              </button>
            ))}
            {results.length === 0 && <p className="py-6 text-center text-sm text-muted">No exercises found.</p>}
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={16} /> Create custom exercise</Button>
        </div>
      )}
    </Sheet>
  );
}

function CustomExerciseForm({ initialName, onCancel, onCreated }: { initialName: string; onCancel: () => void; onCreated: (def: ExerciseDef) => void }) {
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState<Equipment>('machine');
  const [kind, setKind] = useState<ExerciseDef['kind']>('strength');
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [error, setError] = useState<string>();

  const toggle = (m: Muscle) => {
    if (primary.includes(m)) { setPrimary(primary.filter((x) => x !== m)); setSecondary([...secondary, m]); }
    else if (secondary.includes(m)) setSecondary(secondary.filter((x) => x !== m));
    else setPrimary([...primary, m]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div><Label>Name</Label><Input aria-label="Exercise name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine press" /></div>
      <div><Label>Type</Label><Segmented options={[{ value: 'strength', label: 'Weights' }, { value: 'bodyweight', label: 'Bodyweight' }, { value: 'cardio', label: 'Cardio' }]} value={kind} onChange={setKind} /></div>
      <div>
        <Label>Equipment</Label>
        <select aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm">
          {EQUIPMENT.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <Label hint="tap once for main, twice for helper">Muscles</Label>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLES.map((m) => (
            <button key={m} type="button" onClick={() => toggle(m)} aria-label={`${MUSCLE_LABEL[m]}: ${primary.includes(m) ? 'main' : secondary.includes(m) ? 'helper' : 'not used'}`}
              className={cx('rounded-lg border px-2 py-1 text-xs', primary.includes(m) ? 'border-primary bg-primary text-on-primary' : secondary.includes(m) ? 'border-primary text-primary' : 'border-border text-muted')}>
              {MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onCancel}>Back</Button>
        <Button variant="primary" onClick={async () => { try { onCreated(await createCustomExercise({ name, equipment, kind, primary, secondary, met: kind === 'cardio' ? 6 : kind === 'bodyweight' ? 4.5 : 5 })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the exercise.'); } }}>Create and add</Button>
      </div>
    </div>
  );
}
