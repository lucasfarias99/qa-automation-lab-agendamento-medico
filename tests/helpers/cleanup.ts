import { expect, type APIRequestContext } from '@playwright/test';
import { authHeaders } from './auth';

export interface CleanupResponse {
  message: string;
  testRunId: string;
  deletedCount: number;
}

export async function cleanupAppointmentsByTestRunId(
  request: APIRequestContext,
  testRunId: string
): Promise<CleanupResponse> {
  const response = await request.delete('/test-data/appointments', {
    headers: authHeaders,
    params: { testRunId }
  });
  expect(response.status()).toBe(200);
  return response.json();
}

export async function cleanupPatientsByTestRunId(
  request: APIRequestContext,
  testRunId: string
): Promise<CleanupResponse> {
  const response = await request.delete('/test-data/patients', {
    headers: authHeaders,
    params: { testRunId }
  });
  expect(response.status()).toBe(200);
  return response.json();
}

// Ordem importa: agendamentos referenciam pacientes (integridade referencial).
export async function cleanupAllByTestRunId(request: APIRequestContext, testRunId: string): Promise<void> {
  await cleanupAppointmentsByTestRunId(request, testRunId);
  await cleanupPatientsByTestRunId(request, testRunId);
}
