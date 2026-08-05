export type Specialty = 'CARDIOLOGIA' | 'DERMATOLOGIA' | 'ORTOPEDIA' | 'PEDIATRIA' | 'CLINICA_GERAL';

export interface Doctor {
  id: string;
  name: string;
  specialty: Specialty;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  active: boolean;
}
