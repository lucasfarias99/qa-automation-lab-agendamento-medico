import Database from 'better-sqlite3';
import path from 'node:path';

// tests/helpers -> tests -> raiz do repositório.
// Ancorado em __dirname pelo mesmo motivo do api/src/config/database.ts:
// process.cwd() muda dependendo de como o comando é disparado.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface StatusHistoryEntry {
  from: AppointmentStatus | null;
  to: AppointmentStatus;
  changedAt: string;
  reason?: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes: string | null;
  statusHistory: StatusHistoryEntry[];
  testRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentRow {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  statusHistory: string;
  testRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const configuredPath = process.env.DB_PATH ?? './data/agendamento.db';
    const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(REPO_ROOT, configuredPath);
    db = new Database(dbPath);
  }
  return db;
}

function toAppointment(row: AppointmentRow): AppointmentRecord {
  return {
    ...row,
    status: row.status as AppointmentStatus,
    statusHistory: JSON.parse(row.statusHistory) as StatusHistoryEntry[]
  };
}

export function findAppointmentById(id: string): AppointmentRecord | null {
  const row = getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  return row ? toAppointment(row) : null;
}

export function findAppointmentsByTestRunId(testRunId: string): AppointmentRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM appointments WHERE testRunId = ? ORDER BY createdAt')
    .all(testRunId) as AppointmentRow[];
  return rows.map(toAppointment);
}

export function countAppointmentsByTestRunId(testRunId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM appointments WHERE testRunId = ?')
    .get(testRunId) as { count: number };
  return row.count;
}

export function countPatientsByTestRunId(testRunId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM patients WHERE testRunId = ?')
    .get(testRunId) as { count: number };
  return row.count;
}

export function findAppointmentsByDoctorAndSlot(doctorId: string, scheduledAt: string): AppointmentRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM appointments WHERE doctorId = ? AND scheduledAt = ?')
    .all(doctorId, scheduledAt) as AppointmentRow[];
  return rows.map(toAppointment);
}

export function closeDbConnection(): void {
  if (db) {
    db.close();
    db = null;
  }
}
