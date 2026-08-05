import { getDb } from '../config/database';
import type { Patient } from '../models/patient.model';

export function insertPatient(patient: Patient): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO patients (id, name, email, document, passwordHash, testRunId, createdAt)
    VALUES (@id, @name, @email, @document, @passwordHash, @testRunId, @createdAt)
  `).run(patient);
}

export function findPatientByEmail(email: string): Patient | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM patients WHERE email = ?').get(email) as Patient | undefined;
  return row ?? null;
}

export function findPatientById(id: string): Patient | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Patient | undefined;
  return row ?? null;
}

export function deletePatientsByTestRunId(testRunId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM patients WHERE testRunId = ?').run(testRunId);
  return result.changes;
}
