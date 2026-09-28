import type { Muscle } from '@/db/types';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { WEEKLY_SET_TARGET } from '@/lib/training/volume';

type Shape = { kind: 'path'; d: string } | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number };

/** Mirror a left-side shape to the right (viewBox is 200 wide, centre at x = 100). */
const mirror = (s: Shape): Shape => {
  if (s.kind === 'ellipse') return { ...s, cx: 200 - s.cx, rot: s.rot ? -s.rot : undefined };
  return { kind: 'path', d: s.d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${200 - Number(x)} ${y}`) };
};
const both = (s: Shape): Shape[] => [s, mirror(s)];
const E = (cx: number, cy: number, rx: number, ry: number, rot?: number): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, rot });
const P = (d: string): Shape => ({ kind: 'path', d });

const FRONT: Partial<Record<Muscle, Shape[]>> = {
  traps: [P('M 84 64 L 100 60 L 116 64 L 110 71 L 90 71 Z')],
  frontDelts: both(E(69, 82, 10, 13, -15)),
  sideDelts: both(E(57, 86, 7, 13, 10)),
  chest: both(P('M 99 74 L 79 76 Q 71 92 79 104 Q 91 110 99 105 Z')),
  biceps: both(E(59, 120, 8.5, 19, 8)),
  forearms: both(E(51, 164, 7.5, 24, 10)),
  abs: [P('M 87 108 L 113 108 L 112 172 Q 100 178 88 172 Z')],
  obliques: both(P('M 85 110 Q 74 132 78 170 L 86 172 L 86 110 Z')),
  quads: both(P('M 75 194 Q 69 245 80 292 L 95 292 Q 99 245 95 200 Z')),
  adductors: [P('M 96 196 L 104 196 Q 106 232 101 262 L 99 262 Q 94 232 96 196 Z')],
  calves: both(E(84, 334, 8, 25)),
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [P('M 100 56 L 121 69 L 111 110 L 100 118 L 89 110 L 79 69 Z')],
  rearDelts: both(E(68, 83, 10, 12, 15)),
  sideDelts: both(E(57, 87, 7, 12, 10)),
  upperBack: both(P('M 89 86 L 77 92 Q 78 110 90 116 L 98 115 L 98 96 Z')),
  lats: both(P('M 77 102 Q 70 132 84 162 L 97 152 L 92 118 Z')),
  lowerBack: [P('M 89 150 L 111 150 L 112 178 Q 100 182 88 178 Z')],
  triceps: both(E(59, 120, 8.5, 19, 8)),
  forearms: both(E(51, 164, 7.5, 24, 10)),
  glutes: both(E(88, 200, 13, 16)),
  hamstrings: both(P('M 76 220 Q 71 258 82 294 L 97 294 Q 100 256 97 222 Z')),
  calves: both(E(84, 334, 10.5, 28)),
};

/** Grey body silhouette the muscles sit on. */
const SILHOUETTE = [
  E(100, 32, 18, 21),
  P('M 92 50 L 108 50 L 109 62 L 91 62 Z'),
  P('M 72 64 Q 100 56 128 64 Q 138 90 132 130 Q 128 170 124 186 L 76 186 Q 72 170 68 130 Q 62 90 72 64 Z'),
  ...both(P('M 62 76 Q 52 80 50 110 Q 45 150 44 190 L 56 192 Q 60 150 66 118 Z')),
  ...both(P('M 76 184 Q 68 240 76 300 Q 76 340 80 380 L 94 380 Q 96 340 96 300 Q 100 240 99 192 Z')),
];

export interface MuscleMapProps {
  /** hard sets per muscle (weekly) */
  sets: Partial<Record<Muscle, number>>;
  selected?: Muscle;
  onSelect?: (m: Muscle) => void;
  /** smaller, non-interactive version (workout summary) */
  compact?: boolean;
  /** multiplies sets for colouring only (e.g. one workout shown against a weekly scale) */
  colorScale?: number;
}

/** Untrained muscles stay faintly visible; below the guideline the green deepens with each set. */
export function muscleFill(sets: number): string {
  if (sets <= 0) return 'color-mix(in srgb, var(--muted) 22%, var(--surface))';
  if (sets < WEEKLY_SET_TARGET.min) return `color-mix(in srgb, var(--primary) ${Math.round(28 + (57 * sets) / WEEKLY_SET_TARGET.min)}%, var(--surface))`;
  if (sets <= WEEKLY_SET_TARGET.max) return 'var(--primary)';
  return 'var(--warning)';
}

function Figure({ shapes, label, props }: { shapes: Partial<Record<Muscle, Shape[]>>; label: string; props: MuscleMapProps }) {
  const { sets, selected, onSelect, compact } = props;
  const size = compact ? { width: 96, height: 202 } : { width: 170, height: 357 };
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 200 420" {...size} role="group" aria-label={`${label} muscles`}>
        {SILHOUETTE.map((s, i) => <ShapeEl key={i} s={s} fill="var(--surface-2)" stroke="color-mix(in srgb, var(--muted) 45%, transparent)" />)}
        {(Object.entries(shapes) as [Muscle, Shape[]][]).map(([m, list]) => {
          const n = sets[m] ?? 0;
          const interactive = !!onSelect && !compact;
          return (
            <g
              key={m}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${MUSCLE_LABEL[m]}: ${fmtSets(n)} sets`}
              aria-pressed={interactive ? selected === m : undefined}
              onClick={interactive ? () => onSelect!(m) : undefined}
              onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(m); } } : undefined}
              className={interactive ? 'cursor-pointer outline-none' : undefined}
            >
              <title>{`${MUSCLE_LABEL[m]}: ${fmtSets(n)} sets`}</title>
              {list.map((s, i) => <ShapeEl key={i} s={s} fill={muscleFill(n * (props.colorScale ?? 1))} stroke={selected === m ? 'var(--text)' : 'var(--bg)'} strokeWidth={selected === m ? 2.5 : 1.5} />)}
            </g>
          );
        })}
      </svg>
      {!compact && <figcaption className="text-xs text-muted">{label}</figcaption>}
    </figure>
  );
}

function ShapeEl({ s, fill, stroke, strokeWidth = 1.5 }: { s: Shape; fill: string; stroke: string; strokeWidth?: number }) {
  if (s.kind === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  return <path d={s.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
}

export const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Front and back body figure coloured by hard sets per muscle, against the 10–20 sets/week guideline. */
export function MuscleMap(props: MuscleMapProps) {
  return (
    <div>
      <div className="flex justify-center gap-4">
        <Figure shapes={FRONT} label="Front" props={props} />
        <Figure shapes={BACK} label="Back" props={props} />
      </div>
      {!props.compact && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <Legend color={muscleFill(0)} label="Not trained" />
          <Legend color={muscleFill(3)} label={`Under ${WEEKLY_SET_TARGET.min} sets`} />
          <Legend color={muscleFill(WEEKLY_SET_TARGET.min)} label={`${WEEKLY_SET_TARGET.min}–${WEEKLY_SET_TARGET.max} sets`} />
          <Legend color={muscleFill(WEEKLY_SET_TARGET.max + 1)} label={`Over ${WEEKLY_SET_TARGET.max}`} />
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: color }} />{label}</span>;
}
