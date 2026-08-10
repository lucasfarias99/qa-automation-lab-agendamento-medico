import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { toDateOnly } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validateSchema } from '../helpers/schema-validator';
import {
  findAppointmentById,
  countAppointmentsByTestRunId,
  countPatientsByTestRunId
} from '../helpers/db-client';
import {
  expectPatientCreatedResponse,
  expectAppointmentCreatedResponse,
  expectAppointmentCancelledResponse,
  expectCleanupResponse,
  expectSlotsResponse
} from '../helpers/appointment-assertions';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload, DOCTORS } from '../fixtures/appointment.fixture';

let testRunIdsToCleanup: string[] = [];

test.afterEach(async ({ request }) => {
  for (const testRunId of testRunIdsToCleanup) {
    await cleanupAllByTestRunId(request, testRunId);
  }
  testRunIdsToCleanup = [];
});

test('INFRA-01 - fluxo de agendamento deve persistir no banco e ser expurgado ao final', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);

  const patientPayload = validPatientPayload(testRunId);

  // Act — cadastra paciente
  const registerResponse = await request.post('/auth/register', {
    headers: authHeaders,
    data: patientPayload
  });
  const patient = await registerResponse.json();

  // Assert — resposta e schema do paciente
  expect(registerResponse.status()).toBe(201);
  expectPatientCreatedResponse(patient, patientPayload);
  validateSchema(patient, 'schemas/patient-response.schema.json');

  // Act — cria agendamento
  const appointmentPayload = validAppointmentPayload(patient.id, testRunId);
  const createResponse = await request.post('/appointments', {
    headers: authHeaders,
    data: appointmentPayload
  });
  const appointment = await createResponse.json();

  // Assert — resposta, schema e persistência
  expect(createResponse.status()).toBe(201);
  expectAppointmentCreatedResponse(appointment, appointmentPayload);
  validateSchema(appointment, 'schemas/appointment-response.schema.json');

  const persisted = findAppointmentById(appointment.id);
  expect(persisted).not.toBeNull();
  expect(persisted?.status).toBe('SCHEDULED');
  expect(persisted?.testRunId).toBe(testRunId);

  // Act — cancela o agendamento
  const cancelResponse = await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Paciente solicitou cancelamento' }
  });
  const cancelled = await cancelResponse.json();

  // Assert — cancelamento refletido na API e no banco
  expect(cancelResponse.status()).toBe(200);
  expectAppointmentCancelledResponse(cancelled, appointment.updatedAt, 'Paciente solicitou cancelamento');
  expect(findAppointmentById(appointment.id)?.status).toBe('CANCELLED');

  // Act — expurga a massa do contexto
  await cleanupAllByTestRunId(request, testRunId);
  testRunIdsToCleanup = testRunIdsToCleanup.filter((id) => id !== testRunId);

  // Assert — banco limpo após o expurgo
  expect(countAppointmentsByTestRunId(testRunId)).toBe(0);
  expect(countPatientsByTestRunId(testRunId)).toBe(0);

  // Act — repete o expurgo sobre um contexto já vazio
  const secondCleanup = await request.delete('/test-data/appointments', {
    headers: authHeaders,
    params: { testRunId }
  });

  // Assert — expurgo é idempotente (RN-15)
  expectCleanupResponse(await secondCleanup.json(), testRunId, 0);
});

test('INFRA-02 - slots devem refletir agendamento criado e respeitar o contrato JSON', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);

  const patientPayload = validPatientPayload(testRunId);
  const registerResponse = await request.post('/auth/register', { headers: authHeaders, data: patientPayload });
  const patient = await registerResponse.json();

  const appointmentPayload = validAppointmentPayload(patient.id, testRunId, {
    doctorId: DOCTORS.CARDIOLOGISTA_30MIN
  });

  // Act — cria agendamento e consulta o médico e seus slots
  const createResponse = await request.post('/appointments', { headers: authHeaders, data: appointmentPayload });
  const appointment = await createResponse.json();
  expect(createResponse.status()).toBe(201);

  const doctorResponse = await request.get(`/doctors/${appointmentPayload.doctorId}`, { headers: authHeaders });
  const doctor = await doctorResponse.json();

  const date = toDateOnly(appointmentPayload.scheduledAt);
  const slotsResponse = await request.get(`/doctors/${appointmentPayload.doctorId}/slots`, {
    headers: authHeaders,
    params: { date }
  });
  const slots = await slotsResponse.json();

  // Assert — schemas e regra de negócio (slot ocupado não aparece como disponível)
  expect(doctorResponse.status()).toBe(200);
  validateSchema(doctor, 'schemas/doctor-response.schema.json');

  expect(slotsResponse.status()).toBe(200);
  validateSchema(slots, 'schemas/slots-response.schema.json');
  expectSlotsResponse(slots, appointmentPayload.doctorId, date);

  const bookedTime = appointmentPayload.scheduledAt.slice(11, 16);
  expect(slots.bookedSlots).toContain(bookedTime);
  expect(slots.availableSlots).not.toContain(bookedTime);

  const listResponse = await request.get('/appointments', { headers: authHeaders, params: { testRunId } });
  const appointments = await listResponse.json();
  validateSchema(appointments, 'schemas/appointment-list.schema.json');
  expect(appointments).toHaveLength(1);
  expect(appointments[0].id).toBe(appointment.id);
});
