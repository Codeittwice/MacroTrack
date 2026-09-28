import { useEffect, useState } from 'react';
import { Button, Label, NumberInput, Segmented, Sheet, cx } from '@/components/ui';
import type { Sex } from '@/db/types';
import { BODY_TYPE_GUIDE, bodyFatCategory, navyBodyFat, rfmBodyFat } from '@/lib/nutrition';

type Method = 'tape' | 'waist' | 'visual';

export interface BodyFatEstimatorProps {
  open: boolean;
  onClose: () => void;
  sex: Sex;
  heightCm: number;
  initial?: { neckCm?: number; waistCm?: number; hipCm?: number };
  onUse: (pct: number) => void;
}

const ACCURACY: Record<Method, string> = {
  tape: 'Typical accuracy ±3–4 percentage points.',
  waist: 'Rougher estimate, typically ±5 percentage points.',
  visual: 'A visual guess. Use the tape measure for something more reliable.',
};

/** Estimates body fat for people who don't know it: US Navy tape method, waist-only RFM, or a visual guide. */
export function BodyFatEstimator({ open, onClose, sex, heightCm, initial, onUse }: BodyFatEstimatorProps) {
  const [method, setMethod] = useState<Method>('tape');
  const [neck, setNeck] = useState(initial?.neckCm);
  const [waist, setWaist] = useState(initial?.waistCm);
  const [hip, setHip] = useState(initial?.hipCm);
  const [picked, setPicked] = useState<number | undefined>();
  useEffect(() => {
    if (!open) return;
    setNeck(initial?.neckCm);
    setWaist(initial?.waistCm);
    setHip(initial?.hipCm);
    setPicked(undefined);
  }, [open, initial?.neckCm, initial?.waistCm, initial?.hipCm]);

  const estimate =
    method === 'tape' ? navyBodyFat({ sex, heightCm, neckCm: neck, waistCm: waist, hipCm: hip })
    : method === 'waist' ? rfmBodyFat({ sex, heightCm, waistCm: waist })
    : picked ?? null;
  const incomplete = method === 'tape' ? neck === undefined || waist === undefined || (sex === 'female' && hip === undefined) : method === 'waist' ? waist === undefined : picked === undefined;

  return (
    <Sheet open={open} onClose={onClose} title="Estimate your body fat">
      <div className="flex flex-col gap-4">
        <Segmented<Method> options={[{ value: 'tape', label: 'Tape measure' }, { value: 'waist', label: 'Waist only' }, { value: 'visual', label: 'Visual guide' }]} value={method} onChange={setMethod} />

        {method !== 'visual' && (
          <div className="flex flex-col gap-3">
            {method === 'tape' && (
              <div>
                <Label hint="just below the Adam's apple">Neck</Label>
                <NumberInput aria-label="Neck circumference" value={neck} onValue={setNeck} suffix="cm" placeholder="e.g. 38" />
              </div>
            )}
            <div>
              <Label hint={sex === 'male' ? 'level with the navel, relaxed' : 'at the narrowest point'}>Waist</Label>
              <NumberInput aria-label="Waist circumference" value={waist} onValue={setWaist} suffix="cm" placeholder="e.g. 84" />
            </div>
            {method === 'tape' && sex === 'female' && (
              <div>
                <Label hint="at the widest point of the buttocks">Hips</Label>
                <NumberInput aria-label="Hip circumference" value={hip} onValue={setHip} suffix="cm" placeholder="e.g. 98" />
              </div>
            )}
            <p className="text-xs text-muted">Measure on bare skin with the tape snug but not pressing, and breathe out normally. Uses your height of {heightCm} cm.</p>
          </div>
        )}

        {method === 'visual' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BODY_TYPE_GUIDE[sex].map((band, i) => (
              <button
                key={band.label}
                type="button"
                aria-pressed={picked === band.midpoint}
                aria-label={`${band.label}, ${band.min} to ${band.max} percent`}
                onClick={() => setPicked(band.midpoint)}
                className={cx('flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition', picked === band.midpoint ? 'border-primary bg-surface-2' : 'border-border hover:border-muted')}
              >
                <Silhouette sex={sex} level={i / 5} />
                <span className="text-sm font-medium">{band.min}–{band.max}%</span>
                <span className="text-xs text-muted">{band.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-surface-2 p-3" role="status">
          {estimate !== null ? (
            <>
              <div className="text-2xl font-semibold">≈ {estimate.toFixed(1)}%</div>
              <div className="text-sm text-muted">{bodyFatCategory(sex, estimate)} · {ACCURACY[method]}</div>
            </>
          ) : (
            <div className="text-sm text-muted">{incomplete ? 'Fill in the measurements to see your estimate.' : 'These measurements look off. Check that they are in centimetres.'}</div>
          )}
        </div>

        <Button variant="primary" size="lg" disabled={estimate === null} onClick={() => { if (estimate !== null) { onUse(Math.round(estimate * 10) / 10); onClose(); } }}>
          Use this value
        </Button>
      </div>
    </Sheet>
  );
}

/** Simple front torso outline; `level` 0..1 widens the waist and belly. Decorative only. */
function Silhouette({ sex, level }: { sex: Sex; level: number }) {
  const waist = (sex === 'male' ? 17 : 14) + level * 13;
  const hips = (sex === 'male' ? 19 : 23) + level * 9;
  const shoulders = sex === 'male' ? 26 : 22;
  const belly = level * 6;
  const d = `M ${40 - shoulders} 22 Q 40 16 ${40 + shoulders} 22 L ${40 + shoulders - 3} 40 Q ${40 + waist + belly} 58 ${40 + hips} 78 L ${40 - hips} 78 Q ${40 - waist - belly} 58 ${40 - shoulders + 3} 40 Z`;
  return (
    <svg viewBox="0 0 80 84" width="64" height="68" aria-hidden="true">
      <circle cx="40" cy="10" r="7" fill="var(--muted)" opacity="0.5" />
      <path d={d} fill="var(--muted)" opacity="0.35" stroke="var(--muted)" strokeWidth="1.2" />
    </svg>
  );
}

/** "Don't know it? Estimate it" link that opens the estimator; disabled until sex and height are known. */
export function BodyFatEstimateLink({ sex, heightCm, onUse, initial }: { sex?: Sex; heightCm?: number; onUse: (pct: number) => void; initial?: BodyFatEstimatorProps['initial'] }) {
  const [open, setOpen] = useState(false);
  const ready = !!sex && heightCm !== undefined && heightCm >= 120;
  return (
    <>
      <button type="button" disabled={!ready} onClick={() => setOpen(true)} className="mt-1.5 text-sm text-primary underline-offset-2 hover:underline disabled:text-muted disabled:no-underline">
        {ready ? "Don't know it? Estimate it" : 'Enter sex and height to estimate it'}
      </button>
      {ready && <BodyFatEstimator open={open} onClose={() => setOpen(false)} sex={sex} heightCm={heightCm} initial={initial} onUse={onUse} />}
    </>
  );
}
