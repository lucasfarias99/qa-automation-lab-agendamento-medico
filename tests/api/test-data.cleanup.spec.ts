import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { countAppointmentsByTestRunId, countPatientsByTestRunId } from '../helpers/db-client';
import { expectCleanupResponse, expectErrorResponse } from '../helpers/appointment-assertions';
import { validateSchema } from '../helpers/schema-validator';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload } from '../fixtures/appointment.fixture';

test('CT-051 - deve expurgar agendamentos por testRunId', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  const patientPayload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { data: patientPayload });
  const patient = await registerResponse.json();

  const appointmentPayload = validAppointmentPayload(patient.id, testRunId);
  await request.post('/appointments', { headers: authHeaders, data: appointmentPayload });
  expect(countAppointmentsByTestRunId(testRunId)).toBe(1);

  // Act
  const response = await request.delete('/test-data/appointments', {
    headers: authHeaders,
    params: { testRunId }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectCleanupResponse(body, testRunId, 1);
  expect(countAppointmentsByTestRunId(testRunId)).toBe(0);

  // Limpa o paciente residual criado neste teste.
  await request.delete('/test-data/patients', { headers: authHeaders, params: { testRunId } });
});

test('CT-052 - deve expurgar pacientes por testRunId', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  const patientPayload = validPatientPayload(testRunId);
  await request.post('/auth/register', { data: patientPayload });
  expect(countPatientsByTestRunId(testRunId)).toBe(1);

  // Act
  const response = await request.delete('/test-data/patients', {
    headers: authHeaders,
    params: { testRunId }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectCleanupResponse(body, testRunId, 1);
  expect(countPatientsByTestRunId(testRunId)).toBe(0);
});

test('CT-053 - deve rejeitar expurgo sem informar testRunId', async ({ request }) => {
  // Act
  const response = await request.delete('/test-data/appointments', { headers: authHeaders });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'MISSING_TEST_RUN_ID');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-054 - deve ser idempotente ao expurgar contexto vazio', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();

  // Act
  const response = await request.delete('/test-data/appointments', {
    headers: authHeaders,
    params: { testRunId }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectCleanupResponse(body, testRunId, 0);
  expect(body.deletedCount).toBe(0);
});

test('CT-055 - deve rejeitar expurgo sem autenticação', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();

  // Act
  const response = await request.delete('/test-data/appointments', { params: { testRunId } });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'UNAUTHORIZED');
  validateSchema(body, 'schemas/error-response.schema.json');
});
