import type { Muscle } from '@/db/types';
import { MUSCLE_LABEL } from '@/lib/training/exercises';
import { WEEKLY_SET_TARGET } from '@/lib/training/volume';

/**
 * Anatomical front/back figure. Muscles are closed Catmull-Rom shapes drawn over a skin-tone body;
 * a stroke in the body colour leaves the thin gaps between muscle groups. Coordinates are for the
 * left half of a 200 x 450 viewBox and mirrored to the right.
 */
type Pt = [number, number];

function smooth(points: Pt[]): string {
  const n = points.length;
  const p = (i: number) => points[(i + n) % n];
  let d = `M ${p(0)[0]} ${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return `${d} Z`;
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [200 - x, y]);
const pair = (pts: Pt[]) => [smooth(pts), smooth(mirror(pts))];

/** Body outline, left half from the neck down and back up the inner leg; mirrored and joined. */
const HALF_BODY: Pt[] = [
  [90, 68], [78, 74], [62, 80], [52, 88], [47, 104], [45, 128], [43, 150], [40, 170], [37, 196], [35, 216], [31, 236], [33, 248], [40, 250], [44, 234],
  [47, 216], [52, 192], [56, 172], [59, 150], [63, 124], [66, 140], [68, 166], [70, 186], [67, 212], [65, 250], [67, 290], [71, 322], [69, 350],
  [72, 390], [76, 424], [68, 436], [74, 442], [92, 440], [93, 424], [95, 390], [96, 352], [96, 326], [98, 290], [99, 250], [100, 238],
];
const BODY = smooth([...HALF_BODY, ...mirror(HALF_BODY).reverse().slice(1)]);
const HEAD = { cx: 100, cy: 38, rx: 17, ry: 22 };
const NECK = smooth([[91, 54], [109, 54], [110, 72], [90, 72]]);

const FRONT: Partial<Record<Muscle, string[]>> = {
  traps: pair([[93, 70], [82, 75], [70, 81], [80, 85], [92, 80]]),
  frontDelts: pair([[72, 84], [62, 87], [57, 100], [61, 114], [69, 106], [75, 94]]),
  sideDelts: pair([[60, 86], [51, 94], [48, 110], [53, 120], [58, 106]]),
  chest: pair([[98, 86], [86, 84], [75, 92], [71, 108], [78, 121], [90, 124], [98, 120]]),
  biceps: pair([[62, 118], [52, 126], [49, 148], [53, 164], [62, 158], [65, 134]]),
  forearms: pair([[56, 166], [46, 176], [40, 198], [37, 218], [46, 220], [54, 198], [59, 178]]),
  abs: [
    ...pair([[98.5, 125], [89, 126], [88, 142], [98.5, 142]]),
    ...pair([[98.5, 145], [88, 145], [88, 162], [98.5, 162]]),
    ...pair([[98.5, 165], [88.5, 165], [89, 184], [98.5, 186]]),
    ...pair([[98.5, 189], [90, 189], [93, 212], [98.5, 222]]),
  ],
  obliques: pair([[86, 126], [74, 128], [68, 148], [70, 174], [76, 198], [87, 204], [86, 172], [85, 148]]),
  quads: [
    ...pair([[71, 220], [65, 244], [65, 286], [72, 314], [80, 304], [80, 258]]),
    ...pair([[86, 226], [81, 246], [81, 290], [87, 310], [92, 292], [92, 252]]),
    ...pair([[94, 282], [89, 300], [91, 316], [97, 314], [98, 294]]),
  ],
  adductors: pair([[97, 236], [93, 244], [92, 270], [96, 282], [99, 258]]),
  calves: [
    ...pair([[75, 330], [69, 350], [70, 390], [78, 412], [84, 386], [83, 346]]),
    ...pair([[92, 334], [88, 352], [89, 380], [94, 372], [96, 348]]),
  ],
};

const BACK: Partial<Record<Muscle, string[]>> = {
  traps: pair([[99, 62], [90, 70], [73, 81], [83, 92], [92, 118], [99, 142]]),
  rearDelts: pair([[72, 84], [61, 88], [56, 102], [62, 110], [72, 99]]),
  sideDelts: pair([[60, 86], [51, 94], [48, 110], [53, 120], [58, 106]]),
  upperBack: pair([[82, 95], [73, 99], [70, 113], [79, 124], [91, 122], [93, 108]]),
  lats: pair([[67, 114], [64, 142], [70, 172], [85, 198], [97, 178], [92, 132], [80, 124]]),
  lowerBack: pair([[98.5, 150], [93, 152], [91, 190], [94, 208], [98.5, 210]]),
  triceps: pair([[62, 116], [52, 124], [49, 148], [53, 166], [62, 158], [66, 132]]),
  forearms: pair([[56, 166], [46, 176], [40, 198], [37, 218], [46, 220], [54, 198], [59, 178]]),
  glutes: pair([[98.5, 212], [85, 208], [70, 218], [66, 240], [77, 258], [98.5, 258]]),
  hamstrings: [
    ...pair([[71, 260], [66, 288], [70, 316], [82, 324], [86, 292], [84, 262]]),
    ...pair([[88, 260], [86, 294], [88, 322], [97, 318], [99, 282], [97, 260]]),
  ],
  calves: [
    ...pair([[76, 326], [69, 346], [71, 376], [82, 390], [88, 352], [86, 328]]),
    ...pair([[90, 328], [88, 352], [90, 388], [98, 378], [99, 346], [97, 330]]),
  ],
};

const BODY_FILL = 'color-mix(in srgb, var(--muted) 30%, var(--surface))';
const BODY_LINE = 'color-mix(in srgb, var(--muted) 55%, var(--surface))';

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

/** Untrained muscles are a slightly darker body tone; below the guideline the green deepens with each set. */
export function muscleFill(sets: number): string {
  if (sets <= 0) return 'color-mix(in srgb, var(--muted) 48%, var(--surface))';
  if (sets < WEEKLY_SET_TARGET.min) return `color-mix(in srgb, var(--primary) ${Math.round(30 + (55 * sets) / WEEKLY_SET_TARGET.min)}%, var(--surface))`;
  if (sets <= WEEKLY_SET_TARGET.max) return 'var(--primary)';
  return 'var(--warning)';
}

export const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Figure({ shapes, label, props }: { shapes: Partial<Record<Muscle, string[]>>; label: string; props: MuscleMapProps }) {
  const { sets, selected, onSelect, compact } = props;
  const size = compact ? { width: 92, height: 207 } : { width: 160, height: 360 };
  const interactive = !!onSelect && !compact;
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 200 450" {...size} role="group" aria-label={`${label} muscles`}>
        <g pointerEvents="none" fill={BODY_FILL} stroke={BODY_LINE} strokeWidth={1.5} strokeLinejoin="round">
          <path d={BODY} />
          <path d={NECK} />
          <ellipse {...HEAD} />
        </g>
        {(Object.entries(shapes) as [Muscle, string[]][]).map(([m, paths]) => {
          const n = sets[m] ?? 0;
          const isSel = selected === m;
          return (
            <g
              key={m}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${MUSCLE_LABEL[m]}: ${fmtSets(n)} sets`}
              aria-pressed={interactive ? isSel : undefined}
              onClick={interactive ? () => onSelect!(m) : undefined}
              onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(m); } } : undefined}
              className={interactive ? 'cursor-pointer outline-none' : undefined}
              fill={muscleFill(n * (props.colorScale ?? 1))}
              stroke={isSel ? 'var(--text)' : BODY_FILL}
              strokeWidth={isSel ? 2.5 : 2}
              strokeLinejoin="round"
            >
              <title>{`${MUSCLE_LABEL[m]}: ${fmtSets(n)} sets`}</title>
              {paths.map((d, i) => <path key={i} d={d} />)}
            </g>
          );
        })}
      </svg>
      {!compact && <figcaption className="text-xs text-muted">{label}</figcaption>}
    </figure>
  );
}

/** Front and back body figure coloured by hard sets per muscle, against the 10–20 sets/week guideline. */
export function MuscleMap(props: MuscleMapProps) {
  return (
    <div>
      <div className="flex justify-center gap-3">
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
