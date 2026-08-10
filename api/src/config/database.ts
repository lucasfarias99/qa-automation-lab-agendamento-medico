import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let db: Database.Database | null = null;

// api/src/config -> api/src -> api -> raiz do repositório.
// Resolvido a partir de __dirname (estável) em vez de process.cwd(), que muda
// conforme o comando é chamado com `npm --prefix api` (cwd vira api/).
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

export function getDb(): Database.Database {
  if (db) return db;

  const configuredPath = process.env.DB_PATH ?? './data/agendamento.db';
  const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(REPO_ROOT, configuredPath);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      workingHoursStart TEXT NOT NULL,
      workingHoursEnd TEXT NOT NULL,
      slotDurationMinutes INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      document TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      testRunId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patientId TEXT NOT NULL REFERENCES patients(id),
      doctorId TEXT NOT NULL REFERENCES doctors(id),
      scheduledAt TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      statusHistory TEXT NOT NULL,
      testRunId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot
      ON appointments (doctorId, scheduledAt)
      WHERE status = 'SCHEDULED';

    CREATE INDEX IF NOT EXISTS idx_appointments_test_run_id ON appointments (testRunId);
    CREATE INDEX IF NOT EXISTS idx_patients_test_run_id ON patients (testRunId);
  `);
}

export function closeDbConnection(): void {
  if (db) {
    db.close();
    db = null;
  }
}
