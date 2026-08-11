import { test, expect } from '@playwright/test';
import { generateTestRunId } from '../helpers/test-run';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { expectPatientCreatedResponse, expectErrorResponse } from '../helpers/appointment-assertions';
import { validPatientPayload } from '../fixtures/patient.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

test('CT-002 - deve cadastrar paciente com sucesso', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const payload = validPatientPayload(testRunId);

  // Act
  const response = await request.post('/auth/register', { data: payload });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(201);
  expectPatientCreatedResponse(body, payload);
  validateSchema(body, 'schemas/patient-response.schema.json');
});

test('CT-003 - deve rejeitar cadastro com e-mail já existente', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const payload = validPatientPayload(testRunId);
  const firstResponse = await request.post('/auth/register', { data: payload });
  expect(firstResponse.status()).toBe(201);

  // Act — segundo cadastro com o mesmo e-mail
  const response = await request.post('/auth/register', {
    data: validPatientPayload(testRunId, { email: payload.email })
  });

  // Assert
  expect(response.status()).toBe(409);
  const body = await response.json();
  expectErrorResponse(body, 'EMAIL_ALREADY_REGISTERED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-004 - deve rejeitar cadastro com payload inválido', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const payload = validPatientPayload(testRunId, { document: '123' });

  // Act
  const response = await request.post('/auth/register', { data: payload });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
  expect(body.details.some((detail: { field: string }) => detail.field === 'document')).toBe(true);
});

test('CT-005 - deve autenticar paciente com credenciais válidas', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const payload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { data: payload });
  const patient = await registerResponse.json();

  // Act
  const response = await request.post('/auth/login', {
    data: { email: payload.email, password: payload.password }
  });

  // Assert
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({
    token: process.env.API_TOKEN ?? 'qa-lab-token',
    patientId: patient.id
  });
});

test('CT-006 - deve rejeitar login com senha incorreta', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const payload = validPatientPayload(testRunId);
  await request.post('/auth/register', { data: payload });

  // Act
  const response = await request.post('/auth/login', {
    data: { email: payload.email, password: 'senha-errada' }
  });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_CREDENTIALS');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-007 - deve rejeitar login com e-mail inexistente', async ({ request }) => {
  // Act
  const response = await request.post('/auth/login', {
    data: { email: 'inexistente@example.com', password: 'senha123' }
  });

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_CREDENTIALS');
  validateSchema(body, 'schemas/error-response.schema.json');
});
