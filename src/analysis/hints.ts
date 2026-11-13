import type { ID } from '../domain/types';
import type { Consistency, Plateau, SessionWithPRs } from './strength';
import type { GoalForecast, RateResult, TrendPoint } from './trend';
import { DAY } from './stats';

/**
 * Hints are language-neutral: `key` maps to an i18n string, `params` fill placeholders.
 * The UI shows them behind a subtle icon on the dashboard.
 */
export interface Hint {
  id: string;
  key:
    | 'hint.pr'
    | 'hint.plateau'
    | 'hint.rateFast'
    | 'hint.rateGain'
    | 'hint.goalEta'
    | 'hint.goalWrongWay'
    | 'hint.outlier'
    | 'hint.consistencyDrop'
    | 'hint.streak';
  tone: 'good' | 'neutral' | 'warn';
  params: Record<string, string | number>;
  /** optional deep link target */
  exerciseId?: ID;
}

export interface HintInput {
  now: number;
  weightTrend: TrendPoint[];
  weightRate: RateResult | null;
  goal: GoalForecast | null;
  goalWeight: number | null;
  /** per exercise detected PR sessions */
  prSessions: Record<ID, SessionWithPRs[]>;
  plateaus: Plateau[];
  consistency: Consistency | null;
  weeklyTarget: number;
}

export function buildHints(i: HintInput): Hint[] {
  const out: Hint[] = [];

  // Recent PRs (last 7 days)
  for (const [exerciseId, sessions] of Object.entries(i.prSessions)) {
    const recent = sessions.filter((s) => s.prs.length && i.now - s.ts <= 7 * DAY);
    const last = recent[recent.length - 1];
    if (last) {
      const pr = last.prs.find((p) => p.kind === 'weight') ?? last.prs.find((p) => p.kind === 'bucket') ?? last.prs[0];
      out.push({ id: `pr-${exerciseId}-${last.ts}`, key: 'hint.pr', tone: 'good', exerciseId, params: { kind: pr.kind, value: pr.value, bucket: pr.bucket ?? '' } });
    }
  }

  // Weight rate: losing faster than 1 % bodyweight/week, or gaining > 0.5 %/week
  if (i.weightRate) {
    if (i.weightRate.pctPerWeek < -1) out.push({ id: 'rate-fast', key: 'hint.rateFast', tone: 'warn', params: { pct: Math.abs(i.weightRate.pctPerWeek), perWeek: i.weightRate.perWeek } });
    else if (i.weightRate.pctPerWeek > 0.5) out.push({ id: 'rate-gain', key: 'hint.rateGain', tone: 'neutral', params: { pct: i.weightRate.pctPerWeek, perWeek: i.weightRate.perWeek } });
  }

  if (i.goal && i.goalWeight != null) {
    if (i.goal.status === 'on_track' && i.goal.eta) out.push({ id: 'goal-eta', key: 'hint.goalEta', tone: 'neutral', params: { eta: i.goal.eta, goal: i.goalWeight, weeks: Math.round(i.goal.weeks ?? 0) } });
    if (i.goal.status === 'wrong_direction') out.push({ id: 'goal-wrong', key: 'hint.goalWrongWay', tone: 'warn', params: { goal: i.goalWeight } });
  }

  // Latest weigh-in flagged as outlier within the last 3 days
  const lastW = i.weightTrend[i.weightTrend.length - 1];
  if (lastW && lastW.outlier && i.now - lastW.t <= 3 * DAY) {
    out.push({ id: `outlier-${lastW.t}`, key: 'hint.outlier', tone: 'neutral', params: { raw: lastW.raw, trend: lastW.trend } });
  }

  for (const p of i.plateaus.slice(0, 3)) {
    out.push({ id: `plateau-${p.exerciseId}`, key: 'hint.plateau', tone: 'neutral', exerciseId: p.exerciseId, params: { weeks: Math.floor(p.daysSincePR / 7) } });
  }

  if (i.consistency) {
    const c = i.consistency;
    const last4 = c.perWeek.slice(-5, -1);
    const avg4 = last4.reduce((a, w) => a + w.n, 0) / Math.max(1, last4.length);
    if (c.streakWeeks >= 4) out.push({ id: `streak-${c.streakWeeks}`, key: 'hint.streak', tone: 'good', params: { weeks: c.streakWeeks } });
    else if (c.avgPerWeek >= i.weeklyTarget * 0.8 && avg4 < i.weeklyTarget * 0.6) out.push({ id: 'consistency-drop', key: 'hint.consistencyDrop', tone: 'warn', params: { avg: avg4, target: i.weeklyTarget } });
  }

  return out;
}
