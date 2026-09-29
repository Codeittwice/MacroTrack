import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Copy, Flame, Plus, Save, Timer, Trash2, Trophy, X } from 'lucide-react';
import { Button, Card, Input, NumberInput, PageHeader, cx } from '@/components/ui';
import { MuscleMap } from '@/components/MuscleMap';
import type { Muscle, Workout } from '@/db/types';
import { useTrend } from '@/lib/weight/queries';
import { useSettings } from '@/app/hooks';
import {
  addExercise, addSet, deleteWorkout, finishWorkout, moveExercise, removeExercise, removeSet, repeatWorkout, saveTemplate,
  updateSet, updateWorkoutMeta, useExerciseLookup, useWorkout, useWorkouts,
} from '@/lib/training/actions';
import { estimatedBurnKcal, newRecordsIn, previousSets } from '@/lib/training/strength';
import { hardSetCount, setsByMuscle, volumeLoad } from '@/lib/training/volume';
import { ExercisePicker } from './ExercisePicker';
import { fmtClock, fmtDate, fmtDuration, fmtKg } from './format';

const REST_OPTIONS = [60, 90, 120, 180];

export function WorkoutPage() {
  const { id } = useParams();
  const workout = useWorkout(id);
  if (workout === undefined) return <div className="py-10 text-center text-sm text-muted">Loading workout…</div>;
  if (workout === null || workout.deletedAt) return <div className="py-10 text-center text-sm text-muted">This workout no longer exists.</div>;
  return workout.finishedAt ? <WorkoutSummary workout={workout} /> : <ActiveWorkout workout={workout} />;
}

function ActiveWorkout({ workout }: { workout: Workout }) {
  const nav = useNavigate();
  const lookup = useExerciseLookup();
  const history = useWorkouts();
  const [picker, setPicker] = useState(false);
  const [restFor, setRestFor] = useState(() => Number(localStorageGet('mt-rest') ?? 90));
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const now = useNow(1000);
  const restLeft = restEnd ? Math.max(0, (restEnd - now) / 1000) : 0;

  useEffect(() => {
    if (restEnd && restLeft <= 0) {
      setRestEnd(null);
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [restEnd, restLeft]);

  const completeSet = async (ex: number, set: number, done: boolean) => {
    await updateSet(workout.id, ex, set, { done });
    // Rest timer only between strength sets, not after a run or a match.
    if (done && lookup(workout.exercises[ex].exerciseId)?.kind !== 'cardio') setRestEnd(Date.now() + restFor * 1000);
  };

  const anyDone = workout.exercises.some((e) => e.sets.some((s) => s.done));

  return (
    <div className={cx('mx-auto flex max-w-2xl flex-col gap-4', restEnd ? 'pb-44' : 'pb-24')}>
      <PageHeader
        title={<Input aria-label="Workout name" value={workout.name} onChange={(e) => void updateWorkoutMeta(workout.id, { name: e.target.value })} className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold" />}
        right={<span className="flex items-center gap-1 text-sm text-muted"><Timer size={16} /> {fmtClock((now - workout.startedAt) / 1000)}</span>}
      />

      {workout.exercises.map((ex, exIndex) => {
        const prev = history ? previousSets(history, ex.exerciseId, workout.startedAt) : undefined;
        const isCardio = lookup(ex.exerciseId)?.kind === 'cardio';
        return (
          <Card key={`${ex.exerciseId}-${exIndex}`}>
            <div className="mb-2 flex items-center gap-1">
              <div className="min-w-0 flex-1 font-semibold">{ex.name}</div>
              <IconBtn label={`Move ${ex.name} up`} onClick={() => void moveExercise(workout.id, exIndex, -1)}><ArrowUp size={16} /></IconBtn>
              <IconBtn label={`Move ${ex.name} down`} onClick={() => void moveExercise(workout.id, exIndex, 1)}><ArrowDown size={16} /></IconBtn>
              <IconBtn label={`Remove ${ex.name}`} onClick={() => void removeExercise(workout.id, exIndex)}><Trash2 size={16} /></IconBtn>
            </div>
            <div className="grid grid-cols-[2.2rem_1fr_1fr_1fr_2.5rem_1.8rem] items-center gap-2 text-xs text-muted">
              <span>Set</span><span>Last time</span>{isCardio ? <span className="col-span-2">Duration</span> : <><span>kg</span><span>Reps</span></>}<span className="text-center">Done</span><span />
            </div>
            {ex.sets.map((s, si) => {
              const hint = prev?.[si];
              const label = `${ex.name} set ${si + 1}`;
              return (
                <div key={si} className={cx('mt-1.5 grid grid-cols-[2.2rem_1fr_1fr_1fr_2.5rem_1.8rem] items-center gap-2 rounded-lg', s.done && 'bg-surface-2')}>
                  <button type="button" aria-label={`${label}: ${s.type === 'warmup' ? 'warm-up, tap for working set' : 'working set, tap for warm-up'}`} onClick={() => void updateSet(workout.id, exIndex, si, { type: s.type === 'warmup' ? 'working' : 'warmup' })} className={cx('h-9 rounded-lg text-sm font-medium', s.type === 'warmup' ? 'text-warning' : 'text-text')}>
                    {s.type === 'warmup' ? 'W' : si + 1 - ex.sets.slice(0, si).filter((x) => x.type === 'warmup').length}
                  </button>
                  <span className="truncate text-xs text-muted">{hint ? (isCardio ? `${Math.round((hint.durationSec ?? 0) / 60)} min` : `${hint.kg ?? 0} × ${hint.reps ?? 0}`) : '—'}</span>
                  {isCardio ? (
                    <NumberInput aria-label={`${label} minutes`} value={s.durationSec === undefined ? undefined : Math.round(s.durationSec / 60)} onValue={(min) => void updateSet(workout.id, exIndex, si, { durationSec: min === undefined ? undefined : Math.round(min * 60) })} placeholder={hint?.durationSec ? String(Math.round(hint.durationSec / 60)) : 'min'} suffix="min" className="col-span-2 [&_input]:h-9 [&_input]:px-2" />
                  ) : (
                    <>
                      <NumberInput aria-label={`${label} weight`} value={s.kg} onValue={(kg) => void updateSet(workout.id, exIndex, si, { kg })} placeholder={hint?.kg !== undefined ? String(hint.kg) : 'kg'} className="[&_input]:h-9 [&_input]:px-2" />
                      <NumberInput aria-label={`${label} reps`} value={s.reps} onValue={(reps) => void updateSet(workout.id, exIndex, si, { reps: reps === undefined ? undefined : Math.round(reps) })} placeholder={hint?.reps !== undefined ? String(hint.reps) : 'reps'} className="[&_input]:h-9 [&_input]:px-2" />
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={`${s.done ? 'Undo' : 'Complete'} ${label}`}
                    aria-pressed={s.done}
                    onClick={() => void completeSet(exIndex, si, !s.done)}
                    className={cx('mx-auto flex h-9 w-9 items-center justify-center rounded-lg border', s.done ? 'border-primary bg-primary text-on-primary' : 'border-border')}
                  >
                    <Check size={18} />
                  </button>
                  <IconBtn label={`Delete ${label}`} onClick={() => void removeSet(workout.id, exIndex, si)}><X size={14} /></IconBtn>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => void addSet(workout.id, exIndex)}><Plus size={16} /> Add set</Button>
          </Card>
        );
      })}

      <Button size="lg" onClick={() => setPicker(true)}><Plus size={18} /> Add exercise</Button>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="danger" onClick={async () => { if (confirm('Discard this workout?')) { await deleteWorkout(workout.id); nav('/training'); } }}>Discard</Button>
        <Button variant="primary" disabled={!anyDone} onClick={() => void finishWorkout(workout.id)}><Check size={18} /> Finish workout</Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted">
        Rest timer
        {REST_OPTIONS.map((sec) => (
          <button key={sec} type="button" aria-pressed={restFor === sec} onClick={() => { setRestFor(sec); localStorageSet('mt-rest', String(sec)); }} className={cx('rounded-lg px-2 py-1', restFor === sec ? 'bg-surface-2 text-text' : 'hover:bg-surface-2')}>{fmtClock(sec)}</button>
        ))}
      </div>

      {restEnd && (
        <div role="timer" aria-label="Rest timer" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-[min(92vw,28rem)] items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg md:bottom-6">
          <Timer size={20} className="text-primary" />
          <div className="flex-1"><div className="text-xs text-muted">Rest</div><div className="text-xl font-semibold tabular-nums">{fmtClock(restLeft)}</div></div>
          <Button size="sm" onClick={() => setRestEnd((e) => (e ? e + 30_000 : e))}>+30 s</Button>
          <Button size="sm" variant="ghost" onClick={() => setRestEnd(null)}>Skip</Button>
        </div>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(def) => { void addExercise(workout.id, def, def.kind === 'cardio' ? 1 : 3); setPicker(false); }} />
    </div>
  );
}

function WorkoutSummary({ workout }: { workout: Workout }) {
  const nav = useNavigate();
  const settings = useSettings();
  const history = useWorkouts();
  const lookup = useExerciseLookup();
  const trend = useTrend();
  const [templateName, setTemplateName] = useState(workout.name);
  const [saved, setSaved] = useState(false);
  const records = useMemo(() => (history ? newRecordsIn(workout, history) : []), [workout, history]);
  const muscles = useMemo(() => Object.fromEntries(Object.entries(setsByMuscle([workout], lookup)).map(([m, v]) => [m, v?.sets ?? 0])) as Partial<Record<Muscle, number>>, [workout, lookup]);
  const burn = trend?.latestTrendKg ? estimatedBurnKcal(workout, trend.latestTrendKg, lookup) : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={workout.name} right={<span className="text-sm text-muted">{fmtDate(workout.date)}</span>} />
      <div className="grid grid-cols-3 gap-3">
        <Card><div className="text-xs text-muted">Duration</div><div className="text-lg font-semibold">{fmtDuration(workout.finishedAt! - workout.startedAt)}</div></Card>
        <Card><div className="text-xs text-muted">Sets</div><div className="text-lg font-semibold">{hardSetCount(workout)}</div></Card>
        <Card><div className="text-xs text-muted">Volume</div><div className="text-lg font-semibold">{fmtKg(volumeLoad(workout))} kg</div></Card>
      </div>

      {records.length > 0 && (
        <Card>
          <div className="mb-1 flex items-center gap-2 font-semibold"><Trophy size={18} className="text-warning" /> New records</div>
          {records.map((r) => <div key={r.exerciseId} className="text-sm">{r.name}: {r.kind === 'heaviest' ? 'heaviest weight' : 'best estimated 1RM'}</div>)}
        </Card>
      )}

      <Card>
        <div className="mb-2 font-semibold">Muscles worked</div>
        {/* One session is roughly a third of a week's volume: scale colours so 4 sets looks well trained. */}
        <MuscleMap sets={muscles} compact colorScale={2.5} />
      </Card>

      <Card>
        {workout.exercises.map((ex) => (
          <div key={ex.exerciseId} className="border-b border-border py-2 last:border-0">
            <button type="button" className="font-medium hover:underline" onClick={() => nav(`/training/exercise/${ex.exerciseId}`)}>{ex.name}</button>
            <div className="text-sm text-muted">{ex.sets.map((s) => (s.durationSec ? `${Math.round(s.durationSec / 60)} min` : `${s.type === 'warmup' ? 'W ' : ''}${s.kg ?? 0} × ${s.reps ?? 0}`)).join(' · ')}</div>
          </div>
        ))}
      </Card>

      {burn > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted"><Flame size={16} className="mt-0.5 shrink-0" />
          {settings.exerciseCalories === 'off'
            ? `About ${burn} kcal burned (net). Not added to today's budget because your targets already adapt to your real expenditure; change this under Settings → Exercise calories.`
            : `About ${burn} kcal burned (net). ${settings.exerciseCalories === 'half' ? 'Half of it' : 'All of it'} is added to today's calorie target as carbs.`}
        </p>
      )}

      <Card>
        <div className="mb-2 font-semibold">Save as template</div>
        <div className="flex gap-2">
          <Input aria-label="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          <Button disabled={saved || !templateName.trim()} onClick={async () => { await saveTemplate(workout, templateName); setSaved(true); }}><Save size={16} /> {saved ? 'Saved' : 'Save'}</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={async () => { const w = await repeatWorkout(workout); nav(`/training/workout/${w.id}`); }}><Copy size={16} /> Repeat workout</Button>
        <Button variant="danger" onClick={async () => { if (confirm('Delete this workout?')) { await deleteWorkout(workout.id); nav('/training'); } }}><Trash2 size={16} /> Delete</Button>
      </div>
      <Button variant="ghost" onClick={() => nav('/training')}>Back to training</Button>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="rounded-lg p-1.5 text-muted hover:bg-surface-2">{children}</button>;
}

function useNow(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}

function localStorageGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
