// Backup: JSON export/import (full) and CSV export. All values are stored metric.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/db';
import { bumpData } from '../store/dataVersion';
import { getSettings, useSettings } from '../store/settings';

export type ImportMode = 'merge' | 'replace';

interface MetricJ { id: string; name: string; kind: string; unit: string | null; decimals: number; builtin: boolean; lowerIsBetter: boolean; sort: number; archived: boolean }
interface MeasJ { id: string; metricId: string; ts: number; value: number; note: string | null; demo?: boolean }
interface ExJ { id: string; name: string; muscleGroup: string; type: string; builtin: boolean; archived: boolean }
interface TplJ { id: string; name: string; workoutType: string; createdAt: number; demo?: boolean; exercises: { exerciseId: string; sets: number; warmupSets: number }[] }
interface SetJ { id: string; position: number; weight: number; reps: number; restSec: number | null; isWarmup: boolean; note: string | null; durationSec: number | null; distanceM: number | null; ts: number }
interface WeJ { id: string; exerciseId: string; position: number; note: string | null; sets: SetJ[] }
interface WoJ { id: string; startedAt: number; endedAt: number | null; workoutType: string; templateId: string | null; note: string | null; demo?: boolean; exercises: WeJ[] }

export interface BackupFile {
  app: 'kgs';
  version: 1;
  exportedAt: number;
  settings?: Record<string, unknown>;
  metrics: MetricJ[];
  measurements: MeasJ[];
  exercises: ExJ[];
  templates: TplJ[];
  workouts: WoJ[];
}

const flag = (v: unknown) => !!v;

// ---------- export ----------
export function exportJSON(): BackupFile {
  const db = getDb();
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(getSettings())) if (typeof v !== 'function' && k !== 'loaded') settings[k] = v;

  const metrics = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM metrics ORDER BY sort').map((r): MetricJ => ({
    id: String(r.id), name: String(r.name), kind: String(r.kind), unit: (r.unit as string | null) ?? null, decimals: Number(r.decimals),
    builtin: flag(r.builtin), lowerIsBetter: flag(r.lower_is_better), sort: Number(r.sort), archived: flag(r.archived),
  }));
  const measurements = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM measurements ORDER BY ts').map((r): MeasJ => ({
    id: String(r.id), metricId: String(r.metric_id), ts: Number(r.ts), value: Number(r.value), note: (r.note as string | null) ?? null, demo: flag(r.demo),
  }));
  // custom exercises + builtins that are archived (only their flag matters)
  const exercises = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM exercises WHERE builtin=0 OR archived=1 ORDER BY name').map((r): ExJ => ({
    id: String(r.id), name: String(r.name), muscleGroup: String(r.muscle_group), type: String(r.type), builtin: flag(r.builtin), archived: flag(r.archived),
  }));

  const tplRows = db.getAllSync<Record<string, number | string>>('SELECT * FROM templates ORDER BY created_at');
  const tplEx = db.getAllSync<Record<string, number | string>>('SELECT * FROM template_exercises ORDER BY template_id, position');
  const templates = tplRows.map((t): TplJ => ({
    id: String(t.id), name: String(t.name), workoutType: String(t.workout_type), createdAt: Number(t.created_at), demo: flag(t.demo),
    exercises: tplEx.filter((e) => e.template_id === t.id).map((e) => ({ exerciseId: String(e.exercise_id), sets: Number(e.sets), warmupSets: Number(e.warmup_sets) })),
  }));

  const woRows = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM workouts ORDER BY started_at');
  const weRows = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM workout_exercises ORDER BY workout_id, position');
  const setRows = db.getAllSync<Record<string, number | string | null>>('SELECT * FROM sets ORDER BY workout_exercise_id, position');
  const setsBy = new Map<string, SetJ[]>();
  for (const s of setRows) {
    const k = String(s.workout_exercise_id);
    const arr = setsBy.get(k) ?? [];
    arr.push({
      id: String(s.id), position: Number(s.position), weight: Number(s.weight), reps: Number(s.reps), restSec: s.rest_sec == null ? null : Number(s.rest_sec),
      isWarmup: flag(s.is_warmup), note: (s.note as string | null) ?? null, durationSec: s.duration_sec == null ? null : Number(s.duration_sec),
      distanceM: s.distance_m == null ? null : Number(s.distance_m), ts: Number(s.ts),
    });
    setsBy.set(k, arr);
  }
  const weBy = new Map<string, WeJ[]>();
  for (const w of weRows) {
    const k = String(w.workout_id);
    const arr = weBy.get(k) ?? [];
    arr.push({ id: String(w.id), exerciseId: String(w.exercise_id), position: Number(w.position), note: (w.note as string | null) ?? null, sets: setsBy.get(String(w.id)) ?? [] });
    weBy.set(k, arr);
  }
  const workouts = woRows.map((w): WoJ => ({
    id: String(w.id), startedAt: Number(w.started_at), endedAt: w.ended_at == null ? null : Number(w.ended_at), workoutType: String(w.workout_type),
    templateId: (w.template_id as string | null) ?? null, note: (w.note as string | null) ?? null, demo: flag(w.demo), exercises: weBy.get(String(w.id)) ?? [],
  }));

  return { app: 'kgs', version: 1, exportedAt: Date.now(), settings, metrics, measurements, exercises, templates, workouts };
}

// ---------- validation ----------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, k: string, where: string): string => {
  if (typeof o[k] !== 'string' || !(o[k] as string)) throw new Error(`${where}.${k}`);
  return o[k] as string;
};
const num = (o: Obj, k: string, where: string): number => {
  if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) throw new Error(`${where}.${k}`);
  return o[k] as number;
};
const numOr = (o: Obj, k: string, d: number) => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : d);
const nnum = (o: Obj, k: string): number | null => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : null);
const nstr = (o: Obj, k: string): string | null => (typeof o[k] === 'string' ? (o[k] as string) : null);
const arr = (o: Obj, k: string, optional = false): Obj[] => {
  const v = o[k];
  if (v === undefined && optional) return [];
  if (!Array.isArray(v) || !v.every(isObj)) throw new Error(k);
  return v as Obj[];
};

/** Throws an Error whose message names the offending field. Returns the typed backup. */
export function validateBackup(data: unknown): BackupFile {
  if (!isObj(data) || data.app !== 'kgs') throw new Error('app');
  if (typeof data.version !== 'number' || data.version > 1) throw new Error('version');
  const metrics = arr(data, 'metrics', true).map((m, i): MetricJ => ({
    id: str(m, 'id', `metrics[${i}]`), name: str(m, 'name', `metrics[${i}]`), kind: str(m, 'kind', `metrics[${i}]`), unit: nstr(m, 'unit'),
    decimals: numOr(m, 'decimals', 1), builtin: m.builtin === true, lowerIsBetter: m.lowerIsBetter === true, sort: numOr(m, 'sort', 100), archived: m.archived === true,
  }));
  const measurements = arr(data, 'measurements', true).map((m, i): MeasJ => ({
    id: str(m, 'id', `measurements[${i}]`), metricId: str(m, 'metricId', `measurements[${i}]`), ts: num(m, 'ts', `measurements[${i}]`),
    value: num(m, 'value', `measurements[${i}]`), note: nstr(m, 'note'), demo: m.demo === true,
  }));
  const exercises = arr(data, 'exercises', true).map((e, i): ExJ => ({
    id: str(e, 'id', `exercises[${i}]`), name: str(e, 'name', `exercises[${i}]`), muscleGroup: str(e, 'muscleGroup', `exercises[${i}]`),
    type: nstr(e, 'type') ?? 'strength', builtin: e.builtin === true, archived: e.archived === true,
  }));
  const templates = arr(data, 'templates', true).map((t, i): TplJ => ({
    id: str(t, 'id', `templates[${i}]`), name: str(t, 'name', `templates[${i}]`), workoutType: str(t, 'workoutType', `templates[${i}]`),
    createdAt: numOr(t, 'createdAt', Date.now()), demo: t.demo === true,
    exercises: arr(t, 'exercises', true).map((e, j) => ({ exerciseId: str(e, 'exerciseId', `templates[${i}].exercises[${j}]`), sets: numOr(e, 'sets', 3), warmupSets: numOr(e, 'warmupSets', 0) })),
  }));
  const workouts = arr(data, 'workouts', true).map((w, i): WoJ => ({
    id: str(w, 'id', `workouts[${i}]`), startedAt: num(w, 'startedAt', `workouts[${i}]`), endedAt: nnum(w, 'endedAt'), workoutType: nstr(w, 'workoutType') ?? 'other',
    templateId: nstr(w, 'templateId'), note: nstr(w, 'note'), demo: w.demo === true,
    exercises: arr(w, 'exercises', true).map((e, j): WeJ => ({
      id: str(e, 'id', `workouts[${i}].exercises[${j}]`), exerciseId: str(e, 'exerciseId', `workouts[${i}].exercises[${j}]`), position: numOr(e, 'position', j), note: nstr(e, 'note'),
      sets: arr(e, 'sets', true).map((s, k): SetJ => ({
        id: str(s, 'id', `sets[${k}]`), position: numOr(s, 'position', k), weight: numOr(s, 'weight', 0), reps: numOr(s, 'reps', 0), restSec: nnum(s, 'restSec'),
        isWarmup: s.isWarmup === true, note: nstr(s, 'note'), durationSec: nnum(s, 'durationSec'), distanceM: nnum(s, 'distanceM'), ts: numOr(s, 'ts', w.startedAt as number),
      })),
    })),
  }));
  return {
    app: 'kgs', version: 1, exportedAt: numOr(data, 'exportedAt', 0),
    settings: isObj(data.settings) ? data.settings : undefined,
    metrics, measurements, exercises, templates, workouts,
  };
}

export interface ImportSummary { measurements: number; workouts: number; templates: number; exercises: number }

export function summarize(b: BackupFile): ImportSummary {
  return { measurements: b.measurements.length, workouts: b.workouts.length, templates: b.templates.length, exercises: b.exercises.filter((e) => !e.builtin).length };
}

// ---------- import ----------
export function importJSON(data: unknown, mode: ImportMode): ImportSummary {
  const b = validateBackup(data);
  const db = getDb();
  db.withTransactionSync(() => {
    if (mode === 'replace') {
      db.execSync(
        'DELETE FROM sets; DELETE FROM workout_exercises; DELETE FROM workouts; DELETE FROM template_exercises; DELETE FROM templates; DELETE FROM measurements; DELETE FROM metrics WHERE builtin=0; DELETE FROM exercises WHERE builtin=0; UPDATE metrics SET archived=0; UPDATE exercises SET archived=0;',
      );
    }
    for (const m of b.metrics) {
      db.runSync(
        'INSERT OR IGNORE INTO metrics (id,name,kind,unit,decimals,builtin,lower_is_better,sort,archived) VALUES (?,?,?,?,?,?,?,?,?)',
        m.id, m.name, m.kind, m.unit, m.decimals, m.builtin ? 1 : 0, m.lowerIsBetter ? 1 : 0, m.sort, m.archived ? 1 : 0,
      );
      if (mode === 'replace' && m.builtin) db.runSync('UPDATE metrics SET archived=? WHERE id=?', m.archived ? 1 : 0, m.id);
    }
    for (const e of b.exercises) {
      db.runSync('INSERT OR IGNORE INTO exercises (id,name,muscle_group,type,builtin,archived) VALUES (?,?,?,?,?,?)', e.id, e.name, e.muscleGroup, e.type, e.builtin ? 1 : 0, e.archived ? 1 : 0);
      if (mode === 'replace' && e.builtin) db.runSync('UPDATE exercises SET archived=? WHERE id=?', e.archived ? 1 : 0, e.id);
    }
    for (const t of b.templates) {
      db.runSync('INSERT OR IGNORE INTO templates (id,name,workout_type,created_at,demo) VALUES (?,?,?,?,?)', t.id, t.name, t.workoutType, t.createdAt, t.demo ? 1 : 0);
      t.exercises.forEach((e, i) =>
        db.runSync('INSERT OR IGNORE INTO template_exercises (template_id,position,exercise_id,sets,warmup_sets) VALUES (?,?,?,?,?)', t.id, i, e.exerciseId, e.sets, e.warmupSets),
      );
    }
    for (const w of b.workouts) {
      db.runSync('INSERT OR IGNORE INTO workouts (id,started_at,ended_at,workout_type,template_id,note,demo) VALUES (?,?,?,?,?,?,?)', w.id, w.startedAt, w.endedAt, w.workoutType, w.templateId, w.note, w.demo ? 1 : 0);
      for (const we of w.exercises) {
        db.runSync('INSERT OR IGNORE INTO workout_exercises (id,workout_id,exercise_id,position,note) VALUES (?,?,?,?,?)', we.id, w.id, we.exerciseId, we.position, we.note);
        for (const s of we.sets) {
          db.runSync(
            'INSERT OR IGNORE INTO sets (id,workout_exercise_id,position,weight,reps,rest_sec,is_warmup,note,duration_sec,distance_m,ts) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            s.id, we.id, s.position, s.weight, s.reps, s.restSec, s.isWarmup ? 1 : 0, s.note, s.durationSec, s.distanceM, s.ts,
          );
        }
      }
    }
    for (const m of b.measurements) {
      db.runSync('INSERT OR IGNORE INTO measurements (id,metric_id,ts,value,note,demo) VALUES (?,?,?,?,?,?)', m.id, m.metricId, m.ts, m.value, m.note, m.demo ? 1 : 0);
    }
    if (mode === 'replace' && b.settings) {
      db.runSync('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', 'settings.v1', JSON.stringify(b.settings));
    }
  });
  if (mode === 'replace' && b.settings) useSettings.getState().load();
  bumpData();
  return summarize(b);
}

// ---------- CSV ----------
const csvCell = (v: string | number | null | undefined): string => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const iso = (ts: number) => new Date(ts).toISOString();

/** One combined CSV with a `type` column: measurement rows and set rows. Metric units (kg, cm). */
export function buildCSV(): string {
  const db = getDb();
  const head = ['type', 'datetime', 'name', 'value', 'unit', 'reps', 'warmup', 'workout_id', 'workout_type', 'note'];
  const lines: string[] = [head.join(',')];
  const meas = db.getAllSync<{ ts: number; value: number; note: string | null; name: string; builtin: number; kind: string; unit: string | null; id: string }>(
    'SELECT m.ts, m.value, m.note, x.name, x.builtin, x.kind, x.unit, x.id FROM measurements m JOIN metrics x ON x.id=m.metric_id ORDER BY m.ts',
  );
  for (const r of meas) {
    const unit = r.kind === 'weight' ? 'kg' : r.kind === 'length' ? 'cm' : r.kind === 'percent' ? '%' : r.unit ?? '';
    lines.push(['measurement', iso(r.ts), r.builtin ? r.id : r.name, r.value, unit, '', '', '', '', r.note].map(csvCell).join(','));
  }
  const sets = db.getAllSync<{ ts: number; weight: number; reps: number; is_warmup: number; note: string | null; ex: string; wid: string; wtype: string; builtin: number; exid: string }>(
    `SELECT s.ts, s.weight, s.reps, s.is_warmup, s.note, e.name ex, e.id exid, e.builtin, w.id wid, w.workout_type wtype
     FROM sets s JOIN workout_exercises we ON we.id=s.workout_exercise_id JOIN workouts w ON w.id=we.workout_id JOIN exercises e ON e.id=we.exercise_id
     ORDER BY s.ts, s.position`,
  );
  for (const r of sets) {
    lines.push(['set', iso(r.ts), r.builtin ? r.exid : r.ex, r.weight, 'kg', r.reps, r.is_warmup ? 1 : 0, r.wid, r.wtype, r.note].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

async function shareFile(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function shareJSONBackup() {
  await shareFile(`kgs-backup-${stamp()}.json`, JSON.stringify(exportJSON()), 'application/json');
}
export async function shareCSV() {
  await shareFile(`kgs-export-${stamp()}.csv`, buildCSV(), 'text/csv');
}
export const exportCSV = shareCSV;

/** Reads a picked file (uri from expo-document-picker) and parses it as JSON. */
export async function readJSONFile(uri: string): Promise<unknown> {
  const text = await new File(uri).text();
  return JSON.parse(text);
}
