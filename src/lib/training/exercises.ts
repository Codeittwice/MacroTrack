/**
 * Built-in exercise library. Muscle mapping follows common hypertrophy practice: `primary` muscles
 * get a full set of volume credit, `secondary` muscles half (see volume.ts).
 */
import type { Equipment, ExerciseDef, Muscle } from '@/db/types';

type Row = [id: string, name: string, nameNl: string, equipment: Equipment, primary: Muscle[], secondary: Muscle[], kind?: ExerciseDef['kind'], met?: number];

const ROWS: Row[] = [
  // Chest
  ['bench-press', 'Bench press', 'Bankdrukken', 'barbell', ['chest'], ['frontDelts', 'triceps']],
  ['incline-bench-press', 'Incline bench press', 'Schuin bankdrukken', 'barbell', ['chest', 'frontDelts'], ['triceps']],
  ['decline-bench-press', 'Decline bench press', 'Declined bankdrukken', 'barbell', ['chest'], ['triceps']],
  ['close-grip-bench', 'Close-grip bench press', 'Smal bankdrukken', 'barbell', ['triceps', 'chest'], ['frontDelts']],
  ['db-bench-press', 'Dumbbell bench press', 'Dumbbell bankdrukken', 'dumbbell', ['chest'], ['frontDelts', 'triceps']],
  ['db-incline-press', 'Incline dumbbell press', 'Schuin dumbbell drukken', 'dumbbell', ['chest', 'frontDelts'], ['triceps']],
  ['db-fly', 'Dumbbell fly', 'Dumbbell flyes', 'dumbbell', ['chest'], ['frontDelts']],
  ['cable-fly', 'Cable fly', 'Kabel flyes', 'cable', ['chest'], ['frontDelts']],
  ['pec-deck', 'Pec deck', 'Butterfly machine', 'machine', ['chest'], []],
  ['machine-chest-press', 'Machine chest press', 'Borstpress machine', 'machine', ['chest'], ['frontDelts', 'triceps']],
  ['push-up', 'Push-up', 'Opdrukken', 'bodyweight', ['chest'], ['frontDelts', 'triceps', 'abs'], 'bodyweight'],
  ['dip', 'Dip', 'Dips', 'bodyweight', ['chest', 'triceps'], ['frontDelts'], 'bodyweight'],
  // Back
  ['deadlift', 'Deadlift', 'Deadlift', 'barbell', ['hamstrings', 'glutes', 'lowerBack'], ['traps', 'upperBack', 'lats', 'forearms', 'quads']],
  ['romanian-deadlift', 'Romanian deadlift', 'Roemeense deadlift', 'barbell', ['hamstrings', 'glutes'], ['lowerBack', 'forearms']],
  ['barbell-row', 'Barbell row', 'Barbell roeien', 'barbell', ['upperBack', 'lats'], ['rearDelts', 'biceps', 'lowerBack']],
  ['pendlay-row', 'Pendlay row', 'Pendlay row', 'barbell', ['upperBack', 'lats'], ['rearDelts', 'biceps', 'lowerBack']],
  ['db-row', 'One-arm dumbbell row', 'Eenarmig dumbbell roeien', 'dumbbell', ['lats', 'upperBack'], ['rearDelts', 'biceps']],
  ['seated-cable-row', 'Seated cable row', 'Kabel roeien zittend', 'cable', ['upperBack', 'lats'], ['rearDelts', 'biceps']],
  ['chest-supported-row', 'Chest-supported row', 'Borstgesteund roeien', 'machine', ['upperBack', 'lats'], ['rearDelts', 'biceps']],
  ['t-bar-row', 'T-bar row', 'T-bar roeien', 'barbell', ['upperBack', 'lats'], ['rearDelts', 'biceps', 'lowerBack']],
  ['pull-up', 'Pull-up', 'Optrekken', 'bodyweight', ['lats'], ['biceps', 'upperBack', 'forearms'], 'bodyweight'],
  ['chin-up', 'Chin-up', 'Chin-up', 'bodyweight', ['lats', 'biceps'], ['upperBack', 'forearms'], 'bodyweight'],
  ['lat-pulldown', 'Lat pulldown', 'Lat pulldown', 'cable', ['lats'], ['biceps', 'upperBack']],
  ['close-grip-pulldown', 'Close-grip pulldown', 'Smalle lat pulldown', 'cable', ['lats'], ['biceps', 'upperBack']],
  ['straight-arm-pulldown', 'Straight-arm pulldown', 'Pullover aan de kabel', 'cable', ['lats'], ['triceps']],
  ['db-pullover', 'Dumbbell pullover', 'Dumbbell pullover', 'dumbbell', ['lats', 'chest'], ['triceps']],
  ['face-pull', 'Face pull', 'Face pull', 'cable', ['rearDelts', 'upperBack'], ['traps']],
  ['barbell-shrug', 'Barbell shrug', 'Shrugs barbell', 'barbell', ['traps'], ['forearms']],
  ['db-shrug', 'Dumbbell shrug', 'Shrugs dumbbell', 'dumbbell', ['traps'], ['forearms']],
  ['back-extension', 'Back extension', 'Rugextensie', 'bodyweight', ['lowerBack', 'glutes'], ['hamstrings'], 'bodyweight'],
  ['good-morning', 'Good morning', 'Good morning', 'barbell', ['hamstrings', 'lowerBack'], ['glutes']],
  ['rack-pull', 'Rack pull', 'Rack pull', 'barbell', ['lowerBack', 'traps', 'glutes'], ['hamstrings', 'upperBack', 'forearms']],
  // Shoulders
  ['overhead-press', 'Overhead press', 'Military press', 'barbell', ['frontDelts'], ['sideDelts', 'triceps', 'upperBack']],
  ['db-shoulder-press', 'Dumbbell shoulder press', 'Dumbbell schouderdrukken', 'dumbbell', ['frontDelts'], ['sideDelts', 'triceps']],
  ['arnold-press', 'Arnold press', 'Arnold press', 'dumbbell', ['frontDelts', 'sideDelts'], ['triceps']],
  ['machine-shoulder-press', 'Machine shoulder press', 'Schouderpress machine', 'machine', ['frontDelts'], ['sideDelts', 'triceps']],
  ['lateral-raise', 'Lateral raise', 'Zijwaartse raise', 'dumbbell', ['sideDelts'], ['traps']],
  ['cable-lateral-raise', 'Cable lateral raise', 'Kabel zijwaartse raise', 'cable', ['sideDelts'], []],
  ['machine-lateral-raise', 'Machine lateral raise', 'Zijwaartse raise machine', 'machine', ['sideDelts'], []],
  ['front-raise', 'Front raise', 'Front raise', 'dumbbell', ['frontDelts'], []],
  ['rear-delt-fly', 'Rear delt fly', 'Reverse flyes', 'dumbbell', ['rearDelts'], ['upperBack']],
  ['reverse-pec-deck', 'Reverse pec deck', 'Reverse butterfly', 'machine', ['rearDelts'], ['upperBack']],
  ['upright-row', 'Upright row', 'Upright row', 'barbell', ['sideDelts', 'traps'], ['biceps']],
  // Arms
  ['barbell-curl', 'Barbell curl', 'Barbell curl', 'barbell', ['biceps'], ['forearms']],
  ['ez-bar-curl', 'EZ-bar curl', 'EZ-bar curl', 'barbell', ['biceps'], ['forearms']],
  ['db-curl', 'Dumbbell curl', 'Dumbbell curl', 'dumbbell', ['biceps'], ['forearms']],
  ['hammer-curl', 'Hammer curl', 'Hammer curl', 'dumbbell', ['biceps', 'forearms'], []],
  ['incline-db-curl', 'Incline dumbbell curl', 'Schuine dumbbell curl', 'dumbbell', ['biceps'], []],
  ['preacher-curl', 'Preacher curl', 'Preacher curl', 'machine', ['biceps'], []],
  ['cable-curl', 'Cable curl', 'Kabel curl', 'cable', ['biceps'], ['forearms']],
  ['concentration-curl', 'Concentration curl', 'Concentratie curl', 'dumbbell', ['biceps'], []],
  ['triceps-pushdown', 'Triceps pushdown', 'Triceps pushdown', 'cable', ['triceps'], []],
  ['overhead-triceps-extension', 'Overhead triceps extension', 'Triceps extensie boven hoofd', 'cable', ['triceps'], []],
  ['skull-crusher', 'Skull crusher', 'Skull crusher', 'barbell', ['triceps'], []],
  ['db-kickback', 'Dumbbell kickback', 'Triceps kickback', 'dumbbell', ['triceps'], []],
  ['bench-dip', 'Bench dip', 'Bankdips', 'bodyweight', ['triceps'], ['chest', 'frontDelts'], 'bodyweight'],
  ['wrist-curl', 'Wrist curl', 'Polscurl', 'dumbbell', ['forearms'], []],
  ['reverse-curl', 'Reverse curl', 'Reverse curl', 'barbell', ['forearms', 'biceps'], []],
  ['farmers-walk', "Farmer's walk", 'Farmer walk', 'dumbbell', ['forearms', 'traps'], ['abs', 'glutes']],
  // Legs
  ['back-squat', 'Back squat', 'Squat', 'barbell', ['quads', 'glutes'], ['adductors', 'lowerBack', 'hamstrings']],
  ['front-squat', 'Front squat', 'Front squat', 'barbell', ['quads'], ['glutes', 'abs', 'upperBack']],
  ['goblet-squat', 'Goblet squat', 'Goblet squat', 'dumbbell', ['quads', 'glutes'], ['adductors', 'abs']],
  ['hack-squat', 'Hack squat', 'Hack squat', 'machine', ['quads'], ['glutes']],
  ['leg-press', 'Leg press', 'Beenpers', 'machine', ['quads', 'glutes'], ['adductors', 'hamstrings']],
  ['bulgarian-split-squat', 'Bulgarian split squat', 'Bulgaarse split squat', 'dumbbell', ['quads', 'glutes'], ['adductors', 'hamstrings']],
  ['walking-lunge', 'Walking lunge', 'Lunges lopend', 'dumbbell', ['quads', 'glutes'], ['hamstrings', 'adductors']],
  ['step-up', 'Step-up', 'Step-up', 'dumbbell', ['quads', 'glutes'], ['hamstrings']],
  ['leg-extension', 'Leg extension', 'Beenstrekken', 'machine', ['quads'], []],
  ['lying-leg-curl', 'Lying leg curl', 'Liggende leg curl', 'machine', ['hamstrings'], ['calves']],
  ['seated-leg-curl', 'Seated leg curl', 'Zittende leg curl', 'machine', ['hamstrings'], []],
  ['nordic-curl', 'Nordic curl', 'Nordic curl', 'bodyweight', ['hamstrings'], ['glutes'], 'bodyweight'],
  ['hip-thrust', 'Hip thrust', 'Hip thrust', 'barbell', ['glutes'], ['hamstrings', 'quads']],
  ['glute-bridge', 'Glute bridge', 'Glute bridge', 'bodyweight', ['glutes'], ['hamstrings'], 'bodyweight'],
  ['cable-kickback', 'Cable glute kickback', 'Kabel kickback', 'cable', ['glutes'], ['hamstrings']],
  ['hip-abduction', 'Hip abduction', 'Abductor machine', 'machine', ['glutes'], []],
  ['hip-adduction', 'Hip adduction', 'Adductor machine', 'machine', ['adductors'], []],
  ['sumo-deadlift', 'Sumo deadlift', 'Sumo deadlift', 'barbell', ['glutes', 'quads', 'adductors'], ['hamstrings', 'lowerBack', 'traps', 'forearms']],
  ['kettlebell-swing', 'Kettlebell swing', 'Kettlebell swing', 'kettlebell', ['glutes', 'hamstrings'], ['lowerBack', 'abs', 'forearms']],
  ['standing-calf-raise', 'Standing calf raise', 'Kuitheffen staand', 'machine', ['calves'], []],
  ['seated-calf-raise', 'Seated calf raise', 'Kuitheffen zittend', 'machine', ['calves'], []],
  ['leg-press-calf-raise', 'Leg press calf raise', 'Kuitheffen beenpers', 'machine', ['calves'], []],
  // Core
  ['plank', 'Plank', 'Plank', 'bodyweight', ['abs'], ['obliques'], 'bodyweight'],
  ['side-plank', 'Side plank', 'Zijplank', 'bodyweight', ['obliques'], ['abs'], 'bodyweight'],
  ['crunch', 'Crunch', 'Crunch', 'bodyweight', ['abs'], [], 'bodyweight'],
  ['cable-crunch', 'Cable crunch', 'Kabel crunch', 'cable', ['abs'], ['obliques']],
  ['hanging-leg-raise', 'Hanging leg raise', 'Hangend beenheffen', 'bodyweight', ['abs'], ['obliques', 'forearms'], 'bodyweight'],
  ['ab-wheel', 'Ab wheel rollout', 'Ab wheel', 'other', ['abs'], ['lats', 'obliques']],
  ['russian-twist', 'Russian twist', 'Russian twist', 'bodyweight', ['obliques'], ['abs'], 'bodyweight'],
  ['pallof-press', 'Pallof press', 'Pallof press', 'cable', ['obliques', 'abs'], []],
  ['dead-bug', 'Dead bug', 'Dead bug', 'bodyweight', ['abs'], [], 'bodyweight'],
  // Full body / Olympic
  ['power-clean', 'Power clean', 'Power clean', 'barbell', ['glutes', 'hamstrings', 'traps'], ['quads', 'upperBack', 'lowerBack', 'forearms']],
  ['thruster', 'Thruster', 'Thruster', 'barbell', ['quads', 'frontDelts'], ['glutes', 'triceps']],
  ['burpee', 'Burpee', 'Burpee', 'bodyweight', ['quads', 'chest'], ['frontDelts', 'triceps', 'abs'], 'bodyweight', 8],
  // Cardio (MET values from the Compendium of Physical Activities)
  ['running', 'Running', 'Hardlopen', 'cardio', ['quads', 'calves'], ['hamstrings', 'glutes'], 'cardio', 9.8],
  ['treadmill-walk', 'Treadmill walk (incline)', 'Lopen op loopband (helling)', 'cardio', ['calves', 'glutes'], ['hamstrings'], 'cardio', 6],
  ['walking', 'Walking', 'Wandelen', 'cardio', ['calves'], ['quads'], 'cardio', 3.5],
  ['cycling', 'Cycling', 'Fietsen', 'cardio', ['quads'], ['glutes', 'calves'], 'cardio', 7.5],
  ['stationary-bike', 'Stationary bike', 'Hometrainer', 'cardio', ['quads'], ['glutes', 'calves'], 'cardio', 6.8],
  ['rowing-machine', 'Rowing machine', 'Roeimachine', 'cardio', ['upperBack', 'quads'], ['lats', 'biceps', 'glutes'], 'cardio', 7],
  ['elliptical', 'Elliptical', 'Crosstrainer', 'cardio', ['quads', 'glutes'], ['calves'], 'cardio', 5],
  ['stair-climber', 'Stair climber', 'Traploper', 'cardio', ['glutes', 'quads'], ['calves'], 'cardio', 9],
  ['swimming', 'Swimming', 'Zwemmen', 'cardio', ['lats', 'frontDelts'], ['triceps', 'quads'], 'cardio', 7],
  ['jump-rope', 'Jump rope', 'Touwtjespringen', 'cardio', ['calves'], ['quads', 'frontDelts'], 'cardio', 11],
];

/** MET per equipment/kind for strength work when an exercise has none (vigorous resistance training ~5). */
const DEFAULT_MET: Record<ExerciseDef['kind'], number> = { strength: 5, bodyweight: 4.5, cardio: 6 };

export const BUILT_IN_EXERCISES: ExerciseDef[] = ROWS.map(([id, name, nameNl, equipment, primary, secondary, kind, met]) => {
  const k = kind ?? (equipment === 'bodyweight' ? 'bodyweight' : 'strength');
  return { id, name, nameNl, equipment, primary, secondary, kind: k, met: met ?? DEFAULT_MET[k] };
});

const BY_ID = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

export function builtInExercise(id: string): ExerciseDef | undefined {
  return BY_ID.get(id);
}

export const MUSCLES: Muscle[] = ['chest', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'forearms', 'lats', 'upperBack', 'traps', 'lowerBack', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves'];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', frontDelts: 'Front delts', sideDelts: 'Side delts', rearDelts: 'Rear delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', lats: 'Lats', upperBack: 'Upper back', traps: 'Traps', lowerBack: 'Lower back', abs: 'Abs', obliques: 'Obliques',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Adductors', calves: 'Calves',
};
