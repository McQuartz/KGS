import type { Hint } from '../analysis';
import type { Exercise, ID } from '../domain/types';
import type { TFunc } from '../i18n';
import type { Format } from './format';

/** Turns a language-neutral Hint into display text. */
export function hintText(h: Hint, t: TFunc, f: Format, exercises: Map<ID, Exercise>): string {
  const p = h.params;
  const exercise = h.exerciseId ? f.exerciseName(exercises.get(h.exerciseId)) : '';
  switch (h.key) {
    case 'hint.pr': {
      const v = `${f.lift(Number(p.value))} ${f.wUnit}`;
      const value = p.kind === 'volume' ? `${f.numSmart(f.wToDisplay(Number(p.value)), 0)} ${f.wUnit}` : p.bucket ? `${v} (${t(`bucket.${p.bucket}`)})` : v;
      return t(h.key, { exercise, value });
    }
    case 'hint.plateau':
      return t(h.key, { exercise, weeks: p.weeks });
    case 'hint.rateFast':
    case 'hint.rateGain':
      return t(h.key, { pct: f.num(Number(p.pct), 1), perWeek: `${f.signed(f.wToDisplay(Number(p.perWeek)), 2)} ${f.wUnit}` });
    case 'hint.goalEta':
      return t(h.key, { goal: `${f.bw(Number(p.goal))} ${f.wUnit}`, eta: f.dateLong(Number(p.eta)) });
    case 'hint.goalWrongWay':
      return t(h.key, { goal: `${f.bw(Number(p.goal))} ${f.wUnit}` });
    case 'hint.outlier':
      return t(h.key, { raw: `${f.bw(Number(p.raw))} ${f.wUnit}`, trend: `${f.bw(Number(p.trend))} ${f.wUnit}` });
    case 'hint.consistencyDrop':
      return t(h.key, { avg: f.num(Number(p.avg), 1), target: p.target });
    case 'hint.streak':
      return t(h.key, { weeks: p.weeks });
  }
}
