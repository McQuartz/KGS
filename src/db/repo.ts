// Data access layer. All functions are synchronous (expo-sqlite sync API) and take/return
// canonical metric values. After any write, call `bumpData()` (done here) so hooks re-query.
import type {
  Exercise, ExerciseSession, ID, Measurement, Metric, MuscleGroup, Template, TemplateExercise,
  Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from '../domain/types';
import { uid } from '../lib/id';
import { bumpData } from '../store/dataVersion';
import { getDb } from './db';

const b = (v: unknown) => !!v;

// ---------- key/value ----------
export function kvGet(key: string): string | null {
  return getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key=?', key)?.value ?? null;
}
export function kvSet(key: string, value: string) {
  getDb().runSync('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}

// ---------- metrics & measurements ----------
type MetricRow = { id: string; name: string; kind: Metric['kind']; unit: string | null; decimals: number; builtin: number; lower_is_better: number; sort: number; archived: number };
const toMetric = (r: MetricRow): Metric => ({
  id: r.id, name: r.name, kind: r.kind, unit: r.unit, decimals: r.decimals, builtin: b(r.builtin),
  lowerIsBetter: b(r.lower_is_better), sort: r.sort, archived: b(r.archived),
});

export function listMetrics(includeArchived = false): Metric[] {
  return getDb()
    .getAllSync<MetricRow>(`SELECT * FROM metrics ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY sort, name`)
    .map(toMetric);
}

export function createCustomMetric(name: string, unit: string, decimals = 1, lowerIsBetter = false): Metric {
  const id = uid();
  const sort = (getDb().getFirstSync<{ m: number }>('SELECT MAX(sort) m FROM metrics')?.m ?? 0) + 1;
  getDb().runSync(
    'INSERT INTO metrics (id,name,kind,unit,decimals,builtin,lower_is_better,sort,archived) VALUES (?,?,?,?,?,0,?,?,0)',
    id, name, 'custom', unit, decimals, lowerIsBetter ? 1 : 0, sort,
  );
  bumpData();
  return { id, name, kind: 'custom', unit, decimals, builtin: false, lowerIsBetter, sort, archived: false };
}

export function updateMetric(id: ID, patch: Partial<Pick<Metric, 'name' | 'unit' | 'decimals' | 'lowerIsBetter' | 'archived' | 'sort'>>) {
  const m = getDb().getFirstSync<MetricRow>('SELECT * FROM metrics WHERE id=?', id);
  if (!m) return;
  const n = { ...toMetric(m), ...patch };
  getDb().runSync(
    'UPDATE metrics SET name=?, unit=?, decimals=?, lower_is_better=?, archived=?, sort=? WHERE id=?',
    n.name, n.unit, n.decimals, n.lowerIsBetter ? 1 : 0, n.archived ? 1 : 0, n.sort, id,
  );
  bumpData();
}

export function deleteMetric(id: ID) {
  getDb().runSync('DELETE FROM metrics WHERE id=? AND builtin=0', id);
  bumpData();
}

type MeasRow = { id: string; metric_id: string; ts: number; value: number; note: string | null };
const toMeas = (r: MeasRow): Measurement => ({ id: r.id, metricId: r.metric_id, ts: r.ts, value: r.value, note: r.note });

export function listMeasurements(metricId: ID, from = 0, to = Number.MAX_SAFE_INTEGER): Measurement[] {
  return getDb()
    .getAllSync<MeasRow>('SELECT * FROM measurements WHERE metric_id=? AND ts BETWEEN ? AND ? ORDER BY ts', metricId, from, to)
    .map(toMeas);
}

export function latestMeasurement(metricId: ID): Measurement | null {
  const r = getDb().getFirstSync<MeasRow>('SELECT * FROM measurements WHERE metric_id=? ORDER BY ts DESC LIMIT 1', metricId);
  return r ? toMeas(r) : null;
}

/** Adds a measurement. For the same metric on the same calendar day, replaces the existing one. */
export function addMeasurement(metricId: ID, value: number, ts = Date.now(), note: string | null = null): Measurement {
  const d0 = new Date(ts);
  d0.setHours(0, 0, 0, 0);
  const d1 = d0.getTime() + 86_400_000;
  const db = getDb();
  const existing = db.getFirstSync<MeasRow>('SELECT * FROM measurements WHERE metric_id=? AND ts>=? AND ts<?', metricId, d0.getTime(), d1);
  if (existing) {
    db.runSync('UPDATE measurements SET value=?, ts=?, note=? WHERE id=?', value, ts, note, existing.id);
    bumpData();
    return { id: existing.id, metricId, ts, value, note };
  }
  const id = uid();
  db.runSync('INSERT INTO measurements (id,metric_id,ts,value,note) VALUES (?,?,?,?,?)', id, metricId, ts, value, note);
  bumpData();
  return { id, metricId, ts, value, note };
}

export function deleteMeasurement(id: ID) {
  getDb().runSync('DELETE FROM measurements WHERE id=?', id);
  bumpData();
}

// ---------- exercises ----------
type ExRow = { id: string; name: string; muscle_group: MuscleGroup; type: Exercise['type']; builtin: number; archived: number };
const toEx = (r: ExRow): Exercise => ({ id: r.id, name: r.name, muscleGroup: r.muscle_group, type: r.type, builtin: b(r.builtin), archived: b(r.archived) });

export function listExercises(includeArchived = false): Exercise[] {
  return getDb().getAllSync<ExRow>(`SELECT * FROM exercises ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY name`).map(toEx);
}
export function getExercise(id: ID): Exercise | null {
  const r = getDb().getFirstSync<ExRow>('SELECT * FROM exercises WHERE id=?', id);
  return r ? toEx(r) : null;
}
export function createExercise(name: string, muscleGroup: MuscleGroup, type: Exercise['type'] = 'strength'): Exercise {
  const id = uid();
  getDb().runSync('INSERT INTO exercises (id,name,muscle_group,type,builtin,archived) VALUES (?,?,?,?,0,0)', id, name, muscleGroup, type);
  bumpData();
  return { id, name, muscleGroup, type, builtin: false, archived: false };
}
export function updateExercise(id: ID, patch: Partial<Pick<Exercise, 'name' | 'muscleGroup' | 'archived'>>) {
  const e = getExercise(id);
  if (!e) return;
  const n = { ...e, ...patch };
  getDb().runSync('UPDATE exercises SET name=?, muscle_group=?, archived=? WHERE id=?', n.name, n.muscleGroup, n.archived ? 1 : 0, id);
  bumpData();
}

// ---------- templates ----------
type TplRow = { id: string; name: string; workout_type: WorkoutType; created_at: number };
type TplExRow = { template_id: string; position: number; exercise_id: string; sets: number; warmup_sets: number };

export function listTemplates(): Template[] {
  const db = getDb();
  const tpls = db.getAllSync<TplRow>('SELECT * FROM templates ORDER BY name');
  const exs = db.getAllSync<TplExRow>('SELECT * FROM template_exercises ORDER BY template_id, position');
  return tpls.map((t) => ({
    id: t.id, name: t.name, workoutType: t.workout_type, createdAt: t.created_at,
    exercises: exs.filter((e) => e.template_id === t.id).map((e) => ({ exerciseId: e.exercise_id, sets: e.sets, warmupSets: e.warmup_sets })),
  }));
}
export function getTemplate(id: ID): Template | null {
  return listTemplates().find((t) => t.id === id) ?? null;
}
export function saveTemplate(t: { id?: ID; name: string; workoutType: WorkoutType; exercises: TemplateExercise[] }): ID {
  const db = getDb();
  const id = t.id ?? uid();
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO templates (id,name,workout_type,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, workout_type=excluded.workout_type',
      id, t.name, t.workoutType, Date.now(),
    );
    db.runSync('DELETE FROM template_exercises WHERE template_id=?', id);
    t.exercises.forEach((e, i) =>
      db.runSync('INSERT INTO template_exercises (template_id,position,exercise_id,sets,warmup_sets) VALUES (?,?,?,?,?)', id, i, e.exerciseId, e.sets, e.warmupSets),
    );
  });
  bumpData();
  return id;
}
export function deleteTemplate(id: ID) {
  getDb().runSync('DELETE FROM templates WHERE id=?', id);
  bumpData();
}

// ---------- workouts ----------
type WRow = { id: string; started_at: number; ended_at: number | null; workout_type: WorkoutType; template_id: string | null; note: string | null };
type WERow = { id: string; workout_id: string; exercise_id: string; position: number; note: string | null };
type SetRow = { id: string; workout_exercise_id: string; position: number; weight: number; reps: number; rest_sec: number | null; is_warmup: number; note: string | null; duration_sec: number | null; distance_m: number | null; ts: number };

const toSet = (r: SetRow): WorkoutSet => ({
  id: r.id, workoutExerciseId: r.workout_exercise_id, position: r.position, weight: r.weight, reps: r.reps, restSec: r.rest_sec,
  isWarmup: b(r.is_warmup), note: r.note, durationSec: r.duration_sec, distanceM: r.distance_m, ts: r.ts,
});

function hydrateWorkouts(rows: WRow[]): Workout[] {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');
  const wes = db.getAllSync<WERow>(`SELECT * FROM workout_exercises WHERE workout_id IN (${ph}) ORDER BY position`, ...ids);
  const weIds = wes.map((w) => w.id);
  const sets = weIds.length
    ? db.getAllSync<SetRow>(`SELECT * FROM sets WHERE workout_exercise_id IN (${weIds.map(() => '?').join(',')}) ORDER BY position`, ...weIds)
    : [];
  const setsBy = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = setsBy.get(s.workout_exercise_id) ?? [];
    arr.push(toSet(s));
    setsBy.set(s.workout_exercise_id, arr);
  }
  return rows.map((r) => ({
    id: r.id, startedAt: r.started_at, endedAt: r.ended_at, workoutType: r.workout_type, templateId: r.template_id, note: r.note,
    exercises: wes
      .filter((we) => we.workout_id === r.id)
      .map((we): WorkoutExercise => ({ id: we.id, workoutId: we.workout_id, exerciseId: we.exercise_id, position: we.position, note: we.note, sets: setsBy.get(we.id) ?? [] })),
  }));
}

export function listWorkouts(from = 0, to = Number.MAX_SAFE_INTEGER, onlyFinished = true): Workout[] {
  const rows = getDb().getAllSync<WRow>(
    `SELECT * FROM workouts WHERE started_at BETWEEN ? AND ? ${onlyFinished ? 'AND ended_at IS NOT NULL' : ''} ORDER BY started_at DESC`,
    from, to,
  );
  return hydrateWorkouts(rows);
}
export function getWorkout(id: ID): Workout | null {
  return hydrateWorkouts(getDb().getAllSync<WRow>('SELECT * FROM workouts WHERE id=?', id))[0] ?? null;
}
/** The workout currently in progress (ended_at IS NULL), if any. */
export function getActiveWorkout(): Workout | null {
  return hydrateWorkouts(getDb().getAllSync<WRow>('SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'))[0] ?? null;
}

export function startWorkout(workoutType: WorkoutType, templateId: ID | null = null): ID {
  const id = uid();
  getDb().runSync('INSERT INTO workouts (id,started_at,ended_at,workout_type,template_id,note) VALUES (?,?,NULL,?,?,NULL)', id, Date.now(), workoutType, templateId);
  bumpData();
  return id;
}
export function updateWorkout(id: ID, patch: { workoutType?: WorkoutType; note?: string | null; templateId?: ID | null; startedAt?: number; endedAt?: number | null }) {
  const w = getDb().getFirstSync<WRow>('SELECT * FROM workouts WHERE id=?', id);
  if (!w) return;
  getDb().runSync(
    'UPDATE workouts SET workout_type=?, note=?, template_id=?, started_at=?, ended_at=? WHERE id=?',
    patch.workoutType ?? w.workout_type,
    patch.note !== undefined ? patch.note : w.note,
    patch.templateId !== undefined ? patch.templateId : w.template_id,
    patch.startedAt ?? w.started_at,
    patch.endedAt !== undefined ? patch.endedAt : w.ended_at,
    id,
  );
  bumpData();
}
/** Finishes the workout. Exercises without any set are dropped; an empty workout is deleted. */
export function finishWorkout(id: ID): boolean {
  const db = getDb();
  db.runSync('DELETE FROM workout_exercises WHERE workout_id=? AND id NOT IN (SELECT workout_exercise_id FROM sets)', id);
  const n = db.getFirstSync<{ n: number }>('SELECT COUNT(*) n FROM workout_exercises WHERE workout_id=?', id)?.n ?? 0;
  if (!n) {
    db.runSync('DELETE FROM workouts WHERE id=?', id);
    bumpData();
    return false;
  }
  db.runSync('UPDATE workouts SET ended_at=? WHERE id=?', Date.now(), id);
  bumpData();
  return true;
}
export function deleteWorkout(id: ID) {
  getDb().runSync('DELETE FROM workouts WHERE id=?', id);
  bumpData();
}

export function addWorkoutExercise(workoutId: ID, exerciseId: ID): ID {
  const db = getDb();
  const id = uid();
  const pos = (db.getFirstSync<{ m: number | null }>('SELECT MAX(position) m FROM workout_exercises WHERE workout_id=?', workoutId)?.m ?? -1) + 1;
  db.runSync('INSERT INTO workout_exercises (id,workout_id,exercise_id,position,note) VALUES (?,?,?,?,NULL)', id, workoutId, exerciseId, pos);
  bumpData();
  return id;
}
export function updateWorkoutExerciseNote(id: ID, note: string | null) {
  getDb().runSync('UPDATE workout_exercises SET note=? WHERE id=?', note, id);
  bumpData();
}
export function removeWorkoutExercise(id: ID) {
  getDb().runSync('DELETE FROM workout_exercises WHERE id=?', id);
  bumpData();
}

export type NewSet = Omit<WorkoutSet, 'id' | 'position' | 'ts' | 'workoutExerciseId'> & { ts?: number };

export function addSet(workoutExerciseId: ID, s: NewSet): ID {
  const db = getDb();
  const id = uid();
  const pos = (db.getFirstSync<{ m: number | null }>('SELECT MAX(position) m FROM sets WHERE workout_exercise_id=?', workoutExerciseId)?.m ?? -1) + 1;
  db.runSync(
    'INSERT INTO sets (id,workout_exercise_id,position,weight,reps,rest_sec,is_warmup,note,duration_sec,distance_m,ts) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    id, workoutExerciseId, pos, s.weight, s.reps, s.restSec, s.isWarmup ? 1 : 0, s.note, s.durationSec, s.distanceM, s.ts ?? Date.now(),
  );
  bumpData();
  return id;
}
export function updateSet(id: ID, patch: Partial<NewSet>) {
  const r = getDb().getFirstSync<SetRow>('SELECT * FROM sets WHERE id=?', id);
  if (!r) return;
  const n = { ...toSet(r), ...patch };
  getDb().runSync(
    'UPDATE sets SET weight=?, reps=?, rest_sec=?, is_warmup=?, note=?, duration_sec=?, distance_m=? WHERE id=?',
    n.weight, n.reps, n.restSec, n.isWarmup ? 1 : 0, n.note, n.durationSec, n.distanceM, id,
  );
  bumpData();
}
export function deleteSet(id: ID) {
  getDb().runSync('DELETE FROM sets WHERE id=?', id);
  bumpData();
}

/** Sets of the most recent finished session of this exercise (for prefill). */
export function lastSetsFor(exerciseId: ID, excludeWorkoutId?: ID): WorkoutSet[] {
  const db = getDb();
  const we = db.getFirstSync<{ id: string }>(
    `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id
     WHERE we.exercise_id=? AND w.ended_at IS NOT NULL ${excludeWorkoutId ? 'AND w.id<>?' : ''}
     AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id=we.id)
     ORDER BY w.started_at DESC LIMIT 1`,
    ...(excludeWorkoutId ? [exerciseId, excludeWorkoutId] : [exerciseId]),
  );
  if (!we) return [];
  return db.getAllSync<SetRow>('SELECT * FROM sets WHERE workout_exercise_id=? ORDER BY position', we.id).map(toSet);
}

/** All finished sessions per exercise, flattened for the analysis module. */
export function exerciseSessions(exerciseId?: ID): ExerciseSession[] {
  const db = getDb();
  const rows = db.getAllSync<{ we_id: string; workout_id: string; exercise_id: string; started_at: number; weight: number | null; reps: number | null; is_warmup: number | null }>(
    `SELECT we.id we_id, we.workout_id, we.exercise_id, w.started_at, s.weight, s.reps, s.is_warmup
     FROM workout_exercises we
     JOIN workouts w ON w.id=we.workout_id AND w.ended_at IS NOT NULL
     LEFT JOIN sets s ON s.workout_exercise_id=we.id
     ${exerciseId ? 'WHERE we.exercise_id=?' : ''}
     ORDER BY w.started_at, we.position, s.position`,
    ...(exerciseId ? [exerciseId] : []),
  );
  const by = new Map<string, ExerciseSession>();
  for (const r of rows) {
    let s = by.get(r.we_id);
    if (!s) {
      s = { workoutId: r.workout_id, exerciseId: r.exercise_id, ts: r.started_at, sets: [] };
      by.set(r.we_id, s);
    }
    if (r.weight != null && r.reps != null) s.sets.push({ weight: r.weight, reps: r.reps, isWarmup: b(r.is_warmup) });
  }
  return [...by.values()].filter((s) => s.sets.length);
}

export function workoutTimes(): number[] {
  return getDb().getAllSync<{ started_at: number }>('SELECT started_at FROM workouts WHERE ended_at IS NOT NULL ORDER BY started_at').map((r) => r.started_at);
}

// ---------- bulk ----------
export function wipeAll() {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync('DELETE FROM sets; DELETE FROM workout_exercises; DELETE FROM workouts; DELETE FROM template_exercises; DELETE FROM templates; DELETE FROM measurements; DELETE FROM metrics WHERE builtin=0; DELETE FROM exercises WHERE builtin=0;');
  });
  bumpData();
}

export function wipeDemo() {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync('DELETE FROM workouts WHERE demo=1; DELETE FROM templates WHERE demo=1; DELETE FROM measurements WHERE demo=1;');
  });
  bumpData();
}
