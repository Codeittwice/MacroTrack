import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { db } from '@/db/schema';
import { newRecord } from '@/db/repo';
import { targetsFromProfile } from '@/lib/nutrition';
import { ageOn, today } from '@/lib/utils/date';
import type { Profile, WeightEntry } from '@/db/types';
import { INITIAL_WIZARD, signedRate, type WizardData } from './wizardState';
import { stepValid } from './validation';
import Welcome from './steps/Welcome';
import AboutYou from './steps/AboutYou';
import CurrentWeight from './steps/CurrentWeight';
import Activity from './steps/Activity';
import Goal from './steps/Goal';
import Diet from './steps/Diet';
import CheckInDay from './steps/CheckInDay';
import Summary from './steps/Summary';

const STEP_COUNT = 8;

export default function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  const valid = useMemo(() => stepValid(step, data), [step, data]);

  const finish = async () => {
    if (!data.sex || !data.birthDate || data.heightCm === undefined || data.weightKg === undefined || !data.activity || !data.goal || !data.diet) {
      setError('Please complete all steps before finishing.');
      return;
    }
    // Re-validate every step: earlier answers (e.g. weight) may have changed after later steps were filled in.
    const firstInvalid = Array.from({ length: STEP_COUNT }, (_, i) => i).find((i) => !stepValid(i, data));
    if (firstInvalid !== undefined) {
      setError('Some answers need attention. Please review this step.');
      setStep(firstInvalid);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const age = ageOn(data.birthDate);
      const goalRatePctPerWeek = signedRate(data.goal, data.goalRatePct);

      const profile = newRecord({
        sex: data.sex,
        birthDate: data.birthDate,
        heightCm: data.heightCm,
        startWeightKg: data.weightKg,
        ...(data.bodyFatPct !== undefined ? { bodyFatPct: data.bodyFatPct } : {}),
        activity: data.activity,
        goal: data.goal,
        goalRatePctPerWeek,
        ...(data.goalWeightKg !== undefined ? { goalWeightKg: data.goalWeightKg } : {}),
        diet: data.diet,
        checkInWeekday: data.checkInWeekday ?? 1,
        onboardedAt: Date.now(),
      }) as Profile;

      const { tdee, targets } = targetsFromProfile(profile, data.weightKg, age);

      const weightEntry = newRecord({
        date: today(),
        kg: data.weightKg,
        ...(data.bodyFatPct !== undefined ? { bodyFatPct: data.bodyFatPct } : {}),
        time: Date.now(),
      }) as WeightEntry;

      await db.transaction('rw', db.profile, db.weights, db.targets, async () => {
        await db.profile.put(profile);
        await db.weights.put(weightEntry);
        await db.targets.put(newRecord({ effectiveFrom: today(), base: targets, mode: 'coached' as const, tdee }));
      });

      nav('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving your profile.');
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step === STEP_COUNT - 1) {
      void finish();
      return;
    }
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // Called as a function (not rendered as <StepComponent/>) so steps don't remount and inputs keep focus.
  const renderStep = () => {
    switch (step) {
      case 0: return <Welcome />;
      case 1: return <AboutYou data={data} onChange={patch} />;
      case 2: return <CurrentWeight data={data} onChange={patch} />;
      case 3: return <Activity data={data} onChange={patch} />;
      case 4: return <Goal data={data} onChange={patch} />;
      case 5: return <Diet data={data} onChange={patch} />;
      case 6: return <CheckInDay data={data} onChange={patch} />;
      case 7: return <Summary data={data} />;
      default: return null;
    }
  };

  const progressPct = ((step + 1) / STEP_COUNT) * 100;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center gap-3 px-5 pt-5">
          <button
            aria-label="Back"
            onClick={goBack}
            disabled={step === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 disabled:opacity-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 py-6">
          {renderStep()}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 bg-bg px-5 pt-2 pb-6">
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!valid || saving}
            onClick={goNext}
          >
            {step === STEP_COUNT - 1 ? (saving ? 'Saving…' : 'Start tracking') : step === 0 ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
