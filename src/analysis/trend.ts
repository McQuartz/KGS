import type { Point } from '../domain/types';
import { DAY, WEEK, median, slope, sortByTime, startOfWeek } from './stats';

export interface TrendPoint extends Point {
  /** raw value */
  raw: number;
  /** smoothed trend value at this point */
  trend: number;
  /** true when the raw value was treated as an outlier (e.g. salty dinner, water weight) */
  outlier: boolean;
}

export interface TrendOptions {
  method?: 'ema' | 'median';
  /** EMA smoothing factor 0..1 (smaller = smoother) */
  alpha?: number;
  /** residual beyond which a point counts as outlier, in metric units */
  clip?: number;
  /** window size for the rolling median method */
  window?: number;
}

/**
 * Robust trend. Default: exponentially weighted moving average where residuals larger than
 * `clip` are flagged as outliers and only pull the trend by a damped amount. A single bad
 * day therefore barely moves the line. Alternative: rolling median over `window` entries,
 * with outliers flagged by MAD.
 */
export function robustTrend(points: Point[], opts: TrendOptions = {}): TrendPoint[] {
  const pts = sortByTime(points);
  if (!pts.length) return [];
  const method = opts.method ?? 'ema';
  if (method === 'median') return medianTrend(pts, opts.window ?? 7);

  const alpha = opts.alpha ?? 0.1;
  const clip = opts.clip ?? Infinity;
  // Seed with the median of the first few values so one bad first entry doesn't anchor everything.
  let s = median(pts.slice(0, 3).map((p) => p.v));
  return pts.map((p) => {
    const r = p.v - s;
    const outlier = Math.abs(r) > clip;
    const v = outlier ? s + Math.sign(r) * clip * 0.3 : p.v;
    s += alpha * (v - s);
    return { t: p.t, v: s, raw: p.v, trend: s, outlier };
  });
}

function medianTrend(pts: Point[], window: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const win = pts.slice(Math.max(0, i - window + 1), i + 1).map((p) => p.v);
    const m = median(win);
    // scaled MAD with a small floor (0.5 % of level) so identical values don't make everything an outlier
    const spread = Math.max(1.4826 * median(win.map((v) => Math.abs(v - m))), 0.005 * Math.abs(m), 1e-9);
    const outlier = win.length >= 4 && Math.abs(pts[i].v - m) > 3.5 * spread;
    out.push({ t: pts[i].t, v: m, raw: pts[i].v, trend: m, outlier });
  }
  return out;
}

export interface RateResult {
  /** change per week in metric units (negative = losing) */
  perWeek: number;
  /** change per week as % of current trend value */
  pctPerWeek: number;
  /** days covered by the data that went into the estimate */
  spanDays: number;
}

/**
 * Rate of change from the trend line over the last `days` days (default 28).
 * Needs at least 4 points spanning at least 7 days, otherwise null.
 */
export function trendRate(trend: Point[], now: number, days = 28): RateResult | null {
  const recent = trend.filter((p) => p.t >= now - days * DAY && p.t <= now);
  if (recent.length < 4) return null;
  const span = (recent[recent.length - 1].t - recent[0].t) / DAY;
  if (span < 7) return null;
  const perMs = slope(recent);
  if (!Number.isFinite(perMs)) return null;
  const perWeek = perMs * WEEK;
  const current = recent[recent.length - 1].v;
  return { perWeek, pctPerWeek: current ? (perWeek / current) * 100 : 0, spanDays: span };
}

export interface GoalForecast {
  status: 'reached' | 'on_track' | 'wrong_direction' | 'too_slow' | 'unknown';
  /** estimated date the goal is reached (only for on_track) */
  eta: number | null;
  weeks: number | null;
}

/** Forecast when `goal` will be reached at the current rate. Caps at 2 years ("too_slow"). */
export function goalForecast(current: number, goal: number, rate: RateResult | null, now: number): GoalForecast {
  const diff = goal - current;
  if (Math.abs(diff) < 0.05) return { status: 'reached', eta: now, weeks: 0 };
  if (!rate || Math.abs(rate.perWeek) < 1e-6) return { status: 'unknown', eta: null, weeks: null };
  if (Math.sign(rate.perWeek) !== Math.sign(diff)) return { status: 'wrong_direction', eta: null, weeks: null };
  const weeks = diff / rate.perWeek;
  if (weeks > 104) return { status: 'too_slow', eta: null, weeks };
  return { status: 'on_track', eta: now + weeks * WEEK, weeks };
}

export interface WeeklyBucket {
  /** week start (Monday 00:00) */
  t0: number;
  /** center of the week, for plotting */
  t: number;
  v: number;
  lo: number;
  hi: number;
  n: number;
}

/** Aggregate points by calendar week (mean or sum). */
export function weekly(points: Point[], agg: 'mean' | 'sum' = 'mean'): WeeklyBucket[] {
  const by = new Map<number, number[]>();
  for (const p of points) {
    const k = startOfWeek(p.t);
    const arr = by.get(k);
    if (arr) arr.push(p.v);
    else by.set(k, [p.v]);
  }
  return [...by.keys()]
    .sort((a, b) => a - b)
    .map((t0) => {
      const a = by.get(t0)!;
      const sum = a.reduce((x, y) => x + y, 0);
      return { t0, t: t0 + 3.5 * DAY, v: agg === 'sum' ? sum : sum / a.length, lo: Math.min(...a), hi: Math.max(...a), n: a.length };
    });
}
