import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { validateSchema } from '../helpers/schema-validator';
import { expectErrorResponse } from '../helpers/appointment-assertions';
import { DOCTORS } from '../fixtures/appointment.fixture';

test('CT-008 - deve listar todos os médicos', async ({ request }) => {
  // Act
  const response = await request.get('/doctors', { headers: authHeaders });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThanOrEqual(5);
  for (const doctor of body) {
    validateSchema(doctor, 'schemas/doctor-response.schema.json');
  }
});

test('CT-009 - deve listar médicos filtrando por especialidade', async ({ request }) => {
  // Act
  const response = await request.get('/doctors', {
    headers: authHeaders,
    params: { specialty: 'CARDIOLOGIA' }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(body.length).toBeGreaterThanOrEqual(1);
  for (const doctor of body) {
    expect(doctor.specialty).toBe('CARDIOLOGIA');
  }
});

test('CT-010 - deve rejeitar listagem sem autenticação', async ({ request }) => {
  // Act
  const response = await request.get('/doctors');

  // Assert
  expect(response.status()).toBe(401);
  const body = await response.json();
  expectErrorResponse(body, 'UNAUTHORIZED');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-011 - deve consultar médico existente por ID', async ({ request }) => {
  // Act
  const response = await request.get(`/doctors/${DOCTORS.CARDIOLOGISTA_30MIN}`, { headers: authHeaders });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(body.id).toBe(DOCTORS.CARDIOLOGISTA_30MIN);
  validateSchema(body, 'schemas/doctor-response.schema.json');
});

test('CT-012 - deve rejeitar consulta de médico inexistente', async ({ request }) => {
  // Act
  const response = await request.get('/doctors/doc_999', { headers: authHeaders });

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expectErrorResponse(body, 'DOCTOR_NOT_FOUND');
  validateSchema(body, 'schemas/error-response.schema.json');
});
