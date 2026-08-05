import { getDb } from '../config/database';
import type { Doctor } from '../models/doctor.model';

interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  active: number;
}

function toDoctor(row: DoctorRow): Doctor {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty as Doctor['specialty'],
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    slotDurationMinutes: row.slotDurationMinutes,
    active: row.active === 1
  };
}

export function findAllDoctors(specialty?: string): Doctor[] {
  const db = getDb();
  const rows = specialty
    ? (db.prepare('SELECT * FROM doctors WHERE specialty = ? ORDER BY id').all(specialty) as DoctorRow[])
    : (db.prepare('SELECT * FROM doctors ORDER BY id').all() as DoctorRow[]);
  return rows.map(toDoctor);
}

export function findDoctorById(id: string): Doctor | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as DoctorRow | undefined;
  return row ? toDoctor(row) : null;
}
