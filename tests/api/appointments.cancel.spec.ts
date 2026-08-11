import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { expectAppointmentCancelledResponse, expectErrorResponse } from '../helpers/appointment-assertions';
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

// CARDIOLOGISTA_30MIN funciona 08:00-17:00 (UTC) em slots de 30min. Para testar RN-08
// (deadline de 24h) precisamos de um horário agendável que também fique a menos de 24h
// de distância de "agora" — por isso não basta usar hoursFromNow (não é alinhado à grade).
function nextAlignedSlotWithin24Hours(): string {
  const doctorStartMinutes = 8 * 60;
  const doctorEndMinutes = 17 * 60;
  const slotMinutes = 30;
  const lastValidStart = doctorEndMinutes - slotMinutes;

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nowMinutes = (now.getTime() - todayStart) / 60000;

  let dayOffset = 0;
  let slotMinute: number;

  if (nowMinutes < doctorStartMinutes) {
    slotMinute = doctorStartMinutes;
  } else {
    const nextSlot = Math.ceil((nowMinutes + 1) / slotMinutes) * slotMinutes;
    if (nextSlot <= lastValidStart) {
      slotMinute = nextSlot;
    } else {
      dayOffset = 1;
      slotMinute = doctorStartMinutes;
    }
  }

  return new Date(todayStart + dayOffset * 24 * 60 * 60 * 1000 + slotMinute * 60000).toISOString();
}

test('CT-039 - deve cancelar agendamento com mais de 24h de antecedência', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: payload });
  const appointment = await createResponse.json();

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Paciente solicitou cancelamento' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectAppointmentCancelledResponse(body, appointment.updatedAt, 'Paciente solicitou cancelamento');
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-040 - deve rejeitar cancelamento com menos de 24h de antecedência', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId, {
    doctorId: DOCTORS.CARDIOLOGISTA_30MIN,
    scheduledAt: nextAlignedSlotWithin24Hours()
  });
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: payload });
  const appointment = await createResponse.json();
  expect(createResponse.status()).toBe(201);

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Tentativa fora do prazo' }
  });

  // Assert
  expect(response.status()).toBe(403);
  const body = await response.json();
  expectErrorResponse(body, 'CANCELLATION_DEADLINE_EXCEEDED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-041 - deve rejeitar cancelamento de agendamento inexistente', async ({ request }) => {
  // Act
  const response = await request.post('/appointments/apt_inexistente/cancel', {
    headers: authHeaders,
    data: { reason: 'Qualquer motivo' }
  });

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expectErrorResponse(body, 'APPOINTMENT_NOT_FOUND');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-042 - deve rejeitar cancelamento de agendamento já cancelado', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: payload });
  const appointment = await createResponse.json();

  const firstCancel = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Primeiro cancelamento' }
  });
  expect(firstCancel.status()).toBe(200);

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Segundo cancelamento' }
  });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_STATUS_TRANSITION');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-043 - deve rejeitar cancelamento de agendamento já concluído', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: payload });
  const appointment = await createResponse.json();

  const statusResponse = await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Consulta realizada' }
  });
  expect(statusResponse.status()).toBe(200);

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Tentativa após conclusão' }
  });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_STATUS_TRANSITION');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-044 - deve rejeitar cancelamento sem autenticação', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patient = await registerPatient(request, testRunId);
  const payload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: payload });
  const appointment = await createResponse.json();

  // Act
  const response = await request.post(`/appointments/${appointment.id}/cancel`, {
    data: { reason: 'Sem autenticação' }
  });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'UNAUTHORIZED');
  validateSchema(body, 'schemas/error-response.schema.json');
});
