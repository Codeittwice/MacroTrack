import { Stat } from '@/components/ui';
import { bmr, projectGoalDate, targetsFromProfile } from '@/lib/nutrition';
import { ageOn, today } from '@/lib/utils/date';
import type { Profile } from '@/db/types';
import type { WizardData } from '../wizardState';
import { signedRate } from '../wizardState';

export default function Summary({ data }: { data: WizardData }) {
  if (!data.sex || !data.birthDate || data.heightCm === undefined || data.weightKg === undefined || !data.activity || !data.goal || !data.diet) {
    return <p className="text-muted">Missing information — please go back and complete the previous steps.</p>;
  }

  const age = ageOn(data.birthDate);
  const b = bmr({ sex: data.sex, age, heightCm: data.heightCm, weightKg: data.weightKg, bodyFatPct: data.bodyFatPct });
  const goalRatePctPerWeek = signedRate(data.goal, data.goalRatePct);

  const draftProfile = {
    sex: data.sex,
    birthDate: data.birthDate,
    heightCm: data.heightCm,
    startWeightKg: data.weightKg,
    bodyFatPct: data.bodyFatPct,
    activity: data.activity,
    goal: data.goal,
    goalRatePctPerWeek,
    goalWeightKg: data.goalWeightKg,
    diet: data.diet,
    checkInWeekday: data.checkInWeekday ?? 1,
  } as Profile;

  const { tdee, targets } = targetsFromProfile(draftProfile, data.weightKg, age);

  const weeklyRateKg = (goalRatePctPerWeek / 100) * data.weightKg;
  const goalDate = data.goal !== 'maintain' && data.goalWeightKg !== undefined
    ? projectGoalDate(data.weightKg, data.goalWeightKg, weeklyRateKg, today())
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Your plan</h2>
        <p className="text-sm text-muted">Here's where we're starting. These targets adapt weekly as MacroTrack learns your real expenditure.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl bg-surface p-4">
        <Stat label="BMR" value={`${Math.round(b)} kcal`} />
        <Stat label="Estimated TDEE" value={`${Math.round(tdee)} kcal`} />
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <div className="mb-3 text-sm text-muted">Daily targets</div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Calories" value={`${targets.kcal} kcal`} color="var(--kcal)" />
          <Stat label="Protein" value={`${targets.protein} g`} color="var(--protein)" />
          <Stat label="Carbs" value={`${targets.carbs} g`} color="var(--carbs)" />
          <Stat label="Fat" value={`${targets.fat} g`} color="var(--fat)" />
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4 text-sm">
        {data.goal === 'maintain' && <p className="text-muted">You're set to maintain your current weight.</p>}
        {data.goal !== 'maintain' && data.goalWeightKg !== undefined && (
          goalDate ? (
            <p className="text-muted">
              At this rate, you'll reach <span className="text-text">{data.goalWeightKg} kg</span> around{' '}
              <span className="text-text">{new Date(goalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
            </p>
          ) : (
            <p className="text-muted">We'll estimate your goal date once we have a bit more data.</p>
          )
        )}
      </div>

      <p className="text-xs text-muted">
        These are starting estimates based on formulas. Once you start logging food and weight, MacroTrack
        learns your actual expenditure and fine-tunes your targets each week.
      </p>
    </div>
  );
}
