// Test double for expo-sqlite's sync API backed by Node's built-in sqlite (in-memory).
import { DatabaseSync } from 'node:sqlite';

type P = unknown[];
const flat = (params: P) => (params.length === 1 && Array.isArray(params[0]) ? (params[0] as P) : params);

export function openDatabaseSync(_name: string) {
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  return {
    execSync: (sql: string) => db.exec(sql),
    runSync: (sql: string, ...params: P) => db.prepare(sql).run(...(flat(params) as never[])),
    getFirstSync: <T>(sql: string, ...params: P) => (db.prepare(sql).get(...(flat(params) as never[])) ?? null) as T | null,
    getAllSync: <T>(sql: string, ...params: P) => db.prepare(sql).all(...(flat(params) as never[])) as T[],
    withTransactionSync: (fn: () => void) => {
      if (depth) return fn();
      depth++;
      db.exec('BEGIN');
      try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } finally { depth--; }
    },
  };
}
export async function openDatabaseAsync() { throw new Error('not in tests'); }
export type SQLiteDatabase = ReturnType<typeof openDatabaseSync>;
