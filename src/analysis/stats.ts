import type { Point } from '../domain/types';

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Median absolute deviation (unscaled). */
export function mad(values: number[]): number {
  if (!values.length) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** Ordinary least squares slope of v over t (per ms). Returns NaN with < 2 distinct t. */
export function slope(points: Point[]): number {
  const n = points.length;
  if (n < 2) return NaN;
  const mt = mean(points.map((p) => p.t));
  const mv = mean(points.map((p) => p.v));
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.v - mv);
    den += (p.t - mt) ** 2;
  }
  return den === 0 ? NaN : num / den;
}

/** Local-calendar start of day (ms). */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 local of the week containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function sortByTime<T extends { t: number }>(pts: T[]): T[] {
  return [...pts].sort((a, b) => a.t - b.t);
}

/** Linear interpolation of a sorted series at time t (clamped at the ends). */
export function valueAt(series: Point[], t: number): number {
  if (!series.length) return NaN;
  if (t <= series[0].t) return series[0].v;
  const last = series[series.length - 1];
  if (t >= last.t) return last.v;
  let lo = 0;
  let hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = series[lo];
  const b = series[hi];
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
}
