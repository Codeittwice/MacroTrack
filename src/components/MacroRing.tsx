/**
 * Reusable SVG calorie/macro progress ring. Pure presentation: caller supplies value/target/
 * colour. Centre text toggles between "remaining" (default) and "consumed" on click/tap.
 */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';

export interface MacroRingProps {
  value: number;
  target: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}

/** Guards against NaN/Infinity from bad input; treats non-finite as 0. */
function safe(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export function MacroRing({
  value,
  target,
  color,
  size = 180,
  stroke = 14,
  label = 'kcal',
  sublabel,
}: MacroRingProps) {
  const v = safe(value);
  const t = safe(target);
  const hasTarget = t > 0;
  const fraction = hasTarget ? v / t : 0;
  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const over = hasTarget && v > t * 1.05;

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animate from empty on mount.
  const [dashOffset, setDashOffset] = useState(circumference);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const raf = requestAnimationFrame(() => {
      setDashOffset(circumference * (1 - clampedFraction));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circumference, clampedFraction]);

  const [mode, setMode] = useState<'remaining' | 'consumed'>('remaining');

  const remaining = Math.round(t - v);
  const consumedRounded = Math.round(v);

  const ringColor = over ? 'var(--danger)' : color;
  const textColor = over ? 'var(--danger)' : undefined;

  const showRemaining = hasTarget && mode === 'remaining';
  const bigNumber = showRemaining ? Math.abs(remaining) : consumedRounded;
  const bigSign = showRemaining && remaining < 0 ? '+' : '';
  const smallText = showRemaining
    ? over
      ? `${label} over`
      : `${label} left`
    : `${label} eaten`;

  const ariaLabel = hasTarget
    ? `${fmt(v)} of ${fmt(t)} ${label} consumed, ${over ? `${fmt(Math.abs(remaining))} over` : `${fmt(Math.max(0, remaining))} remaining`}`
    : `${fmt(v)} ${label} consumed`;

  function toggleMode(e: React.MouseEvent) {
    e.stopPropagation();
    if (!hasTarget) return;
    setMode((m) => (m === 'remaining' ? 'consumed' : 'remaining'));
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative inline-flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-[600ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      <button
        type="button"
        onClick={toggleMode}
        disabled={!hasTarget}
        aria-label={showRemaining ? `Showing ${label} remaining, tap to show ${label} eaten` : `Showing ${label} eaten, tap to show ${label} remaining`}
        aria-pressed={mode === 'consumed'}
        className={cx(
          'absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-transparent',
          hasTarget && 'cursor-pointer',
        )}
      >
        <span className="text-2xl font-semibold text-text" style={textColor ? { color: textColor } : undefined}>
          {bigSign}
          {fmt(bigNumber)}
        </span>
        <span className="text-xs text-muted">{smallText}</span>
        {sublabel ? <span className="text-[11px] text-muted">{sublabel}</span> : null}
      </button>
    </div>
  );
}

export default MacroRing;
