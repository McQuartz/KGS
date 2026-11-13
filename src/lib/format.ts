import { useMemo } from 'react';
import type { Exercise, Metric } from '../domain/types';
import { locale, translate } from '../i18n';
import { useSettings, type Lang, type Units } from '../store/settings';

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

export function makeFormat(lang: Lang, units: Units) {
  const loc = locale(lang);
  const imp = units === 'imperial';
  const num = (v: number, d = 1) =>
    Number.isFinite(v) ? v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
  /** like num but drops trailing ",0" */
  const numSmart = (v: number, maxD = 1) => {
    if (!Number.isFinite(v)) return '–';
    const r = Math.round(v * 10 ** maxD) / 10 ** maxD;
    return num(r, r % 1 ? maxD : 0);
  };

  const f = {
    lang,
    units,
    imperial: imp,
    locale: loc,
    num,
    numSmart,
    wUnit: imp ? 'lb' : 'kg',
    lenUnit: imp ? 'in' : 'cm',
    /** kg → display units (number) */
    wToDisplay: (kg: number) => (imp ? kg * LB_PER_KG : kg),
    /** display units → kg */
    wFromDisplay: (v: number) => (imp ? v / LB_PER_KG : v),
    lenToDisplay: (cm: number) => (imp ? cm / CM_PER_IN : cm),
    lenFromDisplay: (v: number) => (imp ? v * CM_PER_IN : v),
    /** body weight, 1 decimal: "82.4" */
    bw: (kg: number) => num(imp ? kg * LB_PER_KG : kg, 1),
    /** lifted weight, rounded to 0.5 kg / 1 lb, no trailing zero: "102.5" */
    lift: (kg: number) => {
      const v = imp ? Math.round(kg * LB_PER_KG) : Math.round(kg * 2) / 2;
      return numSmart(v, 1);
    },
    /** signed number "+1.2" / "−0.4" */
    signed: (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + num(Math.abs(v), d),
    pct: (v: number, d = 1) => `${num(v, d)} %`,
    date: (ts: number) => new Date(ts).toLocaleDateString(loc, { month: 'short', day: 'numeric' }),
    dateLong: (ts: number) => new Date(ts).toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    dateWeekday: (ts: number) => new Date(ts).toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' }),
    month: (ts: number) => new Date(ts).toLocaleDateString(loc, { month: 'short' }),
    time: (ts: number) => new Date(ts).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
    mmss: (sec: number) => {
      const s = Math.max(0, Math.round(sec));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    },
    ago: (ts: number, now = Date.now()) => {
      const a = new Date(ts);
      a.setHours(0, 0, 0, 0);
      const b = new Date(now);
      b.setHours(0, 0, 0, 0);
      const d = Math.round((b.getTime() - a.getTime()) / 86_400_000);
      return d <= 0 ? translate(lang, 'common.today') : d === 1 ? translate(lang, 'common.yesterday') : translate(lang, 'common.daysAgo', { n: d });
    },
    /** display unit of a metric */
    metricUnit: (m: Pick<Metric, 'kind' | 'unit'>) =>
      m.kind === 'weight' ? (imp ? 'lb' : 'kg') : m.kind === 'length' ? (imp ? 'in' : 'cm') : m.kind === 'percent' ? '%' : m.unit ?? '',
    metricToDisplay: (m: Pick<Metric, 'kind'>, v: number) =>
      m.kind === 'weight' ? (imp ? v * LB_PER_KG : v) : m.kind === 'length' ? (imp ? v / CM_PER_IN : v) : v,
    metricFromDisplay: (m: Pick<Metric, 'kind'>, v: number) =>
      m.kind === 'weight' ? (imp ? v / LB_PER_KG : v) : m.kind === 'length' ? (imp ? v * CM_PER_IN : v) : v,
    metricValue: (m: Pick<Metric, 'kind' | 'decimals'>, v: number) => num(f.metricToDisplay(m, v), m.decimals),
    metricName: (m: Pick<Metric, 'id' | 'name' | 'builtin'>) => (m.builtin ? translate(lang, `metric.${m.id}`) : m.name),
    exerciseName: (e: Pick<Exercise, 'id' | 'name' | 'builtin'> | null | undefined) =>
      !e ? '?' : e.builtin ? translate(lang, `ex.${e.id}`) : e.name,
  };
  return f;
}

export type Format = ReturnType<typeof makeFormat>;

export function useFormat(): Format {
  const lang = useSettings((s) => s.lang);
  const units = useSettings((s) => s.units);
  return useMemo(() => makeFormat(lang, units), [lang, units]);
}
