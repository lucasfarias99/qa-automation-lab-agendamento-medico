import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { expectAppointmentStatusUpdatedResponse, expectErrorResponse } from '../helpers/appointment-assertions';
import { validateSchema } from '../helpers/schema-validator';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload } from '../fixtures/appointment.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

async function createAppointment(request: import('@playwright/test').APIRequestContext, testRunId: string) {
  const patientPayload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { data: patientPayload });
  const patient = await registerResponse.json();

  const appointmentPayload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: appointmentPayload });
  return createResponse.json();
}

test('CT-045 - deve atualizar status para COMPLETED', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Consulta realizada' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectAppointmentStatusUpdatedResponse(body, 'COMPLETED', appointment.updatedAt, 'Consulta realizada');
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-046 - deve atualizar status para NO_SHOW', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'NO_SHOW', reason: 'Paciente não compareceu' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectAppointmentStatusUpdatedResponse(body, 'NO_SHOW', appointment.updatedAt, 'Paciente não compareceu');
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-047 - deve rejeitar atualização de status de agendamento já finalizado', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);
  const firstUpdate = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Consulta realizada' }
  });
  expect(firstUpdate.status()).toBe(200);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'NO_SHOW', reason: 'Tentativa após conclusão' }
  });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_STATUS_TRANSITION');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-048 - deve rejeitar atualização com valor de status inválido', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'EM_ANDAMENTO' }
  });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-049 - deve rejeitar atualização sem informar o campo status', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { reason: 'Sem o campo status' }
  });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-050 - deve registrar a transição em statusHistory', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);
  expect(appointment.statusHistory).toHaveLength(1);

  // Act
  const response = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Consulta realizada' }
  });
  const body = await response.json();

  // Assert
  expect(body.statusHistory).toHaveLength(2);
  expect(body.statusHistory[0]).toMatchObject({ from: null, to: 'SCHEDULED' });
  expect(body.statusHistory[1]).toMatchObject({
    from: 'SCHEDULED',
    to: 'COMPLETED',
    reason: 'Consulta realizada'
  });
  expect(new Date(body.statusHistory[1].changedAt).toString()).not.toBe('Invalid Date');
});
