import { generateTestRunId } from '../helpers/test-run';

export interface PatientPayload {
  name: string;
  email: string;
  document: string;
  password: string;
  testRunId: string;
}

export function validPatientPayload(
  testRunId: string = generateTestRunId(),
  overrides: Partial<PatientPayload> = {}
): PatientPayload {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: 'Maria Silva',
    email: `maria.silva.${unique}@example.com`,
    document: '12345678909',
    password: 'senha123',
    testRunId,
    ...overrides
  };
}
