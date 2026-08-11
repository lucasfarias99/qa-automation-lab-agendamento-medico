import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt, toDateOnly } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import { expectErrorResponse, expectSlotsResponse } from '../helpers/appointment-assertions';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload, DOCTORS } from '../fixtures/appointment.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

test('CT-013 - deve listar slots disponíveis de um médico', async ({ request }) => {
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
  expectSlotsResponse(body, DOCTORS.CARDIOLOGISTA_30MIN, date);
  expect(body.availableSlots.length).toBeGreaterThan(0);
});

test('CT-014 - slot agendado não deve aparecer como disponível', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patientPayload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { data: patientPayload });
  const patient = await registerResponse.json();

  const appointmentPayload = validAppointmentPayload(patient.id, testRunId, {
    doctorId: DOCTORS.CARDIOLOGISTA_30MIN
  });
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: appointmentPayload });
  expect(createResponse.status()).toBe(201);

  const date = toDateOnly(appointmentPayload.scheduledAt);
  const bookedTime = appointmentPayload.scheduledAt.slice(11, 16);

  // Act
  const response = await request.get(`/doctors/${appointmentPayload.doctorId}/slots`, {
    headers: authHeaders,
    params: { date }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(body.bookedSlots).toContain(bookedTime);
  expect(body.availableSlots).not.toContain(bookedTime);
});

test('CT-015 - deve rejeitar listagem de slots sem informar data', async ({ request }) => {
  // Act
  const response = await request.get(`/doctors/${DOCTORS.CARDIOLOGISTA_30MIN}/slots`, {
    headers: authHeaders
  });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expectErrorResponse(body, 'INVALID_PAYLOAD');
  validateSchema(body, 'schemas/error-response.schema.json');
});

test('CT-016 - deve respeitar grade de slots de 20 minutos do médico doc_004', async ({ request }) => {
  // Arrange
  const date = toDateOnly(nextBusinessDayAt('08:00'));
  const expectedGrid = [
    '08:00', '08:20', '08:40', '09:00', '09:20', '09:40',
    '10:00', '10:20', '10:40', '11:00', '11:20', '11:40'
  ];

  // Act
  const response = await request.get(`/doctors/${DOCTORS.PEDIATRA_20MIN}/slots`, {
    headers: authHeaders,
    params: { date }
  });
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(body.slotDurationMinutes).toBe(20);
  const fullGrid = [...body.availableSlots, ...body.bookedSlots].sort();
  expect(fullGrid).toEqual(expectedGrid);
});
