import { getDb } from './database';
import type { Doctor } from '../models/doctor.model';

const DOCTORS: Doctor[] = [
  {
    id: 'doc_001',
    name: 'Dra. Helena Prado',
    specialty: 'CARDIOLOGIA',
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    slotDurationMinutes: 30,
    active: true
  },
  {
    id: 'doc_002',
    name: 'Dr. Rafael Nunes',
    specialty: 'DERMATOLOGIA',
    workingHoursStart: '09:00',
    workingHoursEnd: '15:00',
    slotDurationMinutes: 30,
    active: true
  },
  {
    id: 'doc_003',
    name: 'Dra. Camila Rocha',
    specialty: 'ORTOPEDIA',
    workingHoursStart: '07:00',
    workingHoursEnd: '13:00',
    slotDurationMinutes: 60,
    active: true
  },
  {
    id: 'doc_004',
    name: 'Dr. Bruno Teixeira',
    specialty: 'PEDIATRIA',
    workingHoursStart: '08:00',
    workingHoursEnd: '12:00',
    slotDurationMinutes: 20,
    active: true
  },
  {
    id: 'doc_005',
    name: 'Dra. Sofia Almeida',
    specialty: 'CLINICA_GERAL',
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    slotDurationMinutes: 30,
    active: false
  }
];

export function seedDoctors(): void {
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO doctors (id, name, specialty, workingHoursStart, workingHoursEnd, slotDurationMinutes, active)
    VALUES (@id, @name, @specialty, @workingHoursStart, @workingHoursEnd, @slotDurationMinutes, @active)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      specialty = excluded.specialty,
      workingHoursStart = excluded.workingHoursStart,
      workingHoursEnd = excluded.workingHoursEnd,
      slotDurationMinutes = excluded.slotDurationMinutes,
      active = excluded.active
  `);

  const seedAll = db.transaction((doctors: Doctor[]) => {
    for (const doctor of doctors) {
      upsert.run({ ...doctor, active: doctor.active ? 1 : 0 });
    }
  });

  seedAll(DOCTORS);
}

if (require.main === module) {
  seedDoctors();
  console.log(`Seed concluído: ${DOCTORS.length} médicos.`);
}
