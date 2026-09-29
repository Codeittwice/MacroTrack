import { useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, Play, Plus, Trash2, Trophy } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Sheet } from '@/components/ui';
import { MuscleMap, fmtSets } from '@/components/MuscleMap';
import type { Muscle } from '@/db/types';
import { deleteTemplate, startWorkout, useActiveWorkout, useExerciseLookup, useTemplates, useWorkouts } from '@/lib/training/actions';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { sessionSummary, weeklySetsByMuscle, WEEKLY_SET_TARGET } from '@/lib/training/volume';
import { useTrend } from '@/lib/weight/queries';
import { addDays, today } from '@/lib/utils/date';
import { estimatedBurnKcal, newRecordsIn } from '@/lib/training/strength';
import { WorkoutPage } from './WorkoutPage';
import { ExerciseDetail } from './ExerciseDetail';
import { fmtDate, fmtDuration } from './format';

export default function TrainingRoutes() {
  return (
    <Routes>
      <Route index element={<TrainingHome />} />
      <Route path="workout/:id" element={<WorkoutPage />} />
      <Route path="exercise/:id" element={<ExerciseDetail />} />
    </Routes>
  );
}

function TrainingHome() {
  const nav = useNavigate();
  const workouts = useWorkouts();
  const active = useActiveWorkout();
  const templates = useTemplates();
  const lookup = useExerciseLookup();
  const bodyKg = useTrend()?.latestTrendKg ?? 0;
  const summaryFor = (w: import('@/db/types').Workout) => sessionSummary(w, lookup, bodyKg ? estimatedBurnKcal(w, bodyKg, lookup) : undefined);
  const [muscle, setMuscle] = useState<Muscle>();
  const finished = useMemo(() => (workouts ?? []).filter((w) => w.finishedAt), [workouts]);
  const weekly = useMemo(() => weeklySetsByMuscle(finished, today(), lookup), [finished, lookup]);
  const weeklySets = useMemo(() => Object.fromEntries(Object.entries(weekly).map(([m, v]) => [m, v?.sets ?? 0])) as Partial<Record<Muscle, number>>, [weekly]);
  const thisWeek = finished.filter((w) => w.date > addDays(today(), -7)).length;

  const begin = async (templateId?: string) => {
    const w = await startWorkout({ template: templates?.find((t) => t.id === templateId) });
    nav(`/training/workout/${w.id}`);
  };

  if (workouts === undefined) return <div className="py-10 text-center text-sm text-muted">Loading training…</div>;
  const sel = muscle ? weekly[muscle] : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Training" right={<span className="text-sm text-muted">{thisWeek} {thisWeek === 1 ? 'workout' : 'workouts'} this week</span>} />

      {active ? (
        <Card className="flex items-center gap-3 border border-primary">
          <Dumbbell size={22} className="text-primary" />
          <div className="min-w-0 flex-1"><div className="font-medium">{active.name} in progress</div><div className="text-sm text-muted">{active.exercises.length} exercises · started {fmtDuration(Date.now() - active.startedAt)} ago</div></div>
          <Button variant="primary" onClick={() => nav(`/training/workout/${active.id}`)}><Play size={16} /> Resume</Button>
        </Card>
      ) : (
        <Button variant="primary" size="lg" onClick={() => void begin()}><Plus size={18} /> Start workout or activity</Button>
      )}

      <Card>
        <div className="mb-2 flex items-baseline justify-between"><div className="font-semibold">Muscles trained</div><div className="text-xs text-muted">hard sets, last 7 days</div></div>
        <MuscleMap sets={weeklySets} selected={muscle} onSelect={setMuscle} />
      </Card>

      <Card>
        <div className="mb-2 font-semibold">Templates</div>
        {templates && templates.length > 0 ? (
          <div className="divide-y divide-border">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><div className="font-medium">{t.name}</div><div className="truncate text-sm text-muted">{t.exercises.map((e) => e.name).join(', ')}</div></div>
                <Button size="sm" variant="primary" disabled={!!active} onClick={() => void begin(t.id)} aria-label={`Start ${t.name}`}><Play size={14} /> Start</Button>
                <button type="button" aria-label={`Delete template ${t.name}`} onClick={() => void deleteTemplate(t.id)} className="rounded-lg p-2 text-muted hover:bg-surface-2"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">Finish a workout and tap "Save as template" to reuse it here.</p>}
      </Card>

      <Card>
        <div className="mb-2 font-semibold">History</div>
        {finished.length === 0 ? (
          <EmptyState icon={<Dumbbell size={32} />} title="Log your first workout" body="Start a workout, add exercises and tick off your sets. Your muscle map fills in as you train." />
        ) : (
          <div className="divide-y divide-border">
            {finished.slice(0, 30).map((w) => (
              <Link key={w.id} to={`/training/workout/${w.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-sm text-muted">{fmtDate(w.date)} · {fmtDuration(w.finishedAt! - w.startedAt)}{summaryFor(w) ? ` · ${summaryFor(w)}` : ''}</div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={!!muscle} onClose={() => setMuscle(undefined)} title={muscle ? MUSCLE_LABEL[muscle] : ''}>
        <div className="flex flex-col gap-3">
          <div className="text-3xl font-semibold">{fmtSets(sel?.sets ?? 0)} <span className="text-base font-normal text-muted">hard sets this week</span></div>
          <p className="text-sm text-muted">
            {(sel?.sets ?? 0) < WEEKLY_SET_TARGET.min ? `Most people grow best with ${WEEKLY_SET_TARGET.min}–${WEEKLY_SET_TARGET.max} sets per muscle per week.`
              : (sel?.sets ?? 0) <= WEEKLY_SET_TARGET.max ? 'In the typical 10–20 sets range for muscle growth.'
              : 'Above 20 sets. Fine if you recover well, but more isn’t always better.'}
            {' '}Main muscles count a full set; helper muscles count half.
          </p>
          {sel?.exercises.length ? (
            <div className="divide-y divide-border rounded-xl bg-surface-2 px-3">
              {sel.exercises.map((e) => (
                <Link key={e.exerciseId} to={`/training/exercise/${e.exerciseId}`} className="flex items-center justify-between py-2 text-sm"><span>{e.name}</span><span className="text-muted">{fmtSets(e.sets)} sets</span></Link>
              ))}
            </div>
          ) : <p className="text-sm text-muted">No sets for this muscle in the last 7 days.</p>}
        </div>
      </Sheet>
      <RecentPRs workouts={finished} />
    </div>
  );
}

/** Records set in the most recent workouts. */
function RecentPRs({ workouts }: { workouts: import('@/db/types').Workout[] }) {
  const prs = workouts.slice(0, 5).flatMap((w) => newRecordsIn(w, workouts).map((r) => ({ ...r, date: w.date })));
  if (!prs.length) return null;
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2 font-semibold"><Trophy size={18} className="text-warning" /> Recent records</div>
      <div className="divide-y divide-border">
        {prs.map((r, i) => (
          <Link key={i} to={`/training/exercise/${r.exerciseId}`} className="flex items-center justify-between py-2 text-sm">
            <span>{r.name}</span><span className="text-muted">{r.kind === 'heaviest' ? 'Heaviest weight' : 'Best estimated 1RM'} · {fmtDate(r.date)}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
