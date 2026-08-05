export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface StatusHistoryEntry {
  from: AppointmentStatus | null;
  to: AppointmentStatus;
  changedAt: string;
  reason?: string;
}

export interface Appointment {
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
