import { useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronRight, Dumbbell, Play, Plus, Trash2, Trophy } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Sheet } from '@/components/ui';
import { MuscleMap, fmtSets } from '@/components/MuscleMap';
import type { Muscle, Workout } from '@/db/types';
import { deleteTemplate, startWorkout, useActiveWorkout, useExerciseLookup, useTemplates, useWorkouts } from '@/lib/training/actions';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { BAND_LABEL, LANDMARKS, sessionSummary, volumeAdvice, volumeBand, weeklySetsByMuscle } from '@/lib/training/volume';
import { BAND_FILL } from '@/components/MuscleMap';
import { MuscleHistoryChart, WeeklyVolume, useWeeklyHistory } from './WeeklyVolume';
import { useTrend } from '@/lib/weight/queries';
import { addDays, today } from '@/lib/utils/date';
import { estimatedBurnKcal, newRecordsIn } from '@/lib/training/strength';
import { WorkoutPage } from './WorkoutPage';
import { ExerciseDetail } from './ExerciseDetail';
import { fmtDate, fmtDuration } from './format';
import { PastWorkoutSheet } from './PastWorkoutSheet';

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
  const [pastFor, setPastFor] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const finished = useMemo(() => (workouts ?? []).filter((w) => w.finishedAt), [workouts]);
  // Include the workout in progress: its ticked sets show up as soon as they're done.
  const weekly = useMemo(() => weeklySetsByMuscle(active ? [...finished, active] : finished, today(), lookup), [finished, active, lookup]);
  const weeklySets = useMemo(() => Object.fromEntries(Object.entries(weekly).map(([m, v]) => [m, v?.sets ?? 0])) as Partial<Record<Muscle, number>>, [weekly]);
  const thisWeek = finished.filter((w) => w.date > addDays(today(), -7)).length;
  const history = useWeeklyHistory(useMemo(() => (active ? [...finished, active] : finished), [finished, active]), lookup);

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
      <Button onClick={() => setPastFor('')}><CalendarPlus size={18} /> Log a past workout</Button>

      <Card>
        <div className="mb-2 flex items-baseline justify-between"><div className="font-semibold">Muscles trained</div><div className="text-xs text-muted">hard sets, last 7 days</div></div>
        <MuscleMap sets={weeklySets} selected={muscle} onSelect={setMuscle} />
      </Card>

      <WeeklyVolume history={history} onSelect={setMuscle} />

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
          <EmptyState icon={<Dumbbell size={32} />} title="Log your first workout" body="Start a workout, or log one you already did. Your muscle map fills in as you train." />
        ) : (
          <HistoryByDay workouts={finished} days={days} summaryFor={summaryFor} onAdd={(date) => setPastFor(date)} onMore={() => setDays((d) => d + 30)} />
        )}
      </Card>

      <Sheet open={!!muscle} onClose={() => setMuscle(undefined)} title={muscle ? MUSCLE_LABEL[muscle] : ''}>
        <div className="flex flex-col gap-3">
          {muscle && <MuscleVolumeSummary muscle={muscle} sets={sel?.sets ?? 0} />}
          {muscle && <MuscleHistoryChart history={history} muscle={muscle} />}
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
      <PastWorkoutSheet open={pastFor !== null} date={pastFor || undefined} onClose={() => setPastFor(null)} />
    </div>
  );
}

/** Sets in the last 7 days on a scale from 0 to past MRV, with the productive range marked. */
function MuscleVolumeSummary({ muscle, sets }: { muscle: Muscle; sets: number }) {
  const l = LANDMARKS[muscle];
  const band = volumeBand(muscle, sets);
  const scaleMax = Math.max(l.mrv * 1.15, sets);
  const pos = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-semibold">{fmtSets(sets)} <span className="text-base font-normal text-muted">hard sets, last 7 days</span></div>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: BAND_FILL[band], color: band === 'none' ? 'var(--text)' : 'var(--on-primary)' }}>{BAND_LABEL[band]}</span>
      </div>
      <div className="relative h-3 rounded-full bg-surface-2" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-primary/25" style={{ left: pos(l.low), width: `calc(${pos(l.high)} - ${pos(l.low)})` }} />
        <div className="absolute inset-y-0 w-0.5 bg-warning" style={{ left: pos(l.mrv) }} />
        <div className="absolute -top-0.5 h-4 w-1.5 -translate-x-1/2 rounded-full bg-text" style={{ left: pos(sets) }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted"><span>0</span><span>min {l.mev}</span><span>optimal {l.low}–{l.high}</span><span>max ~{l.mrv}</span></div>
      <p className="text-sm text-muted">{volumeAdvice(muscle, sets)} Main muscles count a full set; helper muscles count half.</p>
    </div>
  );
}

/**
 * Finished workouts grouped per day, newest first. Covers the last `days` days that had training;
 * each day can take another (past) workout and every workout opens to view or edit.
 */
function HistoryByDay({ workouts, days, summaryFor, onAdd, onMore }: {
  workouts: Workout[]; days: number; summaryFor: (w: Workout) => string; onAdd: (date: string) => void; onMore: () => void;
}) {
  const groups = useMemo(() => {
    const byDate = new Map<string, Workout[]>();
    for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, ws]) => ({ date, ws: ws.sort((a, b) => a.startedAt - b.startedAt) }));
  }, [workouts]);
  const shown = groups.slice(0, days);
  const label = (d: string) => (d === today() ? 'Today' : d === addDays(today(), -1) ? 'Yesterday' : fmtDate(d));
  return (
    <div className="flex flex-col gap-3">
      {shown.map(({ date, ws }) => (
        <section key={date} aria-label={`Workouts on ${label(date)}`}>
          <div className="flex items-center justify-between border-b border-border pb-1">
            <span className="text-sm font-medium">{label(date)}</span>
            <button type="button" aria-label={`Add workout on ${label(date)}`} onClick={() => onAdd(date)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><Plus size={16} /></button>
          </div>
          {ws.map((w) => (
            <Link key={w.id} to={`/training/workout/${w.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-sm text-muted">{fmtDuration(w.finishedAt! - w.startedAt)}{summaryFor(w) ? ` · ${summaryFor(w)}` : ''}</div>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          ))}
        </section>
      ))}
      {groups.length > shown.length && <Button variant="ghost" size="sm" onClick={onMore}>Show older</Button>}
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
