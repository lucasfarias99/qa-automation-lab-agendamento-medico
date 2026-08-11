import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { expectAppointmentFoundResponse, expectErrorResponse } from '../helpers/appointment-assertions';
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

test('CT-033 - deve consultar agendamento existente', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.get(`/appointments/${appointment.id}`, { headers: authHeaders });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expectAppointmentFoundResponse(body, appointment);
  validateSchema(body, 'schemas/appointment-response.schema.json');
});

test('CT-034 - deve rejeitar consulta de agendamento inexistente', async ({ request }) => {
  // Act
  const response = await request.get('/appointments/apt_inexistente', { headers: authHeaders });

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expectErrorResponse(body, 'APPOINTMENT_NOT_FOUND');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-035 - deve rejeitar consulta de agendamento sem autenticação', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  const response = await request.get(`/appointments/${appointment.id}`);

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'UNAUTHORIZED');
  validateSchema(body, 'schemas/error-response.schema.json');
});
