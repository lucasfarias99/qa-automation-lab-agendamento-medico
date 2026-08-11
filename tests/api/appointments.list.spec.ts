import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { expectErrorResponse } from '../helpers/appointment-assertions';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload } from '../fixtures/appointment.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

test('CT-036 - deve listar agendamentos por testRunId', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patientPayload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { data: patientPayload });
  const patient = await registerResponse.json();

  const appointmentPayload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: appointmentPayload });
  const appointment = await createResponse.json();

  // Act
  const response = await request.get('/appointments', { headers: authHeaders, params: { testRunId } });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/appointment-list.schema.json');
  expect(body).toHaveLength(1);
  expect(body[0].id).toBe(appointment.id);
});

test('CT-037 - deve listar vazio para contexto sem registros', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();

  // Act
  const response = await request.get('/appointments', { headers: authHeaders, params: { testRunId } });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  validateSchema(body, 'schemas/appointment-list.schema.json');
  expect(body).toEqual([]);
});

test('CT-038 - deve rejeitar listagem sem informar testRunId', async ({ request }) => {
  // Act
  const response = await request.get('/appointments', { headers: authHeaders });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'MISSING_TEST_RUN_ID');
  validateSchema(body, 'schemas/error-response.schema.json');
});
