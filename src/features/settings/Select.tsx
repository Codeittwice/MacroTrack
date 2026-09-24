import { clsx } from 'clsx';

/** Native select styled to match the ui Input, for the small set of enum fields Settings needs. */
export function Select<T extends string | number>({
  value, onChange, options, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const match = options.find((o) => String(o.value) === e.target.value);
        if (match) onChange(match.value);
      }}
      className={clsx(
        'h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-primary',
        className,
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
