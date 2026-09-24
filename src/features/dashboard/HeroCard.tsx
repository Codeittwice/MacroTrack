import { useNavigate } from 'react-router-dom';
import { Card, ProgressBar } from '@/components/ui';
import MacroRing from '@/components/MacroRing';
import type { MacroTargets, Nutrients } from '@/db/types';
import { fmt, kcalFmt } from './format';

function MacroRow({ name, color, value, target }: { name: string; color: string; value: number; target?: number }) {
  const hasTarget = target !== undefined && target > 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted">{name}</span>
        <span className="font-medium">
          {fmt(Math.round(value))}
          {hasTarget ? ` / ${fmt(Math.round(target))} g` : ' g'}
        </span>
      </div>
      <ProgressBar value={value} max={hasTarget ? target : 0} color={color} />
      {!hasTarget && <div className="mt-0.5 text-[11px] text-muted">No target</div>}
    </div>
  );
}

export function HeroCard({ totals, targets }: { totals: Nutrients; targets: MacroTargets | undefined }) {
  const navigate = useNavigate();
  const kcalTarget = targets?.kcal ?? 0;

  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/log')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/log');
        }}
        className="flex cursor-pointer flex-col items-center gap-4 outline-none sm:flex-row sm:items-center"
      >
        <div className="shrink-0">
          <MacroRing
            value={totals.kcal}
            target={kcalTarget}
            color="var(--kcal)"
            size={140}
            sublabel={kcalTarget > 0 ? `of ${kcalFmt(kcalTarget)} kcal` : 'No target set'}
          />
        </div>
        <div className="flex w-full flex-col gap-3">
          <MacroRow name="Protein" color="var(--protein)" value={totals.protein} target={targets?.protein} />
          <MacroRow name="Carbs" color="var(--carbs)" value={totals.carbs} target={targets?.carbs} />
          <MacroRow name="Fat" color="var(--fat)" value={totals.fat} target={targets?.fat} />
        </div>
      </div>
    </Card>
  );
}

export default HeroCard;
