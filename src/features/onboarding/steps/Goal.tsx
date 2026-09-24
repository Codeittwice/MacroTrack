import { AlertTriangle } from 'lucide-react';
import { Card, cx, Label, NumberInput } from '@/components/ui';
import { GAIN_RATE_PRESETS, GOAL_OPTIONS, LOSE_RATE_PRESETS } from '../options';
import type { WizardData } from '../wizardState';
import { goalWeightErrorMsg } from '../validation';
import type { GoalType } from '@/db/types';

export default function Goal({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  const goal = data.goal ?? 'lose';
  const weightKg = data.weightKg;
  const ratePct = data.goalRatePct ?? 0.5;
  const rateKgPerWeek = (ratePct / 100) * (weightKg ?? 0);
  const presets = goal === 'gain' ? GAIN_RATE_PRESETS : LOSE_RATE_PRESETS;
  const min = goal === 'gain' ? 0.05 : 0.1;
  const max = goal === 'gain' ? 1.0 : 1.5;
  const aggressive = goal === 'lose' ? ratePct > 1.0 : goal === 'gain' ? ratePct > 0.5 : false;
  const goalWeightErr = goalWeightErrorMsg(goal, data.goalWeightKg, weightKg);

  const selectGoal = (g: GoalType) => {
    if (g === 'maintain') {
      onChange({ goal: g, goalWeightKg: weightKg, goalRatePct: 0 });
    } else {
      const defaultRate = g === 'gain' ? 0.25 : 0.5;
      onChange({ goal: g, goalRatePct: data.goal === g ? ratePct : defaultRate });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Your goal</h2>
        <p className="text-sm text-muted">What are you working towards?</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {GOAL_OPTIONS.map((o) => {
          const selected = goal === o.value;
          return (
            <Card
              key={o.value}
              onClick={() => selectGoal(o.value)}
              className={cx(
                'min-h-[48px] items-center justify-center border text-center text-sm font-medium transition',
                selected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted',
              )}
            >
              {o.label}
            </Card>
          );
        })}
      </div>

      {goal !== 'maintain' && (
        <>
          <div>
            <Label hint={goalWeightErr ? <span style={{ color: 'var(--danger)' }}>{goalWeightErr}</span> : undefined}>
              Goal weight
            </Label>
            <NumberInput value={data.goalWeightKg} onValue={(v) => onChange({ goalWeightKg: v })} suffix="kg" placeholder="e.g. 75" />
          </div>

          <div>
            <Label hint={`${ratePct.toFixed(2)}%/wk ≈ ${rateKgPerWeek.toFixed(2)} kg/wk`}>
              Rate of {goal === 'lose' ? 'loss' : 'gain'}
            </Label>
            <input
              type="range"
              min={min}
              max={max}
              step={0.05}
              value={ratePct}
              onChange={(e) => onChange({ goalRatePct: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange({ goalRatePct: p })}
                  className={cx(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    Math.abs(ratePct - p) < 0.001 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:border-muted',
                  )}
                >
                  {p}%
                </button>
              ))}
            </div>
            {aggressive && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm" style={{ color: 'var(--warning)' }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>This is an aggressive rate. Consider a more moderate pace for better results and less muscle loss.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
