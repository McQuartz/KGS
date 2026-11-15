import { useMemo } from 'react';
import { strengthScore } from '../../analysis';
import * as repo from '../../db/repo';
import type { Exercise, ID, WorkoutSet } from '../../domain/types';
import type { Format } from '../../lib/format';
import type { TFunc } from '../../i18n';
import { useQuery } from '../../lib/useQuery';

/** Map of all exercises (incl. archived) by id. */
export function useExerciseMap(): Map<ID, Exercise> {
  const list = useQuery(() => repo.listExercises(true), []);
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}

export const isCardio = (e: Exercise | undefined | null) => e?.type === 'cardio';

export const workingSets = (sets: WorkoutSet[]) => sets.filter((s) => !s.isWarmup);

export function setVolume(sets: WorkoutSet[]): number {
  return workingSets(sets).reduce((a, s) => a + s.weight * s.reps, 0);
}

/** Weight in display units, rounded to a sensible step for input prefill. */
export function toDisplayWeight(f: Format, kg: number): number {
  return f.imperial ? Math.round(f.wToDisplay(kg)) : Math.round(kg * 2) / 2;
}

/** "80 kg × 8" or "30 min · 5 km" */
export function setText(s: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec' | 'distanceM'>, ex: Exercise | undefined, f: Format, t: TFunc): string {
  if (isCardio(ex)) {
    const parts: string[] = [];
    if (s.durationSec) parts.push(`${f.numSmart(s.durationSec / 60, 1)} ${t('train.min')}`);
    if (s.distanceM) parts.push(`${f.numSmart(s.distanceM / 1000, 2)} km`);
    return parts.join(' · ') || '–';
  }
  if (s.weight <= 0) return `${s.reps} ${t('train.reps').toLowerCase()}`;
  return `${f.lift(s.weight)} ${f.wUnit} × ${s.reps}`;
}

/** "3×8 @ 80 kg" summary of a previous session. */
export function lastSummary(sets: WorkoutSet[], ex: Exercise | undefined, f: Format, t: TFunc): string | null {
  const ws = workingSets(sets);
  if (!ws.length) return null;
  if (isCardio(ex)) return setText(ws[ws.length - 1], ex, f, t);
  const first = ws[0];
  const same = ws.every((s) => s.weight === first.weight && s.reps === first.reps);
  if (same) {
    return first.weight > 0
      ? t('train.last.same', { n: ws.length, reps: first.reps, w: f.lift(first.weight), unit: f.wUnit })
      : t('train.last.bw', { n: ws.length, reps: first.reps });
  }
  const top = ws.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), ws[0]);
  return t('train.last.mixed', { n: ws.length, w: f.lift(top.weight), unit: f.wUnit, reps: top.reps });
}

/** Historical bests of finished sessions (working sets only) used to mark records during a workout. */
export function exerciseBaseline(exerciseId: ID): { has: boolean; maxWeight: number; maxScore: number } {
  let has = false;
  let maxWeight = 0;
  let maxScore = 0;
  for (const s of repo.exerciseSessions(exerciseId)) {
    for (const x of s.sets) {
      if (x.isWarmup) continue;
      has = true;
      maxWeight = Math.max(maxWeight, x.weight);
      maxScore = Math.max(maxScore, strengthScore(x.weight, x.reps));
    }
  }
  return { has, maxWeight, maxScore };
}

/** Ids of sets (in order) that beat the baseline and all earlier sets of the same exercise. */
export function prSetIds(sets: WorkoutSet[], base: { has: boolean; maxWeight: number; maxScore: number }): Set<ID> {
  const out = new Set<ID>();
  if (!base.has) return out;
  let w = base.maxWeight;
  let sc = base.maxScore;
  for (const s of sets) {
    if (s.isWarmup || s.weight <= 0) continue;
    const score = strengthScore(s.weight, s.reps);
    if (s.weight > w || score > sc * 1.001) out.add(s.id);
    w = Math.max(w, s.weight);
    sc = Math.max(sc, score);
  }
  return out;
}

/** "102.5 × 5" (no unit; the mockup's set rows) or "30 min · 5 km" for cardio. */
export function shortSetText(s: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec' | 'distanceM'>, ex: Exercise | undefined, f: Format, t: TFunc): string {
  if (isCardio(ex)) return setText(s, ex, f, t);
  if (s.weight <= 0) return `${s.reps} ${t('train.reps').toLowerCase()}`;
  return `${f.lift(s.weight)} × ${s.reps}`;
}

/** Best set of a previous session by weight then reps, formatted "102.5 × 5" plus its date. */
export function lastTop(sets: WorkoutSet[], ex: Exercise | undefined, f: Format, t: TFunc): string | null {
  const ws = workingSets(sets);
  if (!ws.length) return null;
  const top = isCardio(ex) ? ws[ws.length - 1] : ws.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), ws[0]);
  return `${shortSetText(top, ex, f, t)} · ${f.ago(top.ts)}`;
}
