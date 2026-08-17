import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt, toDateOnly } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload, DOCTORS } from '../fixtures/appointment.fixture';

// Suite dedicada a contrato: garante que cada endpoint respeita seu schema JSON,
// independente das regras de negócio já cobertas nas demais suites.
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

async function createAppointment(request: import('@playwright/test').APIRequestContext, testRunId: string) {
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });
  return response.json();
}

test('CT-056 - deve validar contrato da criação de agendamento', async ({ request }) => {
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
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-057 - deve validar contrato da consulta de agendamento', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.get(`/appointments/${appointment.id}`, { headers: authHeaders });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-058 - deve validar contrato do cancelamento', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Validação de contrato' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-059 - deve validar contrato da atualização de status', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Validação de contrato' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-060 - deve validar contrato da listagem de slots', async ({ request }) => {
  // Arrange
  const date = toDateOnly(nextBusinessDayAt('08:00'));

  // Act
  const response = await request.get(`/doctors/${DOCTORS.CARDIOLOGISTA_30MIN}/slots`, {
    headers: authHeaders,
    params: { date }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/slots-response.schema.json');
});

test('CT-061 - deve validar contrato de erro 400', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId) as unknown as Record<string, unknown>;
  delete payload.scheduledAt;

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(400);
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-062 - deve validar contrato de erro 404', async ({ request }) => {
  // Act
  const response = await request.get('/appointments/apt_inexistente', { headers: authHeaders });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(404);
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-063 - deve validar contrato de erro 409', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const firstPatient = await registerPatient(request, testRunId);
  const secondPatient = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('11:00');
  const firstPayload = validAppointmentPayload(firstPatient.id, testRunId, { scheduledAt });
  await request.post('/appointments', { headers: authHeaders, data: firstPayload });

  // Act
  const secondPayload = validAppointmentPayload(secondPatient.id, testRunId, { scheduledAt });
  const response = await request.post('/appointments', { headers: authHeaders, data: secondPayload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(409);
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-064 - deve validar contrato de erro 422', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, { doctorId: DOCTORS.INATIVO });

  // Act
  const response = await request.post('/appointments', { headers: authHeaders, data: payload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(422);
  validateSchema(body, 'schemas/error-response.schema.json');
});
