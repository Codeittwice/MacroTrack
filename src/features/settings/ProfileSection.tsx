import { useEffect, useState } from 'react';
import { Button, Input, Label, NumberInput, Segmented } from '@/components/ui';
import { Section } from './Section';
import { Select } from './Select';
import { db } from '@/db/schema';
import { ageOn } from '@/lib/utils/date';
import type { ActivityLevel, DietPreference, GoalType, Profile, Sex } from '@/db/types';
import { recalcCoachedTargets } from './targetActions';
import { ACTIVITY_OPTIONS, DIET_OPTIONS, GOAL_OPTIONS, WEEKDAY_OPTIONS } from './options';
import { signedRate, validateAge, validateBodyFatPct, validateHeightCm, validateWeightKg } from './helpers';

type Draft = {
  sex: Sex;
  birthDate: string;
  heightCm: number | undefined;
  startWeightKg: number | undefined;
  bodyFatPct: number | undefined;
  activity: ActivityLevel;
  goal: GoalType;
  /** unsigned %BW/week; sign is derived from `goal` on save */
  rateMagnitude: number | undefined;
  goalWeightKg: number | undefined;
  diet: DietPreference;
  checkInWeekday: number;
};

function toDraft(p: Profile): Draft {
  return {
    sex: p.sex,
    birthDate: p.birthDate,
    heightCm: p.heightCm,
    startWeightKg: p.startWeightKg,
    bodyFatPct: p.bodyFatPct,
    activity: p.activity,
    goal: p.goal,
    rateMagnitude: p.goalRatePctPerWeek ? Math.abs(p.goalRatePctPerWeek) : undefined,
    goalWeightKg: p.goalWeightKg,
    diet: p.diet,
    checkInWeekday: p.checkInWeekday,
  };
}

type RecalcKey = { goal: GoalType; rate: number; diet: DietPreference; activity: ActivityLevel };
const keyOf = (goal: GoalType, rate: number, diet: DietPreference, activity: ActivityLevel): RecalcKey => ({ goal, rate, diet, activity });

export function ProfileSection({ profile }: { profile: Profile }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [loaded, setLoaded] = useState<RecalcKey>(() => keyOf(profile.goal, profile.goalRatePctPerWeek, profile.diet, profile.activity));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRecalc, setShowRecalc] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    setDraft(toDraft(profile));
    setLoaded(keyOf(profile.goal, profile.goalRatePctPerWeek, profile.diet, profile.activity));
    // Only reseed when the underlying record identity changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  const age = draft.birthDate ? ageOn(draft.birthDate) : undefined;
  const weightForRate = draft.startWeightKg ?? profile.startWeightKg;
  const kgPerWeek = draft.rateMagnitude !== undefined ? (draft.rateMagnitude / 100) * weightForRate : undefined;

  function validate(): string | null {
    if (draft.heightCm === undefined || !validateHeightCm(draft.heightCm)) return 'Height must be between 120 and 230 cm.';
    if (draft.startWeightKg === undefined || !validateWeightKg(draft.startWeightKg)) return 'Start weight must be between 30 and 300 kg.';
    if (draft.goalWeightKg !== undefined && !validateWeightKg(draft.goalWeightKg)) return 'Goal weight must be between 30 and 300 kg.';
    if (age === undefined || !validateAge(age)) return 'Age must be between 14 and 100 years.';
    if (draft.bodyFatPct !== undefined && !validateBodyFatPct(draft.bodyFatPct)) return 'Body fat must be between 3% and 60%, or left blank.';
    if (draft.goal !== 'maintain' && (draft.rateMagnitude === undefined || draft.rateMagnitude < 0.05 || draft.rateMagnitude > 1.5)) return 'Rate must be between 0.05 and 1.5 %BW per week.';
    if (draft.goal === 'lose' && draft.goalWeightKg !== undefined && draft.goalWeightKg >= draft.startWeightKg) return 'Goal weight must be below your start weight when losing.';
    if (draft.goal === 'gain' && draft.goalWeightKg !== undefined && draft.goalWeightKg <= draft.startWeightKg) return 'Goal weight must be above your start weight when gaining.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      setSaved(false);
      return;
    }
    setError(null);
    const goalRatePctPerWeek = signedRate(draft.goal, draft.rateMagnitude ?? 0);
    const changes: Partial<Profile> = {
      sex: draft.sex,
      birthDate: draft.birthDate,
      heightCm: draft.heightCm,
      startWeightKg: draft.startWeightKg,
      bodyFatPct: draft.bodyFatPct,
      activity: draft.activity,
      goal: draft.goal,
      goalRatePctPerWeek,
      goalWeightKg: draft.goalWeightKg,
      diet: draft.diet,
      checkInWeekday: draft.checkInWeekday,
    };
    await db.profile.put({ ...profile, ...changes, updatedAt: Date.now() });
    const next = keyOf(draft.goal, goalRatePctPerWeek, draft.diet, draft.activity);
    const changed = next.goal !== loaded.goal || next.rate !== loaded.rate || next.diet !== loaded.diet || next.activity !== loaded.activity;
    setShowRecalc(changed);
    setLoaded(next);
    setSaved(true);
  }

  async function handleRecalc() {
    setRecalculating(true);
    try {
      const goalRatePctPerWeek = signedRate(draft.goal, draft.rateMagnitude ?? 0);
      await recalcCoachedTargets({ ...profile, ...draft, goalRatePctPerWeek } as Profile);
      setShowRecalc(false);
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <Section title="Profile">
      <div className="space-y-4">
        <div>
          <Label>Sex</Label>
          <Segmented<Sex>
            value={draft.sex}
            onChange={(sex) => set('sex', sex)}
            options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label hint={age !== undefined ? `${age} yrs` : undefined}>Birth date</Label>
            <Input type="date" value={draft.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          </div>
          <div>
            <Label>Height</Label>
            <NumberInput value={draft.heightCm} onValue={(v) => set('heightCm', v)} suffix="cm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start weight</Label>
            <NumberInput value={draft.startWeightKg} onValue={(v) => set('startWeightKg', v)} suffix="kg" />
          </div>
          <div>
            <Label hint="optional">Body fat</Label>
            <NumberInput value={draft.bodyFatPct} onValue={(v) => set('bodyFatPct', v)} suffix="%" />
          </div>
        </div>

        <div>
          <Label>Activity level</Label>
          <Select<ActivityLevel> value={draft.activity} onChange={(activity) => set('activity', activity)} options={ACTIVITY_OPTIONS} />
        </div>

        <div>
          <Label>Goal</Label>
          <Segmented<GoalType> value={draft.goal} onChange={(goal) => set('goal', goal)} options={GOAL_OPTIONS} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label hint={kgPerWeek !== undefined ? `${kgPerWeek >= 0 ? '+' : ''}${kgPerWeek.toFixed(2)} kg/wk` : undefined}>
              Rate (%BW/week)
            </Label>
            <NumberInput
              value={draft.rateMagnitude}
              onValue={(v) => set('rateMagnitude', v)}
              suffix="%/wk"
              disabled={draft.goal === 'maintain'}
              placeholder={draft.goal === 'maintain' ? '—' : undefined}
            />
          </div>
          <div>
            <Label hint="optional">Goal weight</Label>
            <NumberInput value={draft.goalWeightKg} onValue={(v) => set('goalWeightKg', v)} suffix="kg" />
          </div>
        </div>

        <div>
          <Label>Diet preference</Label>
          <Select<DietPreference> value={draft.diet} onChange={(diet) => set('diet', diet)} options={DIET_OPTIONS} />
        </div>

        <div>
          <Label>Weekly check-in day</Label>
          <Select<number> value={draft.checkInWeekday} onChange={(checkInWeekday) => set('checkInWeekday', checkInWeekday)} options={WEEKDAY_OPTIONS} />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSave}>Save profile</Button>
          {saved && !showRecalc && <span className="text-sm text-muted">Saved.</span>}
        </div>

        {showRecalc && (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="mb-2 text-sm text-muted">
              Your goal, rate, diet or activity level changed. Recalculate today's targets from the new profile?
            </p>
            <Button onClick={handleRecalc} disabled={recalculating}>
              {recalculating ? 'Recalculating…' : 'Recalculate targets'}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
