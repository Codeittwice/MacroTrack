import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, PageHeader, Stat } from '@/components/ui';
import { useExerciseLookup, useWorkouts } from '@/lib/training/actions';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { e1rmHistory, personalRecords } from '@/lib/training/strength';
import { fmtDate } from './format';

export function ExerciseDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const lookup = useExerciseLookup();
  const workouts = useWorkouts();
  const def = lookup(id);
  const finished = useMemo(() => (workouts ?? []).filter((w) => w.finishedAt), [workouts]);
  const pr = useMemo(() => personalRecords(finished, id), [finished, id]);
  const series = useMemo(() => e1rmHistory(finished, id).map((p) => ({ ...p, value: Math.round(p.value * 10) / 10 })), [finished, id]);
  const sessions = finished.filter((w) => w.exercises.some((e) => e.exerciseId === id));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={def?.name ?? 'Exercise'} />
      {def && <p className="-mt-2 text-sm text-muted">{def.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}{def.secondary.length ? ` · also ${def.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}</p>}
      <div className="grid grid-cols-3 gap-3">
        <Card><Stat label="Heaviest" value={pr.heaviest ? `${pr.heaviest.kg} kg` : '—'} sub={pr.heaviest ? `× ${pr.heaviest.reps}` : undefined} /></Card>
        <Card><Stat label="Best e1RM" value={pr.bestE1rm ? `${Math.round(pr.bestE1rm.value)} kg` : '—'} sub={pr.bestE1rm ? `${pr.bestE1rm.kg} × ${pr.bestE1rm.reps}` : undefined} /></Card>
        <Card><Stat label="Most reps" value={pr.mostReps ? `${pr.mostReps.reps}` : '—'} sub={pr.mostReps ? `at ${pr.mostReps.kg} kg` : undefined} /></Card>
      </div>
      <Card>
        <div className="mb-2 font-semibold">Estimated 1RM</div>
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={24} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} width={48} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} labelFormatter={(d) => fmtDate(String(d))} formatter={(v: number) => [`${v} kg`, 'e1RM']} />
              <Line dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="py-4 text-center text-sm text-muted">Log this exercise in two or more workouts to see your progress.</p>}
      </Card>
      <Card>
        <div className="mb-2 font-semibold">History</div>
        {sessions.length === 0 ? <p className="text-sm text-muted">Not logged yet.</p> : sessions.slice(0, 20).map((w) => (
          <div key={w.id} className="border-b border-border py-2 text-sm last:border-0">
            <div className="font-medium">{fmtDate(w.date)}</div>
            <div className="text-muted">{w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets).map((s) => `${s.kg ?? 0} × ${s.reps ?? 0}`).join(' · ')}</div>
          </div>
        ))}
      </Card>
      <Button variant="ghost" onClick={() => nav(-1)}>Back</Button>
    </div>
  );
}
