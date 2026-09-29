import { Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui';
import { useActiveWorkout, useWorkouts } from '@/lib/training/actions';
import { sessionSummary } from '@/lib/training/volume';
import { useExerciseLookup } from '@/lib/training/actions';
import { addDays, fromDateKey } from '@/lib/utils/date';

/** This week's training at a glance; links to the Training tab. */
export function TrainingTile({ today }: { today: string }) {
  const workouts = useWorkouts();
  const active = useActiveWorkout();
  const lookup = useExerciseLookup();
  if (workouts === undefined) return null;
  const finished = workouts.filter((w) => w.finishedAt);
  const week = finished.filter((w) => w.date > addDays(today, -7));
  const last = finished[0];
  return (
    <Link to={active ? `/training/workout/${active.id}` : '/training'}>
      <Card className="flex items-center gap-3 hover:bg-surface-2">
        <div className="rounded-xl p-2" style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}><Dumbbell size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted">Training</div>
          <div className="font-semibold">{active ? `${active.name} in progress` : `${week.length} ${week.length === 1 ? 'workout' : 'workouts'} this week`}</div>
          <div className="truncate text-xs text-muted">
            {last ? `Last: ${last.name}, ${fromDateKey(last.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${sessionSummary(last, lookup)}` : 'Start your first workout'}
          </div>
        </div>
      </Card>
    </Link>
  );
}
