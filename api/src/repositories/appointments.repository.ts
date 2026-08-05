import { getDb } from '../config/database';
import type { Appointment, StatusHistoryEntry } from '../models/appointment.model';

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

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patientId,
    doctorId: row.doctorId,
    scheduledAt: row.scheduledAt,
    status: row.status as Appointment['status'],
    notes: row.notes,
    statusHistory: JSON.parse(row.statusHistory) as StatusHistoryEntry[],
    testRunId: row.testRunId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toRow(appointment: Appointment) {
  return { ...appointment, statusHistory: JSON.stringify(appointment.statusHistory) };
}

export function insertAppointment(appointment: Appointment): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO appointments
      (id, patientId, doctorId, scheduledAt, status, notes, statusHistory, testRunId, createdAt, updatedAt)
    VALUES
      (@id, @patientId, @doctorId, @scheduledAt, @status, @notes, @statusHistory, @testRunId, @createdAt, @updatedAt)
  `).run(toRow(appointment));
}

export function updateAppointment(appointment: Appointment): void {
  const db = getDb();
  db.prepare(`
    UPDATE appointments
    SET status = @status, notes = @notes, statusHistory = @statusHistory, updatedAt = @updatedAt
    WHERE id = @id
  `).run(toRow(appointment));
}

export function findAppointmentById(id: string): Appointment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  return row ? toAppointment(row) : null;
}

export function findAppointmentsByTestRunId(testRunId: string): Appointment[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM appointments WHERE testRunId = ? ORDER BY createdAt')
    .all(testRunId) as AppointmentRow[];
  return rows.map(toAppointment);
}

export function findActiveByDoctorAndSlot(doctorId: string, scheduledAt: string): Appointment | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM appointments WHERE doctorId = ? AND scheduledAt = ? AND status = 'SCHEDULED'")
    .get(doctorId, scheduledAt) as AppointmentRow | undefined;
  return row ? toAppointment(row) : null;
}

export function findActiveByPatientAndSlot(patientId: string, scheduledAt: string): Appointment | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM appointments WHERE patientId = ? AND scheduledAt = ? AND status = 'SCHEDULED'")
    .get(patientId, scheduledAt) as AppointmentRow | undefined;
  return row ? toAppointment(row) : null;
}

export function findScheduledByDoctorAndDate(doctorId: string, dateOnly: string): Appointment[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM appointments WHERE doctorId = ? AND status = 'SCHEDULED' AND scheduledAt LIKE ?")
    .all(doctorId, `${dateOnly}%`) as AppointmentRow[];
  return rows.map(toAppointment);
}

export function findByDoctorAndSlot(doctorId: string, scheduledAt: string): Appointment[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM appointments WHERE doctorId = ? AND scheduledAt = ?')
    .all(doctorId, scheduledAt) as AppointmentRow[];
  return rows.map(toAppointment);
}

export function deleteAppointmentsByTestRunId(testRunId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM appointments WHERE testRunId = ?').run(testRunId);
  return result.changes;
}

export function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  return db.transaction(fn).immediate();
}
