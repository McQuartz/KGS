import * as SQLite from 'expo-sqlite';
import { BUILTIN_EXERCISES, BUILTIN_METRICS } from '../domain/catalog';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Migrations run in order; `user_version` tracks the applied count.
 * Never edit an existing migration – append a new one.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    unit TEXT,
    decimals INTEGER NOT NULL DEFAULT 1,
    builtin INTEGER NOT NULL DEFAULT 0,
    lower_is_better INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 100,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY NOT NULL,
    metric_id TEXT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
    ts INTEGER NOT NULL,
    value REAL NOT NULL,
    note TEXT,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_meas_metric_ts ON measurements(metric_id, ts);

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'strength',
    builtin INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    workout_type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS template_exercises (
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    sets INTEGER NOT NULL DEFAULT 3,
    warmup_sets INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (template_id, position)
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    workout_type TEXT NOT NULL,
    template_id TEXT,
    note TEXT,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);
  CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);

  CREATE TABLE IF NOT EXISTS sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    rest_sec INTEGER,
    is_warmup INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    duration_sec INTEGER,
    distance_m REAL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id);
  `,
];

function seedCatalog(db: SQLite.SQLiteDatabase) {
  for (const m of BUILTIN_METRICS) {
    db.runSync(
      `INSERT OR IGNORE INTO metrics (id,name,kind,unit,decimals,builtin,lower_is_better,sort,archived) VALUES (?,?,?,?,?,?,?,?,0)`,
      m.id, m.name, m.kind, m.unit, m.decimals, 1, m.lowerIsBetter ? 1 : 0, m.sort,
    );
  }
  for (const e of BUILTIN_EXERCISES) {
    db.runSync(
      `INSERT OR IGNORE INTO exercises (id,name,muscle_group,type,builtin,archived) VALUES (?,?,?,?,1,0)`,
      e.id, e.name, e.muscleGroup, e.type,
    );
  }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  const db = SQLite.openDatabaseSync('kgs.db');
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  while (v < MIGRATIONS.length) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
    v++;
  }
  // idempotent: adds builtins introduced in newer app versions
  db.withTransactionSync(() => seedCatalog(db));
  _db = db;
  return db;
}
