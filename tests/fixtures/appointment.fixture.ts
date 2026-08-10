import { nextBusinessDayAt } from '../helpers/date-helpers';

export const DOCTORS = {
  CARDIOLOGISTA_30MIN: 'doc_001', // 08:00–17:00, slot 30min
  DERMATOLOGISTA_30MIN: 'doc_002', // 09:00–15:00, slot 30min
  ORTOPEDISTA_60MIN: 'doc_003', // 07:00–13:00, slot 60min
  PEDIATRA_20MIN: 'doc_004', // 08:00–12:00, slot 20min
  INATIVO: 'doc_005'
} as const;

export interface AppointmentPayload {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  notes?: string;
  testRunId: string;
}

export function validAppointmentPayload(
  patientId: string,
  testRunId: string,
  overrides: Partial<AppointmentPayload> = {}
): AppointmentPayload {
  return {
    patientId,
    doctorId: DOCTORS.CARDIOLOGISTA_30MIN,
    scheduledAt: nextBusinessDayAt('09:00'),
    notes: 'Consulta de rotina criada pela automação',
    testRunId,
    ...overrides
  };
}
