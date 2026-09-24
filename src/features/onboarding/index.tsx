import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { db } from '@/db/schema';
import { newRecord } from '@/db/repo';
import { targetsFromProfile } from '@/lib/nutrition';
import { today } from '@/lib/utils/date';
import type { Profile } from '@/db/types';

/** Placeholder (Wave 0): W2 replaces this with the full wizard. */
export default function OnboardingPage() {
  const nav = useNavigate();
  const useDefaults = async () => {
    const p = newRecord({
      sex: 'male', birthDate: '1995-01-01', heightCm: 180, startWeightKg: 80, activity: 'moderate',
      goal: 'lose', goalRatePctPerWeek: -0.5, goalWeightKg: 75, diet: 'balanced', checkInWeekday: 1,
      onboardedAt: Date.now(),
    }) as Profile;
    const { tdee, targets } = targetsFromProfile(p, 80, 30);
    await db.transaction('rw', db.profile, db.targets, async () => {
      await db.profile.put(p);
      await db.targets.put(newRecord({ effectiveFrom: today(), base: targets, mode: 'coached' as const, tdee }));
    });
    nav('/', { replace: true });
  };
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <img src="/icon.svg" alt="" className="h-16 w-16" />
      <h1 className="text-3xl font-semibold">Welcome to MacroTrack</h1>
      <p className="text-muted">Setup wizard coming in Wave 1.</p>
      <Button variant="primary" size="lg" onClick={useDefaults}>Start with defaults</Button>
    </div>
  );
}
