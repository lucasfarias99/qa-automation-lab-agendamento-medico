import { test, expect } from '@playwright/test';
import { authHeaders, invalidAuthHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { expectAppointmentCreatedResponse, expectErrorResponse } from '../helpers/appointment-assertions';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload, DOCTORS } from '../fixtures/appointment.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

async function registerPatient(request: import('@playwright/test').APIRequestContext, testRunId: string) {
  const payload = validPatientPayload(testRunId);
  const response = await request.post('/auth/register', { data: payload });
  return response.json();
}

test('CT-017 - deve criar agendamento com sucesso', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(201);
  expectAppointmentCreatedResponse(body, payload);
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-018 - deve rejeitar criação sem autenticação', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);

  // Act
  const response = await request.post('/appointments', { data: payload });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'UNAUTHORIZED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-019 - deve rejeitar criação com token inválido', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);

  // Act
  const response = await request.post('/appointments', { headers: invalidAuthHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_TOKEN');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-020 - deve rejeitar criação com payload inválido', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId) as unknown as Record<string, unknown>;
  delete payload.patientId;

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
  expect(body.details.some((detail: { field: string }) => detail.field === 'patientId')).toBe(true);
});

test('CT-021 - deve rejeitar criação sem scheduledAt', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId) as unknown as Record<string, unknown>;
  delete payload.scheduledAt;

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
  expect(body.details.some((detail: { field: string }) => detail.field === 'scheduledAt')).toBe(true);
});

test('CT-022 - deve rejeitar criação para médico inexistente', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { doctorId: 'doc_999' });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expectErrorResponse(body, 'DOCTOR_NOT_FOUND');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-023 - deve rejeitar criação para médico inativo', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { doctorId: DOCTORS.INATIVO });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(422);
  const body = await response.json();
  expectErrorResponse(body, 'DOCTOR_INACTIVE');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-024 - deve rejeitar criação para paciente inexistente', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  const payload = validAppointmentPayload('pat_inexistente', testRunId);

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expectErrorResponse(body, 'PATIENT_NOT_FOUND');
  validateSchema(body, 'schemas/error-response.schema.json');
});
