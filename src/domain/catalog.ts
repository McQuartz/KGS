import type { Exercise, Metric, MuscleGroup, WorkoutType } from './types';

export const BUILTIN_METRICS: Metric[] = [
  { id: 'weight', name: 'Weight', kind: 'weight', unit: null, decimals: 1, builtin: true, lowerIsBetter: true, sort: 0, archived: false },
  { id: 'bf', name: 'Body fat', kind: 'percent', unit: null, decimals: 1, builtin: true, lowerIsBetter: true, sort: 1, archived: false },
  { id: 'waist', name: 'Waist', kind: 'length', unit: null, decimals: 1, builtin: true, lowerIsBetter: true, sort: 2, archived: false },
  { id: 'muscle', name: 'Muscle mass', kind: 'weight', unit: null, decimals: 1, builtin: true, lowerIsBetter: false, sort: 3, archived: false },
];

/** Smoothing parameters per metric kind for the robust trend (see analysis/trend.ts). */
export const TREND_PARAMS: Record<string, { alpha: number; clip: number }> = {
  weight: { alpha: 0.1, clip: 1.1 },
  bf: { alpha: 0.35, clip: 1.4 },
  waist: { alpha: 0.4, clip: 2 },
  muscle: { alpha: 0.5, clip: 1.5 },
  default: { alpha: 0.4, clip: Infinity },
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'fullbody', 'cardio',
];

export const WORKOUT_TYPES: WorkoutType[] = [
  'chest', 'back', 'legs', 'shoulders', 'arms', 'push', 'pull', 'upper', 'lower', 'fullbody', 'cardio', 'other',
];

/** Which muscle groups are suggested first when picking exercises for a workout type. */
export const WORKOUT_TYPE_GROUPS: Record<WorkoutType, MuscleGroup[]> = {
  chest: ['chest', 'triceps', 'biceps', 'shoulders'],
  back: ['back', 'biceps', 'shoulders'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  shoulders: ['shoulders', 'triceps'],
  arms: ['biceps', 'triceps', 'forearms'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'],
  fullbody: ['fullbody', 'chest', 'back', 'quads', 'shoulders'],
  cardio: ['cardio'],
  other: [],
};

const ex = (id: string, name: string, muscleGroup: MuscleGroup, type: Exercise['type'] = 'strength'): Exercise => ({
  id, name, muscleGroup, type, builtin: true, archived: false,
});

export const BUILTIN_EXERCISES: Exercise[] = [
  ex('bench', 'Bench press', 'chest'),
  ex('incline_db', 'Incline DB press', 'chest'),
  ex('db_press', 'Dumbbell press', 'chest'),
  ex('cable_fly', 'Cable fly', 'chest'),
  ex('dips', 'Dips', 'chest'),
  ex('row', 'Barbell row', 'back'),
  ex('pulldown', 'Lat pulldown', 'back'),
  ex('pullup', 'Pull-up', 'back'),
  ex('cable_row', 'Seated cable row', 'back'),
  ex('deadlift', 'Deadlift', 'back'),
  ex('ohp', 'Overhead press', 'shoulders'),
  ex('lateral_raise', 'Lateral raise', 'shoulders'),
  ex('face_pull', 'Face pull', 'shoulders'),
  ex('curl', 'Biceps curl', 'biceps'),
  ex('hammer_curl', 'Hammer curl', 'biceps'),
  ex('pushdown', 'Triceps pushdown', 'triceps'),
  ex('skullcrusher', 'Skull crusher', 'triceps'),
  ex('squat', 'Squat', 'quads'),
  ex('leg_press', 'Leg press', 'quads'),
  ex('leg_ext', 'Leg extension', 'quads'),
  ex('rdl', 'Romanian deadlift', 'hamstrings'),
  ex('leg_curl', 'Leg curl', 'hamstrings'),
  ex('hip_thrust', 'Hip thrust', 'glutes'),
  ex('calf_raise', 'Calf raise', 'calves'),
  ex('plank', 'Plank', 'core'),
  ex('crunch', 'Cable crunch', 'core'),
  ex('run', 'Running', 'cardio', 'cardio'),
  ex('bike', 'Cycling', 'cardio', 'cardio'),
  ex('rower', 'Rowing machine', 'cardio', 'cardio'),
];
