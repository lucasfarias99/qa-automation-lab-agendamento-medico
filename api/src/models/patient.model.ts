export interface Patient {
  id: string;
  name: string;
  email: string;
  document: string;
  passwordHash: string;
  testRunId: string | null;
  createdAt: string;
}

export type PublicPatient = Omit<Patient, 'passwordHash'>;
