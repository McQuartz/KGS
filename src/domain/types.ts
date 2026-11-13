// Core domain types. All stored values are canonical metric units:
// weights in kg, lengths in cm, percentages as 0–100, durations in seconds, timestamps in ms.

export type ID = string;

export type MetricKind = 'weight' | 'length' | 'percent' | 'custom';

export interface Metric {
  id: ID; // builtin: 'weight' | 'bf' | 'waist' | 'muscle'; custom: uid
  name: string; // for builtins this is an i18n key fallback; UI translates builtins by id
  kind: MetricKind;
  unit: string | null; // only for kind 'custom' (free text, e.g. "mm", "bpm")
  decimals: number;
  builtin: boolean;
  lowerIsBetter: boolean;
  sort: number;
  archived: boolean;
}

export interface Measurement {
  id: ID;
  metricId: ID;
  ts: number;
  value: number;
  note: string | null;
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'fullbody'
  | 'cardio';

export type ExerciseType = 'strength' | 'cardio';

export interface Exercise {
  id: ID;
  name: string; // builtins translated by id in UI (i18n key `ex.<id>`), name is fallback
  muscleGroup: MuscleGroup;
  type: ExerciseType;
  builtin: boolean;
  archived: boolean;
}

export type WorkoutType =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'push'
  | 'pull'
  | 'upper'
  | 'lower'
  | 'fullbody'
  | 'cardio'
  | 'other';

export interface Template {
  id: ID;
  name: string;
  workoutType: WorkoutType;
  createdAt: number;
  exercises: TemplateExercise[];
}

export interface TemplateExercise {
  exerciseId: ID;
  sets: number; // working sets
  warmupSets: number;
}

export interface WorkoutSet {
  id: ID;
  workoutExerciseId: ID;
  position: number;
  weight: number; // kg (0 for bodyweight)
  reps: number;
  restSec: number | null; // rest taken before this set
  isWarmup: boolean;
  note: string | null;
  durationSec: number | null; // cardio
  distanceM: number | null; // cardio
  ts: number;
}

export interface WorkoutExercise {
  id: ID;
  workoutId: ID;
  exerciseId: ID;
  position: number;
  note: string | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: ID;
  startedAt: number;
  endedAt: number | null; // null = in progress
  workoutType: WorkoutType;
  templateId: ID | null;
  note: string | null;
  exercises: WorkoutExercise[];
}

/** Flattened view of one exercise inside one finished workout, used by analysis. */
export interface ExerciseSession {
  workoutId: ID;
  exerciseId: ID;
  ts: number;
  sets: { weight: number; reps: number; isWarmup: boolean }[];
}

export interface Point {
  t: number;
  v: number;
}
