import type { ExerciseSession, ID, MuscleGroup, Point } from '../domain/types';
import { DAY, median, startOfWeek, valueAt } from './stats';

export type RepBucket = '1-5' | '6-12' | '13+';
export const REP_BUCKETS: RepBucket[] = ['1-5', '6-12', '13+'];

export function repBucket(reps: number): RepBucket {
  return reps <= 5 ? '1-5' : reps <= 12 ? '6-12' : '13+';
}

/**
 * Epley estimate. Only meaningful up to ~12 reps; above that we return NaN so that callers
 * never show a 1RM derived from high-rep sets. Shown in UI only when the user enables it.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps < 1 || weight <= 0) return NaN;
  if (reps === 1) return weight;
  if (reps > 12) return NaN;
  return weight * (1 + reps / 30);
}

/**
 * Strength score used internally for trends/index (not displayed as "1RM"). It's monotonic in
 * weight and reps and works for all rep ranges, so comparing it to the user's own baseline
 * is meaningful even when the absolute value isn't.
 */
export function strengthScore(weight: number, reps: number): number {
  if (reps < 1 || weight <= 0) return 0;
  return weight * (1 + Math.min(reps, 30) / 30);
}

export interface SessionStats {
  ts: number;
  workoutId: ID;
  /** heaviest working-set weight */
  topWeight: number;
  /** reps at the heaviest weight (best of ties) */
  topReps: number;
  /** sum of weight*reps of working sets */
  volume: number;
  workingSets: number;
  totalReps: number;
  /** best strength score of the session */
  score: number;
  /** best Epley 1RM (sets ≤12 reps), NaN if none */
  e1rm: number;
  /** heaviest weight per rep bucket */
  bucketTop: Partial<Record<RepBucket, { weight: number; reps: number }>>;
}

export function sessionStats(s: ExerciseSession): SessionStats {
  let topWeight = 0;
  let topReps = 0;
  let volume = 0;
  let workingSets = 0;
  let totalReps = 0;
  let score = 0;
  let e1rm = NaN;
  const bucketTop: SessionStats['bucketTop'] = {};
  for (const set of s.sets) {
    if (set.isWarmup || set.reps <= 0) continue;
    workingSets++;
    totalReps += set.reps;
    volume += set.weight * set.reps;
    if (set.weight > topWeight || (set.weight === topWeight && set.reps > topReps)) {
      topWeight = set.weight;
      topReps = set.reps;
    }
    score = Math.max(score, strengthScore(set.weight, set.reps));
    const e = estimate1RM(set.weight, set.reps);
    if (Number.isFinite(e)) e1rm = Number.isFinite(e1rm) ? Math.max(e1rm, e) : e;
    const b = repBucket(set.reps);
    const cur = bucketTop[b];
    if (!cur || set.weight > cur.weight || (set.weight === cur.weight && set.reps > cur.reps)) {
      bucketTop[b] = { weight: set.weight, reps: set.reps };
    }
  }
  return { ts: s.ts, workoutId: s.workoutId, topWeight, topReps, volume, workingSets, totalReps, score, e1rm, bucketTop };
}

export type PRKind = 'weight' | 'score' | 'volume' | 'bucket';

export interface PR {
  kind: PRKind;
  bucket?: RepBucket;
  value: number;
  previous: number;
}

export interface SessionWithPRs extends SessionStats {
  prs: PR[];
}

/**
 * Detect personal records per session, chronologically. The first `warmupSessions` sessions
 * only establish the baseline (otherwise every early session would be a "PR").
 */
export function detectPRs(sessions: ExerciseSession[], warmupSessions = 2): SessionWithPRs[] {
  const sorted = [...sessions].sort((a, b) => a.ts - b.ts);
  let maxTop = 0;
  let maxScore = 0;
  let maxVol = 0;
  const maxBucket: Partial<Record<RepBucket, number>> = {};
  return sorted.map((s, i) => {
    const st = sessionStats(s);
    const prs: PR[] = [];
    if (st.workingSets > 0) {
      const counts = i >= warmupSessions;
      if (counts && st.topWeight > maxTop) prs.push({ kind: 'weight', value: st.topWeight, previous: maxTop });
      if (counts && st.score > maxScore * 1.001) prs.push({ kind: 'score', value: st.score, previous: maxScore });
      if (counts && st.volume > maxVol) prs.push({ kind: 'volume', value: st.volume, previous: maxVol });
      for (const b of REP_BUCKETS) {
        const bt = st.bucketTop[b];
        if (!bt) continue;
        const prev = maxBucket[b];
        if (counts && prev !== undefined && bt.weight > prev) prs.push({ kind: 'bucket', bucket: b, value: bt.weight, previous: prev });
        maxBucket[b] = Math.max(prev ?? 0, bt.weight);
      }
      maxTop = Math.max(maxTop, st.topWeight);
      maxScore = Math.max(maxScore, st.score);
      maxVol = Math.max(maxVol, st.volume);
    }
    return { ...st, prs };
  });
}

/** Best (heaviest) set per rep bucket across all sessions, with date. */
export function bestByBucket(sessions: ExerciseSession[]): Partial<Record<RepBucket, { weight: number; reps: number; ts: number }>> {
  const out: Partial<Record<RepBucket, { weight: number; reps: number; ts: number }>> = {};
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.isWarmup || set.reps <= 0) continue;
      const b = repBucket(set.reps);
      const cur = out[b];
      if (!cur || set.weight > cur.weight || (set.weight === cur.weight && set.reps > cur.reps)) {
        out[b] = { weight: set.weight, reps: set.reps, ts: s.ts };
      }
    }
  }
  return out;
}

export type LiftStatusKind = 'up' | 'hold' | 'down' | 'unknown';
export interface LiftStatus {
  kind: LiftStatusKind;
  pct: number;
}

/**
 * Stronger / holding / declining: median score of the last 4 weeks vs. the 6 weeks before.
 * Medians make one bad day irrelevant. Threshold ±1.5 %.
 */
export function liftStatus(stats: SessionStats[], now: number, threshold = 1.5): LiftStatus {
  const rec = stats.filter((s) => s.score > 0 && now - s.ts <= 28 * DAY && s.ts <= now).map((s) => s.score);
  const prev = stats.filter((s) => s.score > 0 && now - s.ts > 28 * DAY && now - s.ts <= 70 * DAY).map((s) => s.score);
  if (rec.length < 2 || prev.length < 2) return { kind: 'unknown', pct: 0 };
  const pct = ((median(rec) - median(prev)) / median(prev)) * 100;
  return { kind: pct > threshold ? 'up' : pct < -threshold ? 'down' : 'hold', pct };
}

/**
 * Strength index: for each exercise with enough history, score relative to its own baseline
 * (median of first `baselineN` sessions) in %. The combined index at each date is the mean of
 * each exercise's most recent value (carried forward). Exercises with different goals
 * (heavy vs. endurance) are comparable because each is relative to itself.
 */
export function strengthIndex(
  byExercise: Record<ID, SessionStats[]>,
  opts: { baselineN?: number; minSessions?: number } = {},
): { combined: Point[]; perExercise: Record<ID, Point[]> } {
  const baselineN = opts.baselineN ?? 3;
  const minSessions = opts.minSessions ?? 4;
  const perExercise: Record<ID, Point[]> = {};
  for (const [id, stats] of Object.entries(byExercise)) {
    const s = stats.filter((x) => x.score > 0).sort((a, b) => a.ts - b.ts);
    if (s.length < minSessions) continue;
    const base = median(s.slice(0, baselineN).map((x) => x.score));
    if (!(base > 0)) continue;
    perExercise[id] = s.map((x) => ({ t: x.ts, v: (x.score / base - 1) * 100 }));
  }
  const ids = Object.keys(perExercise);
  const dates = [...new Set(ids.flatMap((id) => perExercise[id].map((p) => p.t)))].sort((a, b) => a - b);
  const idx: Record<ID, number> = Object.fromEntries(ids.map((id) => [id, -1]));
  const combined: Point[] = [];
  for (const t of dates) {
    let sum = 0;
    let n = 0;
    for (const id of ids) {
      const arr = perExercise[id];
      while (idx[id] + 1 < arr.length && arr[idx[id] + 1].t <= t) idx[id]++;
      if (idx[id] >= 0) {
        sum += arr[idx[id]].v;
        n++;
      }
    }
    if (n) combined.push({ t, v: sum / n });
  }
  return { combined, perExercise };
}

export interface Plateau {
  exerciseId: ID;
  /** days since the last score PR (or since first session if none) */
  daysSincePR: number;
  sessionsSincePR: number;
}

/**
 * Plateau: exercise trained regularly (≥ minSessions within `windowDays`) but no improvement
 * of the best score by > 1 % for at least `windowDays`.
 */
export function detectPlateaus(
  byExercise: Record<ID, SessionStats[]>,
  now: number,
  opts: { windowDays?: number; minSessions?: number } = {},
): Plateau[] {
  const windowDays = opts.windowDays ?? 42;
  const minSessions = opts.minSessions ?? 4;
  const out: Plateau[] = [];
  for (const [id, stats] of Object.entries(byExercise)) {
    const s = stats.filter((x) => x.score > 0).sort((a, b) => a.ts - b.ts);
    const recent = s.filter((x) => now - x.ts <= windowDays * DAY);
    if (recent.length < minSessions || s.length < minSessions + 2) continue;
    let best = 0;
    let lastPrTs = s[0].ts;
    let lastPrIdx = 0;
    s.forEach((x, i) => {
      if (x.score > best * 1.01) {
        best = x.score;
        lastPrTs = x.ts;
        lastPrIdx = i;
      }
    });
    const daysSincePR = (now - lastPrTs) / DAY;
    if (daysSincePR >= windowDays) out.push({ exerciseId: id, daysSincePR, sessionsSincePR: s.length - 1 - lastPrIdx });
  }
  return out.sort((a, b) => b.daysSincePR - a.daysSincePR);
}

export interface MuscleWeek {
  t0: number;
  group: MuscleGroup;
  sets: number;
  volume: number;
}

/** Working sets and volume per muscle group per calendar week. */
export function volumeByMuscle(sessions: ExerciseSession[], groupOf: (exerciseId: ID) => MuscleGroup | undefined): MuscleWeek[] {
  const map = new Map<string, MuscleWeek>();
  for (const s of sessions) {
    const g = groupOf(s.exerciseId);
    if (!g) continue;
    const t0 = startOfWeek(s.ts);
    const key = `${t0}|${g}`;
    let e = map.get(key);
    if (!e) {
      e = { t0, group: g, sets: 0, volume: 0 };
      map.set(key, e);
    }
    for (const set of s.sets) {
      if (set.isWarmup || set.reps <= 0) continue;
      e.sets++;
      e.volume += set.weight * set.reps;
    }
  }
  return [...map.values()].sort((a, b) => a.t0 - b.t0 || a.group.localeCompare(b.group));
}

/** Total working volume per workout day (for the volume chart). */
export function dailyVolume(sessions: ExerciseSession[]): Point[] {
  const by = new Map<number, number>();
  for (const s of sessions) {
    const st = sessionStats(s);
    const d = new Date(s.ts);
    d.setHours(12, 0, 0, 0);
    const k = d.getTime();
    by.set(k, (by.get(k) ?? 0) + st.volume);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
}

/** Score (or 1RM) divided by body weight trend at the same date. */
export function relativeStrength(stats: SessionStats[], bodyweightTrend: Point[], use1RM = false): Point[] {
  if (!bodyweightTrend.length) return [];
  return stats
    .map((s) => {
      const v = use1RM ? s.e1rm : s.topWeight;
      const bw = valueAt(bodyweightTrend, s.ts);
      return { t: s.ts, v: Number.isFinite(v) && bw > 0 ? v / bw : NaN };
    })
    .filter((p) => Number.isFinite(p.v) && p.v > 0);
}

export interface Consistency {
  /** workouts per week for each of the last `weeks` weeks (oldest first, current week last) */
  perWeek: { t0: number; n: number }[];
  avgPerWeek: number;
  /** fraction of completed weeks (excluding current) meeting target */
  hitRate: number;
  /** consecutive completed weeks meeting the target, plus the current one if already met */
  streakWeeks: number;
}

export function consistency(workoutTimes: number[], now: number, target = 3, weeks = 12): Consistency {
  const cur = startOfWeek(now);
  const perWeek: { t0: number; n: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setDate(d.getDate() - 7 * i);
    perWeek.push({ t0: d.getTime(), n: 0 });
  }
  const days = new Set(workoutTimes.map((t) => new Date(t).toDateString()));
  // count distinct training days, so two logged sessions on one day count once
  for (const ds of days) {
    const t0 = startOfWeek(new Date(ds).getTime());
    const w = perWeek.find((x) => x.t0 === t0);
    if (w) w.n++;
  }
  const done = perWeek.slice(0, -1);
  const hitRate = done.length ? done.filter((w) => w.n >= target).length / done.length : 0;
  let streak = perWeek[perWeek.length - 1].n >= target ? 1 : 0;
  for (let i = done.length - 1; i >= 0; i--) {
    if (done[i].n >= target) streak++;
    else break;
  }
  const avgPerWeek = done.length ? done.reduce((a, w) => a + w.n, 0) / done.length : 0;
  return { perWeek, avgPerWeek, hitRate, streakWeeks: streak };
}

