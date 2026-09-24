import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Label, NumberInput, Segmented } from '@/components/ui';
import { Section } from './Section';
import { getTargetSetFor } from '@/app/hooks';
import { ageOn, today } from '@/lib/utils/date';
import type { MacroTargets, Profile, TargetSet } from '@/db/types';
import { currentTdee, latestWeightKg, recalcCoachedTargets, upsertTodayTargetSet } from './targetActions';
import { atwaterKcal, kcalMismatch } from './helpers';
import { WEEKDAY_OPTIONS } from './options';

type MacroDraft = { kcal?: number; protein?: number; carbs?: number; fat?: number };

function toMacroDraft(m?: MacroTargets): MacroDraft {
  if (!m) return {};
  return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
}
function isComplete(d: MacroDraft): d is Required<MacroDraft> {
  return d.kcal !== undefined && d.protein !== undefined && d.carbs !== undefined && d.fat !== undefined;
}

export function TargetsSection({ profile }: { profile: Profile }) {
  const currentSet = useLiveQuery(() => getTargetSetFor(today()), []);
  const [mode, setMode] = useState<'coached' | 'manual'>('coached');
  const [base, setBase] = useState<MacroDraft>({});
  const [perWeekdayEnabled, setPerWeekdayEnabled] = useState(false);
  const [perWeekday, setPerWeekday] = useState<Record<number, MacroDraft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSet) return;
    setMode(currentSet.mode);
    setBase(toMacroDraft(currentSet.base));
    const hasOverrides = !!currentSet.perWeekday && Object.keys(currentSet.perWeekday).length > 0;
    setPerWeekdayEnabled(hasOverrides);
    const pw: Record<number, MacroDraft> = {};
    if (currentSet.perWeekday) {
      for (const [k, v] of Object.entries(currentSet.perWeekday)) pw[Number(k)] = toMacroDraft(v);
    }
    setPerWeekday(pw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet?.id]);

  async function handleModeChange(next: 'coached' | 'manual') {
    setMode(next);
    setError(null);
    if (next === 'coached') {
      setBusy(true);
      try {
        await recalcCoachedTargets(profile);
      } finally {
        setBusy(false);
      }
    }
  }

  async function handleSaveManual() {
    if (!isComplete(base)) {
      setError('Fill in kcal, protein, carbs and fat.');
      return;
    }
    if (base.kcal <= 0 || base.protein < 0 || base.carbs < 0 || base.fat < 0) {
      setError('Values must be zero or greater (kcal must be positive).');
      return;
    }
    if (perWeekdayEnabled) {
      const rows = Object.values(perWeekday);
      const partial = rows.some((r) => !isComplete(r) && Object.values(r).some((v) => v !== undefined));
      const negative = rows.some((r) => Object.values(r).some((v) => v !== undefined && v < 0));
      if (partial || negative) {
        setError('Each weekday row must be either empty or have kcal, protein, carbs and fat (no negative values).');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const perWeekdayOut: NonNullable<TargetSet['perWeekday']> = {};
      if (perWeekdayEnabled) {
        for (const [k, v] of Object.entries(perWeekday)) {
          if (isComplete(v)) perWeekdayOut[Number(k)] = v;
        }
      }
      const tdee = currentSet?.tdee ?? (await currentTdee(profile, await latestWeightKg(profile.startWeightKg), ageOn(profile.birthDate)));
      await upsertTodayTargetSet({
        base,
        mode: 'manual',
        tdee,
        perWeekday: perWeekdayEnabled && Object.keys(perWeekdayOut).length ? perWeekdayOut : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const atwater = isComplete(base) ? atwaterKcal(base.protein, base.carbs, base.fat) : undefined;
  const mismatch = atwater !== undefined && base.kcal !== undefined && kcalMismatch(base.kcal, atwater);

  return (
    <Section title="Targets">
      {!currentSet && (
        <p className="mb-3 text-sm text-muted">
          No targets set yet — save your profile to generate initial coached targets, or switch to manual below.
        </p>
      )}

      <div className="mb-4">
        <Label>Mode</Label>
        <Segmented<'coached' | 'manual'>
          value={mode}
          onChange={handleModeChange}
          options={[{ value: 'coached', label: 'Coached' }, { value: 'manual', label: 'Manual' }]}
        />
      </div>

      {mode === 'coached' && currentSet && (
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted">Kcal</div>
            <div className="font-semibold" style={{ color: 'var(--kcal)' }}>{currentSet.base.kcal}</div>
          </div>
          <div>
            <div className="text-muted">Protein</div>
            <div className="font-semibold" style={{ color: 'var(--protein)' }}>{currentSet.base.protein}g</div>
          </div>
          <div>
            <div className="text-muted">Carbs</div>
            <div className="font-semibold" style={{ color: 'var(--carbs)' }}>{currentSet.base.carbs}g</div>
          </div>
          <div>
            <div className="text-muted">Fat</div>
            <div className="font-semibold" style={{ color: 'var(--fat)' }}>{currentSet.base.fat}g</div>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label hint={atwater !== undefined ? `Atwater ${atwater} kcal${mismatch ? ' — differs >5%' : ''}` : undefined}>Kcal</Label>
              <NumberInput value={base.kcal} onValue={(v) => setBase((b) => ({ ...b, kcal: v }))} suffix="kcal" />
            </div>
            <div>
              <Label>Protein</Label>
              <NumberInput value={base.protein} onValue={(v) => setBase((b) => ({ ...b, protein: v }))} suffix="g" />
            </div>
            <div>
              <Label>Carbs</Label>
              <NumberInput value={base.carbs} onValue={(v) => setBase((b) => ({ ...b, carbs: v }))} suffix="g" />
            </div>
            <div>
              <Label>Fat</Label>
              <NumberInput value={base.fat} onValue={(v) => setBase((b) => ({ ...b, fat: v }))} suffix="g" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={perWeekdayEnabled} onChange={(e) => setPerWeekdayEnabled(e.target.checked)} />
            Different targets per weekday
          </label>

          {perWeekdayEnabled && (
            <div className="space-y-2">
              {WEEKDAY_OPTIONS.map((wd) => {
                const row = perWeekday[wd.value] ?? {};
                const setRow = (patch: Partial<MacroDraft>) => setPerWeekday((p) => ({ ...p, [wd.value]: { ...row, ...patch } }));
                return (
                  <div key={wd.value} className="grid grid-cols-5 items-center gap-1.5 text-xs">
                    <div className="text-muted">{wd.label.slice(0, 3)}</div>
                    <NumberInput value={row.kcal} onValue={(v) => setRow({ kcal: v })} placeholder="kcal" />
                    <NumberInput value={row.protein} onValue={(v) => setRow({ protein: v })} placeholder="P" />
                    <NumberInput value={row.carbs} onValue={(v) => setRow({ carbs: v })} placeholder="C" />
                    <NumberInput value={row.fat} onValue={(v) => setRow({ fat: v })} placeholder="F" />
                  </div>
                );
              })}
              <p className="text-xs text-muted">Leave a row empty to use the default targets on that day.</p>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button variant="primary" onClick={handleSaveManual} disabled={busy}>Save targets</Button>
        </div>
      )}
    </Section>
  );
}
