/**
 * Shared UI primitives (integrator-owned). Feature code composes these; add new primitives in
 * their own file under components/ui and re-export here via the integrator.
 */
import clsx from 'clsx';
import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export { clsx as cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary', size = 'md', className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-primary text-on-primary hover:brightness-110',
        variant === 'secondary' && 'border border-border bg-surface-2 hover:border-muted',
        variant === 'ghost' && 'hover:bg-surface-2',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={clsx('rounded-2xl bg-surface p-4', onClick && 'cursor-pointer', className)}>
      {children}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none placeholder:text-muted focus:border-primary',
        className,
      )}
      {...rest}
    />
  );
}

/** Numeric input that reports numbers (NaN-safe: empty → undefined). Accepts ',' as decimal. */
export function NumberInput({
  value, onValue, suffix, className, ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | undefined; onValue: (v: number | undefined) => void; suffix?: string;
}) {
  // Keep the raw text so partial input like "80." or "0," survives while typing.
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    const parsed = Number(text.replace(',', '.'));
    if (value === undefined ? text !== '' : parsed !== value) setText(value === undefined ? '' : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- only resync on external value changes
  return (
    <div className={clsx('relative', className)}>
      <Input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^-?\d*[.,]?\d*$/.test(raw)) return;
          setText(raw);
          const s = raw.replace(',', '.');
          if (s === '' || s === '-' || s === '.') return onValue(undefined);
          const n = Number(s);
          if (!Number.isNaN(n)) onValue(n);
        }}
        className={suffix ? 'pr-12' : undefined}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
    </div>
  );
}

/** Touch-first numeric control for flows where a device keyboard is unavailable. */
export function RangePicker({
  value, onValue, min, max, step = 1, suggestedValue, suffix, label,
}: {
  value: number | undefined;
  onValue: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suggestedValue: number;
  suffix: string;
  label: string;
}) {
  const current = value ?? suggestedValue;
  const decimals = Math.max(0, String(step).split('.')[1]?.length ?? 0);
  const format = (number: number) => number.toFixed(decimals);
  const update = (number: number) => onValue(Number(Math.min(max, Math.max(min, number)).toFixed(decimals)));

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => update(current - step)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-muted hover:text-text"
        >
          <Minus size={18} />
        </button>
        <output aria-live="polite" className="min-w-0 flex-1 text-center text-lg font-semibold">
          {format(current)} {suffix}
        </output>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => update(current + step)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-muted hover:text-text"
        >
          <Plus size={18} />
        </button>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={current}
        onFocus={() => {
          if (value === undefined) onValue(current);
        }}
        onPointerDown={() => {
          if (value === undefined) onValue(current);
        }}
        onChange={(event) => update(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between text-sm">
      <span className="text-muted">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange, className,
}: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('flex rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-lg px-2 py-1.5 text-sm transition',
            o.value === value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on mobile, centered dialog on desktop. */
export function Sheet({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface md:rounded-3xl',
          wide ? 'md:max-w-2xl' : 'md:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {right}
    </header>
  );
}

export function Stat({ label, value, sub, color }: { label: ReactNode; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {body && <p className="max-w-xs text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  nevo: { label: 'NEVO', cls: 'bg-indigo-500/15 text-indigo-400' },
  off: { label: 'OFF', cls: 'bg-green-500/15 text-green-400' },
  ah: { label: 'AH', cls: 'bg-sky-500/15 text-sky-400' },
  user: { label: 'Mine', cls: 'bg-surface-2 text-muted' },
  recipe: { label: 'Recipe', cls: 'bg-amber-500/15 text-amber-400' },
  ai: { label: 'AI estimate', cls: 'bg-violet-500/15 text-violet-400' },
  quick: { label: 'Quick', cls: 'bg-surface-2 text-muted' },
};

export function SourceBadge({ source }: { source: string }) {
  const b = SOURCE_BADGE[source] ?? SOURCE_BADGE.user;
  return <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', b.cls)}>{b.label}</span>;
}
