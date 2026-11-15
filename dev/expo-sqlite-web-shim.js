// DEV ONLY (web): expo-sqlite's web worker can't do sync calls in headless Chromium, so for
// browser previews/screenshots Metro maps 'expo-sqlite' to this in-memory sql.js shim.
// Native builds (Expo Go) never load this file.
const initSqlJs = require('sql.js/dist/sql-asm.js');

let SQL = null;
const ready = initSqlJs().then((s) => { SQL = s; });

function bind(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

function openDatabaseSync() {
  if (!SQL) throw new Error('sql.js shim not ready – await __shimReady first');
  const db = new SQL.Database();
  const all = (sql, params) => {
    const st = db.prepare(sql);
    st.bind(bind(params));
    const rows = [];
    while (st.step()) rows.push(st.getAsObject());
    st.free();
    return rows;
  };
  let depth = 0;
  return {
    execSync: (sql) => { db.exec(sql); },
    runSync: (sql, ...params) => { db.run(sql, bind(params)); return { changes: db.getRowsModified(), lastInsertRowId: 0 }; },
    getAllSync: (sql, ...params) => all(sql, params),
    getFirstSync: (sql, ...params) => all(sql, params)[0] ?? null,
    withTransactionSync: (fn) => {
      if (depth) return fn();
      depth++;
      db.exec('BEGIN');
      try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } finally { depth--; }
    },
  };
}

module.exports = { openDatabaseSync, openDatabaseAsync: async () => ({ closeAsync: async () => {} }), __shimReady: ready };
