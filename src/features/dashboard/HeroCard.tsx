import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui';
import type { MacroTargets, Nutrients } from '@/db/types';
import { fmt, kcalFmt } from './format';

const MACROS: { key: 'protein' | 'carbs' | 'fat'; label: string; color: string }[] = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)' },
];

/** Small ring showing the share of today's calories eaten (red once 5% over). */
function Ring({ value, target }: { value: number; target: number }) {
  const size = 88;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = target > 0 ? value / target : 0;
  const over = target > 0 && value > target * 1.05;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={over ? 'var(--danger)' : 'var(--kcal)'} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, frac)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
      />
      <text x="50%" y="47%" textAnchor="middle" className="fill-text text-[15px] font-semibold">{target > 0 ? `${Math.round(frac * 100)}%` : '–'}</text>
      <text x="50%" y="64%" textAnchor="middle" className="fill-muted text-[10px]">eaten</text>
    </svg>
  );
}

function MacroBar({ label, color, value, target }: { label: string; color: string; value: number; target?: number }) {
  const has = target !== undefined && target > 0;
  const pct = has ? Math.min(100, (value / target) * 100) : 0;
  const over = has && value > target * 1.05;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-1 text-xs">
        <span style={{ color }}>{label}</span>
        <span className="truncate text-muted">{fmt(Math.round(value))}{has ? `/${fmt(Math.round(target))}` : ' g'}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} />
      </div>
    </div>
  );
}

/** Today at a glance: calories left as the headline, a small progress ring, and one row of macro bars. */
export function HeroCard({ totals, targets }: { totals: Nutrients; targets: MacroTargets | undefined }) {
  const navigate = useNavigate();
  const target = targets?.kcal ?? 0;
  const left = Math.round(target - totals.kcal);
  const over = target > 0 && left < 0;
  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        aria-label={target > 0 ? `${kcalFmt(totals.kcal)} of ${kcalFmt(target)} kcal eaten, ${kcalFmt(Math.abs(left))} ${over ? 'over' : 'left'}` : `${kcalFmt(totals.kcal)} kcal eaten`}
        onClick={() => navigate('/log')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/log'); }}
        className="cursor-pointer outline-none"
      >
        <div className="flex items-center gap-4">
          <Ring value={totals.kcal} target={target} />
          <div className="min-w-0">
            {target > 0 ? (
              <>
                <div className="text-4xl leading-tight font-semibold tracking-tight" style={over ? { color: 'var(--danger)' } : undefined}>{kcalFmt(Math.abs(left))}</div>
                <div className="text-sm text-muted">kcal {over ? 'over' : 'left'} · {kcalFmt(totals.kcal)} of {kcalFmt(target)}</div>
              </>
            ) : (
              <>
                <div className="text-4xl leading-tight font-semibold tracking-tight">{kcalFmt(totals.kcal)}</div>
                <div className="text-sm text-muted">kcal eaten · no target set</div>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {MACROS.map((m) => <MacroBar key={m.key} label={m.label} color={m.color} value={totals[m.key]} target={targets?.[m.key]} />)}
        </div>
      </div>
    </Card>
  );
}

export default HeroCard;
