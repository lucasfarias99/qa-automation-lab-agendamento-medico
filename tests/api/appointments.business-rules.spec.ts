import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt, pastDateAt } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { expectAppointmentCreatedResponse, expectErrorResponse } from '../helpers/appointment-assertions';
import { validateSchema } from '../helpers/schema-validator';
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

test('CT-025 - deve rejeitar criação em horário já ocupado', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const firstPatient = await registerPatient(request, testRunId);
  const secondPatient = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('09:00');

  const firstPayload = validAppointmentPayload(firstPatient.id, testRunId, { scheduledAt });
  const firstResponse = await request.post('/appointments', { headers: authHeaders, data: firstPayload });
  expect(firstResponse.status()).toBe(201);

  // Act — segundo paciente tenta o mesmo horário com o mesmo médico
  const secondPayload = validAppointmentPayload(secondPatient.id, testRunId, { scheduledAt });
  const response = await request.post('/appointments', { headers: authHeaders, data: secondPayload });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'SLOT_ALREADY_BOOKED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-026 - deve rejeitar criação fora do expediente (antes da abertura)', async ({ request }) => {
  // Arrange — CARDIOLOGISTA_30MIN abre às 08:00
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { scheduledAt: nextBusinessDayAt('07:00') });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(422);
  const body = await response.json();
  expectErrorResponse(body, 'OUTSIDE_WORKING_HOURS');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-027 - deve rejeitar criação fora do expediente (após fechamento)', async ({ request }) => {
  // Arrange — CARDIOLOGISTA_30MIN fecha às 17:00, último slot válido inicia às 16:30
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { scheduledAt: nextBusinessDayAt('17:00') });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(422);
  const body = await response.json();
  expectErrorResponse(body, 'OUTSIDE_WORKING_HOURS');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-028 - deve rejeitar criação com horário desalinhado da grade', async ({ request }) => {
  // Arrange — CARDIOLOGISTA_30MIN tem grade de 30min a partir de 08:00; 08:05 não é múltiplo válido
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { scheduledAt: nextBusinessDayAt('08:05') });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(422);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_SLOT_ALIGNMENT');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-029 - deve rejeitar criação em data passada', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { scheduledAt: pastDateAt('09:00') });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });

  // Assert
  expect(response.status()).toBe(422);
  const body = await response.json();
  expectErrorResponse(body, 'PAST_DATE_NOT_ALLOWED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-030 - deve rejeitar dois agendamentos do mesmo paciente no mesmo horário', async ({ request }) => {
  // Arrange — CARDIOLOGISTA e DERMATOLOGISTA compartilham o slot 09:00
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('09:00');

  const firstPayload = validAppointmentPayload(patient.id, testRunId, {
    doctorId: DOCTORS.CARDIOLOGISTA_30MIN,
    scheduledAt
  });
  const firstResponse = await request.post('/appointments', { headers: authHeaders, data: firstPayload });
  expect(firstResponse.status()).toBe(201);

  // Act — mesmo paciente, mesmo horário, médico diferente
  const secondPayload = validAppointmentPayload(patient.id, testRunId, {
    doctorId: DOCTORS.DERMATOLOGISTA_30MIN,
    scheduledAt
  });
  const response = await request.post('/appointments', { headers: authHeaders, data: secondPayload });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'PATIENT_DOUBLE_BOOKING');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-031 - deve permitir criação em slot liberado após cancelamento', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const firstPatient = await registerPatient(request, testRunId);
  const secondPatient = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('09:00');

  const firstPayload = validAppointmentPayload(firstPatient.id, testRunId, { scheduledAt });
  const firstResponse = await request.post('/appointments', { headers: authHeaders, data: firstPayload });
  const firstAppointment = await firstResponse.json();

  const cancelResponse = await request.post(`/appointments/${firstAppointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Paciente solicitou cancelamento' }
  });
  expect(cancelResponse.status()).toBe(200);

  // Act — segundo paciente agenda no mesmo horário, agora livre
  const secondPayload = validAppointmentPayload(secondPatient.id, testRunId, { scheduledAt });
  const response = await request.post('/appointments', { headers: authHeaders, data: secondPayload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(201);
  expectAppointmentCreatedResponse(body, secondPayload);
});
