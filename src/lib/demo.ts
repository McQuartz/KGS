// Demo data generator: ~6 months of plausible history (ported from the mockup's sample data).
// Every row is tagged demo=1 so repo.wipeDemo() removes it again.
import { getDb } from '../db/db';
import type { ID, WorkoutType } from '../domain/types';
import { bumpData } from '../store/dataVersion';
import { uid } from './id';

const DAY = 86_400_000;

interface ExDef {
  id: ID; s: number; e: number; inc: number; shape: 'up' | 'plateau' | 'decline';
  sets: [number, number][]; warm?: boolean;
}

const EX: Record<string, ExDef> = {
  bench: { id: 'bench', s: 90, e: 100, inc: 2.5, shape: 'up', sets: [[0, 5], [0, 5], [0, 4], [-10, 8], [-10, 8], [-10, 7]], warm: true },
  incline: { id: 'incline_db', s: 28, e: 32, inc: 2, shape: 'up', sets: [[0, 10], [0, 9], [0, 8]] },
  fly: { id: 'cable_fly', s: 15, e: 20, inc: 2.5, shape: 'up', sets: [[0, 12], [0, 12], [0, 11]] },
  curl: { id: 'curl', s: 14, e: 16, inc: 2, shape: 'plateau', sets: [[0, 10], [0, 10], [0, 9]] },
  pushdown: { id: 'pushdown', s: 27.5, e: 32.5, inc: 2.5, shape: 'up', sets: [[0, 12], [0, 11], [0, 10]] },
  row: { id: 'row', s: 80, e: 90, inc: 2.5, shape: 'up', sets: [[0, 8], [0, 8], [0, 8], [0, 7]], warm: true },
  pulldown: { id: 'pulldown', s: 65, e: 72.5, inc: 2.5, shape: 'up', sets: [[0, 10], [0, 10], [0, 9]] },
  ohp: { id: 'ohp', s: 55, e: 62.5, inc: 2.5, shape: 'decline', sets: [[0, 6], [0, 6], [0, 5]], warm: true },
  facepull: { id: 'face_pull', s: 20, e: 22.5, inc: 2.5, shape: 'plateau', sets: [[0, 15], [0, 15], [0, 15]] },
  squat: { id: 'squat', s: 110, e: 125, inc: 2.5, shape: 'plateau', sets: [[0, 5], [0, 5], [0, 5], [-15, 8], [-15, 8]], warm: true },
  rdl: { id: 'rdl', s: 100, e: 115, inc: 2.5, shape: 'up', sets: [[0, 8], [0, 8], [0, 8]] },
  legpress: { id: 'leg_press', s: 180, e: 210, inc: 10, shape: 'up', sets: [[0, 10], [0, 10], [0, 10]] },
  calf: { id: 'calf_raise', s: 60, e: 70, inc: 5, shape: 'plateau', sets: [[0, 12], [0, 12], [0, 12], [0, 12]] },
};

interface TplDef { name: string; type: WorkoutType; days: number[]; ex: string[]; min: number }
const TPL: TplDef[] = [
  { name: 'Chest day', type: 'chest', days: [2, 5], ex: ['bench', 'incline', 'fly', 'curl', 'pushdown'], min: 52 },
  { name: 'Back & shoulders', type: 'back', days: [1], ex: ['row', 'pulldown', 'ohp', 'facepull'], min: 47 },
  { name: 'Leg day', type: 'legs', days: [3], ex: ['squat', 'rdl', 'legpress', 'calf'], min: 55 },
];

const shapeF = (sh: ExDef['shape'], p: number) =>
  sh === 'up' ? Math.pow(p, 0.9) : sh === 'plateau' ? Math.min(1, p / 0.55) : p < 0.72 ? p / 0.72 : 1 - ((p - 0.72) / 0.28) * 0.5;

const round1 = (v: number) => Math.round(v * 10) / 10;

export function generateDemoData() {
  const db = getDb();
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) * 1.41; };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dayT = (d: number) => today.getTime() - d * DAY;

  db.withTransactionSync(() => {
    // avoid duplicates when generated twice
    db.execSync('DELETE FROM workouts WHERE demo=1; DELETE FROM templates WHERE demo=1; DELETE FROM measurements WHERE demo=1;');

    const addMeas = (metric: string, ts: number, v: number) =>
      db.runSync('INSERT INTO measurements (id,metric_id,ts,value,note,demo) VALUES (?,?,?,?,NULL,1)', uid(), metric, ts, v);

    // ----- measurements -----
    for (let d = 200; d >= 1; d--) {
      const p = 1 - d / 200;
      const base = 86.9 - 4.6 * p + 0.3 * Math.sin(d / 8) + (d < 72 && d > 44 ? 0.5 : 0);
      if (d !== 10 && rnd() < 0.13) continue;
      let v = base + gauss() * 0.3;
      if (d === 10) v = base + 1.7; // outlier
      else if (rnd() < 0.045) v += 1.0 + rnd() * 0.7;
      addMeas('weight', dayT(d), round1(v));
      if (d % 7 === 3) addMeas('bf', dayT(d), round1(21.6 - 3.1 * p + gauss() * 0.3));
      if (d % 14 === 12) addMeas('waist', dayT(d), round1(91.6 - 4.9 * p + gauss() * 0.35));
      if (d % 28 === 5) addMeas('muscle', dayT(d), round1(36.3 + 0.8 * p + gauss() * 0.12));
    }

    // ----- templates -----
    const tplIds: ID[] = TPL.map((tp) => {
      const id = uid();
      db.runSync('INSERT INTO templates (id,name,workout_type,created_at,demo) VALUES (?,?,?,?,1)', id, tp.name, tp.type, dayT(190));
      tp.ex.forEach((k, i) => {
        const ex = EX[k];
        db.runSync(
          'INSERT INTO template_exercises (template_id,position,exercise_id,sets,warmup_sets) VALUES (?,?,?,?,?)',
          id, i, ex.id, ex.sets.length, ex.warm ? 2 : 0,
        );
      });
      return id;
    });

    // ----- workouts -----
    type Sess = { w: number; r: number }[];
    interface Entry { tpl: number; key: string; sets: Sess }
    const days: { d: number; tpl: number; entries: Entry[] }[] = [];
    for (let d = 182; d >= 1; d--) {
      const wd = new Date(dayT(d)).getDay();
      const p = 1 - d / 182;
      TPL.forEach((tp, ti) => {
        if (!tp.days.includes(wd)) return;
        if (rnd() < 0.09) return; // skipped day
        const bad = rnd() < 0.09;
        const entries = tp.ex.map((k): Entry => {
          const ex = EX[k];
          const top = Math.round((ex.s + (ex.e - ex.s) * shapeF(ex.shape, p)) / ex.inc) * ex.inc - (bad ? 2 * ex.inc : 0);
          const sets = ex.sets.map(([off, r]) => ({
            w: Math.max(ex.inc, top + off),
            r: Math.max(1, r - (bad ? 1 + (rnd() < 0.5 ? 1 : 0) : 0) + (rnd() < 0.15 ? 1 : 0) - (rnd() < 0.15 ? 1 : 0)),
          }));
          return { tpl: ti, key: k, sets };
        });
        days.push({ d, tpl: ti, entries });
      });
    }
    // steady squat on the last leg day, one recent bench record on the last chest day
    const last = (ti: number, key: string) => {
      for (let i = days.length - 1; i >= 0; i--) if (days[i].tpl === ti) return days[i].entries.find((e) => e.key === key);
      return undefined;
    };
    const sq = last(2, 'squat');
    if (sq) sq.sets = [{ w: 125, r: 5 }, { w: 125, r: 5 }, { w: 125, r: 4 }, { w: 110, r: 8 }, { w: 110, r: 8 }];
    const bn = last(0, 'bench');
    if (bn) bn.sets = [{ w: 102.5, r: 5 }, { w: 102.5, r: 4 }, { w: 100, r: 4 }, { w: 92.5, r: 8 }, { w: 92.5, r: 8 }, { w: 92.5, r: 7 }];

    for (const day of days) {
      const tp = TPL[day.tpl];
      const wid = uid();
      const start = dayT(day.d) + 5 * 3_600_000 + Math.floor(rnd() * 3_600_000);
      const end = start + (tp.min + Math.round(gauss() * 4)) * 60_000;
      db.runSync(
        'INSERT INTO workouts (id,started_at,ended_at,workout_type,template_id,note,demo) VALUES (?,?,?,?,?,NULL,1)',
        wid, start, end, tp.type, tplIds[day.tpl],
      );
      let clock = start;
      day.entries.forEach((en, pos) => {
        const ex = EX[en.key];
        const weId = uid();
        db.runSync('INSERT INTO workout_exercises (id,workout_id,exercise_id,position,note) VALUES (?,?,?,?,NULL)', weId, wid, ex.id, pos);
        let sp = 0;
        const addSet = (w: number, r: number, warm: boolean, rest: number | null) => {
          clock += warm ? 60_000 : 150_000;
          db.runSync(
            'INSERT INTO sets (id,workout_exercise_id,position,weight,reps,rest_sec,is_warmup,note,duration_sec,distance_m,ts) VALUES (?,?,?,?,?,?,?,NULL,NULL,NULL,?)',
            uid(), weId, sp++, w, r, rest, warm ? 1 : 0, Math.min(clock, end),
          );
        };
        if (ex.warm) {
          const top = en.sets[0].w;
          addSet(Math.max(ex.inc, Math.round((top * 0.5) / ex.inc) * ex.inc), 8, true, null);
          addSet(Math.max(ex.inc, Math.round((top * 0.75) / ex.inc) * ex.inc), 4, true, 60);
        }
        en.sets.forEach((s, i) => addSet(s.w, s.r, false, i === 0 ? null : i < 3 ? 150 : 90));
      });
    }
  });
  bumpData();
}
