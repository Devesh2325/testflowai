/**
 * SQLite Database Manager for QA Recorder using better-sqlite3
 */

import path from "node:path";
import fs from "node:fs";

let dbInstance: any = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "qa_recorder.sqlite");

  try {
    const Database = require("better-sqlite3");
    dbInstance = new Database(dbPath);
    initSchema(dbInstance);
    console.log(`📦 SQLite database connected at: ${dbPath}`);
    return dbInstance;
  } catch (err: any) {
    console.warn(`⚠️ SQLite initialization warning (better-sqlite3): ${err.message}`);
    // Return mock database interface if native bindings need rebuild
    return {
      prepare: () => ({
        run: () => ({ lastInsertRowid: 1, changes: 1 }),
        get: () => null,
        all: () => [],
      }),
      exec: () => {},
    };
  }
}

function initSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_url TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      baseline_noise_json TEXT,
      schedule_cron TEXT DEFAULT '0 */6 * * *',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      status TEXT NOT NULL, -- passed, failed, flaky, running
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      error TEXT,
      artifacts_json TEXT,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL, -- passed, failed, healed
      selector_used TEXT,
      duration_ms INTEGER,
      screenshot_path TEXT,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );
  `);
}
