// Glue between the DB and the pure analysis module. Screens use these via useQuery(...).
import {
  buildHints, consistency, dailyVolume, detectPlateaus, detectPRs, goalForecast, liftStatus,
  relativeStrength, robustTrend, strengthIndex, trendRate, volumeByMuscle, bestByBucket,
  type Hint, type LiftStatus, type SessionWithPRs, type TrendPoint,
} from '../analysis';
import { TREND_PARAMS } from '../domain/catalog';
import type { Exercise, ID, Metric } from '../domain/types';
import { exerciseSessions, listExercises, listMeasurements, listMetrics, workoutTimes } from '../db/repo';
import { getSettings } from '../store/settings';

export function metricTrend(metricId: ID): TrendPoint[] {
  const s = getSettings();
  const p = TREND_PARAMS[metricId] ?? TREND_PARAMS.default;
  const pts = listMeasurements(metricId).map((m) => ({ t: m.ts, v: m.value }));
  return robustTrend(pts, { method: s.trendMethod, alpha: p.alpha, clip: p.clip });
}

export interface WeightSummary {
  trend: TrendPoint[];
  current: number | null; // latest trend value
  lastRaw: TrendPoint | null;
  rate: ReturnType<typeof trendRate>;
  goal: ReturnType<typeof goalForecast> | null;
}

export function weightSummary(now = Date.now()): WeightSummary {
  const trend = metricTrend('weight');
  const last = trend[trend.length - 1] ?? null;
  const rate = trendRate(trend, now);
  const gw = getSettings().goalWeight;
  return {
    trend,
    current: last ? last.trend : null,
    lastRaw: last,
    rate,
    goal: last && gw != null ? goalForecast(last.trend, gw, rate, now) : null,
  };
}

export interface ExerciseAnalysis {
  exercise: Exercise;
  sessions: SessionWithPRs[];
  status: LiftStatus;
  buckets: ReturnType<typeof bestByBucket>;
}

/** Per-exercise stats (sessions + PRs + status), only exercises with ≥1 finished session. */
export function allExerciseAnalysis(now = Date.now()): ExerciseAnalysis[] {
  const exercises = listExercises(true);
  const sessions = exerciseSessions();
  const byEx = new Map<ID, typeof sessions>();
  for (const s of sessions) {
    const arr = byEx.get(s.exerciseId) ?? [];
    arr.push(s);
    byEx.set(s.exerciseId, arr);
  }
  const out: ExerciseAnalysis[] = [];
  for (const e of exercises) {
    const ss = byEx.get(e.id);
    if (!ss?.length || e.type !== 'strength') continue;
    const withPr = detectPRs(ss);
    out.push({ exercise: e, sessions: withPr, status: liftStatus(withPr, now), buckets: bestByBucket(ss) });
  }
  return out.sort((a, b) => (b.sessions.at(-1)?.ts ?? 0) - (a.sessions.at(-1)?.ts ?? 0));
}

export function strengthSummary(now = Date.now()) {
  const all = allExerciseAnalysis(now);
  const byId = Object.fromEntries(all.map((a) => [a.exercise.id, a.sessions]));
  const index = strengthIndex(byId);
  const t = index.combined;
  // overall status from the combined index (median of last 4 weeks vs. prior 6 weeks)
  const pseudo = t.map((p) => ({ ts: p.t, score: 100 + p.v })) as unknown as Parameters<typeof liftStatus>[0];
  return { exercises: all, index, status: liftStatus(pseudo, now) };
}

export function volumeSummary() {
  const sessions = exerciseSessions();
  const groups = new Map(listExercises(true).map((e) => [e.id, e.muscleGroup]));
  return { daily: dailyVolume(sessions), byMuscle: volumeByMuscle(sessions, (id) => groups.get(id)) };
}

export function relativeStrengthFor(exerciseId: ID) {
  const a = allExerciseAnalysis().find((x) => x.exercise.id === exerciseId);
  if (!a) return [];
  return relativeStrength(a.sessions, metricTrend('weight'), getSettings().show1rm);
}

export function consistencySummary(now = Date.now()) {
  return consistency(workoutTimes(), now, getSettings().weeklyTarget, 12);
}

export function hints(now = Date.now()): Hint[] {
  const s = getSettings();
  if (!s.hints) return [];
  const w = weightSummary(now);
  const strength = strengthSummary(now);
  const byId = Object.fromEntries(strength.exercises.map((a) => [a.exercise.id, a.sessions]));
  return buildHints({
    now,
    weightTrend: w.trend,
    weightRate: w.rate,
    goal: w.goal,
    goalWeight: s.goalWeight,
    prSessions: byId,
    plateaus: detectPlateaus(byId, now),
    consistency: workoutTimes().length ? consistencySummary(now) : null,
    weeklyTarget: s.weeklyTarget,
  });
}

export function visibleMetrics(): Metric[] {
  return listMetrics();
}
