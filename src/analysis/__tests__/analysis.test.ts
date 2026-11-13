import { describe, expect, it } from 'vitest';
import {
  DAY, median, mad, slope, valueAt, startOfWeek,
  robustTrend, trendRate, goalForecast, weekly,
  repBucket, estimate1RM, sessionStats, detectPRs, bestByBucket, liftStatus,
  strengthIndex, detectPlateaus, volumeByMuscle, relativeStrength, consistency, dailyVolume,
  buildHints,
} from '../index';
import type { ExerciseSession } from '../../domain/types';

const NOW = new Date(2026, 10, 13, 12).getTime();
const day = (d: number) => NOW - d * DAY;
const sess = (d: number, sets: [number, number, boolean?][], exerciseId = 'bench'): ExerciseSession => ({
  workoutId: `w${d}`, exerciseId, ts: day(d), sets: sets.map(([weight, reps, w]) => ({ weight, reps, isWarmup: !!w })),
});

describe('stats', () => {
  it('median/mad', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
  });
  it('slope and interpolation', () => {
    const pts = [0, 1, 2, 3].map((i) => ({ t: i * DAY, v: 10 - i }));
    expect(slope(pts) * DAY).toBeCloseTo(-1);
    expect(valueAt(pts, 1.5 * DAY)).toBeCloseTo(8.5);
    expect(valueAt(pts, -5)).toBe(10);
  });
  it('startOfWeek is Monday', () => {
    expect(new Date(startOfWeek(NOW)).getDay()).toBe(1);
  });
});

describe('robust trend', () => {
  const series = Array.from({ length: 60 }, (_, i) => ({ t: day(60 - i), v: 90 - i * 0.05 }));
  it('flags a single spike as outlier and barely moves', () => {
    const withSpike = series.map((p, i) => (i === 50 ? { ...p, v: p.v + 2.5 } : p));
    const tr = robustTrend(withSpike, { alpha: 0.1, clip: 1.1 });
    const clean = robustTrend(series, { alpha: 0.1, clip: 1.1 });
    expect(tr[50].outlier).toBe(true);
    expect(tr.filter((p) => p.outlier)).toHaveLength(1);
    expect(Math.abs(tr[50].trend - clean[50].trend)).toBeLessThan(0.1);
  });
  it('median method', () => {
    const pts = [1, 1, 1, 9, 1, 1, 1].map((v, i) => ({ t: i * DAY, v }));
    const tr = robustTrend(pts, { method: 'median', window: 5 });
    expect(tr[3].trend).toBe(1);
    expect(tr[3].outlier).toBe(true);
  });
  it('sorts input', () => {
    const tr = robustTrend([{ t: 2, v: 2 }, { t: 1, v: 1 }]);
    expect(tr[0].t).toBe(1);
  });
});

describe('rate & forecast', () => {
  const trend = Array.from({ length: 30 }, (_, i) => ({ t: day(29 - i), v: 90 - (i * 0.5) / 7 }));
  it('kg per week', () => {
    const r = trendRate(trend, NOW)!;
    expect(r.perWeek).toBeCloseTo(-0.5, 2);
    expect(r.pctPerWeek).toBeLessThan(0);
  });
  it('null with too little data', () => {
    expect(trendRate(trend.slice(-3), NOW)).toBeNull();
  });
  it('forecast', () => {
    const r = { perWeek: -0.5, pctPerWeek: -0.6, spanDays: 28 };
    const f = goalForecast(85, 80, r, NOW);
    expect(f.status).toBe('on_track');
    expect(f.weeks).toBeCloseTo(10);
    expect(goalForecast(85, 90, r, NOW).status).toBe('wrong_direction');
    expect(goalForecast(85, 85.01, r, NOW).status).toBe('reached');
    expect(goalForecast(85, 20, r, NOW).status).toBe('too_slow');
    expect(goalForecast(85, 80, null, NOW).status).toBe('unknown');
  });
  it('weekly buckets', () => {
    const w = weekly([{ t: day(0), v: 2 }, { t: day(0) + 1, v: 4 }], 'sum');
    expect(w[0].v).toBe(6);
    expect(w[0].n).toBe(2);
  });
});

describe('strength', () => {
  it('rep buckets', () => {
    expect([1, 5, 6, 12, 13, 30].map(repBucket)).toEqual(['1-5', '1-5', '6-12', '6-12', '13+', '13+']);
  });
  it('1RM only for <= 12 reps', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(Number.isNaN(estimate1RM(50, 15))).toBe(true);
  });
  it('session stats ignore warm-ups', () => {
    const st = sessionStats(sess(0, [[60, 10, true], [100, 5], [100, 4], [90, 8]]));
    expect(st.topWeight).toBe(100);
    expect(st.topReps).toBe(5);
    expect(st.workingSets).toBe(3);
    expect(st.volume).toBe(100 * 5 + 100 * 4 + 90 * 8);
    expect(st.bucketTop['1-5']).toEqual({ weight: 100, reps: 5 });
    expect(st.bucketTop['6-12']).toEqual({ weight: 90, reps: 8 });
  });
  it('detects PRs after baseline', () => {
    const s = detectPRs([sess(20, [[100, 5]]), sess(15, [[100, 5]]), sess(10, [[102.5, 5]]), sess(5, [[95, 5]])]);
    expect(s[0].prs).toHaveLength(0);
    expect(s[2].prs.map((p) => p.kind)).toContain('weight');
    expect(s[3].prs).toHaveLength(0);
  });
  it('bucket PR', () => {
    const s = detectPRs([sess(30, [[80, 8]]), sess(20, [[80, 8]]), sess(10, [[85, 8]])]);
    expect(s[2].prs.some((p) => p.kind === 'bucket' && p.bucket === '6-12')).toBe(true);
  });
  it('best by bucket', () => {
    const b = bestByBucket([sess(3, [[100, 3], [80, 10], [50, 15]]), sess(1, [[105, 2]])]);
    expect(b['1-5']!.weight).toBe(105);
    expect(b['13+']!.reps).toBe(15);
  });
  it('lift status uses medians and ignores one bad day', () => {
    const prev = [60, 50, 40, 35].map((d) => sessionStats(sess(d, [[100, 5]])));
    const rec = [20, 14, 7].map((d) => sessionStats(sess(d, [[105, 5]])));
    const bad = sessionStats(sess(2, [[80, 3]]));
    expect(liftStatus([...prev, ...rec, bad], NOW).kind).toBe('up');
    expect(liftStatus(prev.slice(0, 1), NOW).kind).toBe('unknown');
  });
  it('strength index relative to baseline', () => {
    const bench = [40, 30, 20, 10, 0].map((d, i) => sessionStats(sess(d, [[100 + i * 5, 5]])));
    const curl = [38, 28, 18, 8].map((d) => sessionStats(sess(d, [[15, 12]], 'curl')));
    const { combined, perExercise } = strengthIndex({ bench, curl });
    expect(perExercise.bench[4].v).toBeCloseTo(14.29, 1);
    expect(perExercise.curl.every((p) => Math.abs(p.v) < 1e-9)).toBe(true);
    expect(combined[combined.length - 1].v).toBeGreaterThan(0);
  });
  it('plateau detection', () => {
    const flat = [80, 70, 60, 50, 40, 30, 20, 10].map((d) => sessionStats(sess(d, [[100, 5]])));
    const up = [80, 70, 60, 50, 40, 30, 20, 10].map((d, i) => sessionStats(sess(d, [[100 + i * 2.5, 5]])));
    const p = detectPlateaus({ flat, up }, NOW);
    expect(p.map((x) => x.exerciseId)).toEqual(['flat']);
  });
  it('volume by muscle', () => {
    const v = volumeByMuscle([sess(1, [[100, 5], [50, 10, true]]), sess(1, [[20, 10]], 'curl')], (id) => (id === 'bench' ? 'chest' : 'biceps'));
    expect(v.find((x) => x.group === 'chest')).toMatchObject({ sets: 1, volume: 500 });
    expect(dailyVolume([sess(1, [[100, 5]]), sess(1, [[20, 10]], 'curl')])[0].v).toBe(700);
  });
  it('relative strength', () => {
    const r = relativeStrength([sessionStats(sess(1, [[100, 5]]))], [{ t: day(10), v: 80 }, { t: day(0), v: 80 }]);
    expect(r[0].v).toBeCloseTo(1.25);
  });
  it('consistency counts distinct days', () => {
    const times: number[] = [];
    for (let w = 0; w < 12; w++) for (let k = 0; k < 3; k++) times.push(NOW - w * 7 * DAY - k * DAY);
    times.push(NOW); // same day twice
    const c = consistency(times, NOW, 3, 12);
    expect(c.perWeek).toHaveLength(12);
    expect(c.hitRate).toBeGreaterThan(0.8);
    expect(c.streakWeeks).toBeGreaterThanOrEqual(10);
  });
});

describe('hints', () => {
  it('builds PR, rate and outlier hints', () => {
    const prSessions = { bench: detectPRs([sess(20, [[100, 5]]), sess(15, [[100, 5]]), sess(2, [[105, 5]])]) };
    const weightTrend = robustTrend([...Array.from({ length: 10 }, (_, i) => ({ t: day(10 - i), v: 80 })), { t: day(0), v: 83 }], { alpha: 0.1, clip: 1.1 });
    const hints = buildHints({
      now: NOW, weightTrend, weightRate: { perWeek: -1.2, pctPerWeek: -1.5, spanDays: 28 },
      goal: null, goalWeight: null, prSessions, plateaus: [], consistency: null, weeklyTarget: 3,
    });
    const keys = hints.map((h) => h.key);
    expect(keys).toContain('hint.pr');
    expect(keys).toContain('hint.rateFast');
    expect(keys).toContain('hint.outlier');
  });
});
