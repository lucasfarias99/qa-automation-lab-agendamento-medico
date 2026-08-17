import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt } from '../helpers/date-helpers';
import { cleanupAllByTestRunId, cleanupAppointmentsByTestRunId, cleanupPatientsByTestRunId } from '../helpers/cleanup';
import {
  findAppointmentById,
  findAppointmentsByDoctorAndSlot,
  findAppointmentsByTestRunId,
  findPatientsByTestRunId
} from '../helpers/db-client';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { validAppointmentPayload, DOCTORS } from '../fixtures/appointment.fixture';

// Suite de auditoria: valida o estado persistido diretamente no SQLite, sem
// confiar apenas no que a API devolve na resposta HTTP.
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

test('CT-065 - deve persistir o agendamento criado no banco', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);

  // Act
  const appointment = await createAppointment(request, testRunId);
  const record = findAppointmentById(appointment.id);

  // Assert
  expect(record).not.toBeNull();
  expect(record?.patientId).toBe(appointment.patientId);
  expect(record?.doctorId).toBe(appointment.doctorId);
  expect(record?.scheduledAt).toBe(appointment.scheduledAt);
  expect(record?.status).toBe('SCHEDULED');
  expect(record?.testRunId).toBe(testRunId);
});

test('CT-066 - deve persistir o statusHistory após cancelamento', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  await request.post(`/appointments/${appointment.id}/cancel`, {
    headers: authHeaders,
    data: { reason: 'Auditoria de banco' }
  });
  const record = findAppointmentById(appointment.id);

  // Assert
  expect(record?.status).toBe('CANCELLED');
  expect(record?.statusHistory).toHaveLength(2);
  expect(record?.statusHistory[1]).toMatchObject({
    from: 'SCHEDULED',
    to: 'CANCELLED',
    reason: 'Auditoria de banco'
  });
});

test('CT-067 - deve persistir o statusHistory após conclusão', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);

  // Act
  await request.patch(`/appointments/${appointment.id}/status`, {
    headers: authHeaders,
    data: { status: 'COMPLETED', reason: 'Consulta realizada' }
  });
  const record = findAppointmentById(appointment.id);

  // Assert
  expect(record?.status).toBe('COMPLETED');
  expect(record?.statusHistory).toHaveLength(2);
  expect(record?.statusHistory[1]).toMatchObject({
    from: 'SCHEDULED',
    to: 'COMPLETED',
    reason: 'Consulta realizada'
  });
});

test('CT-068 - não deve persistir agendamento rejeitado por conflito', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const firstPatient = await registerPatient(request, testRunId);
  const secondPatient = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('13:00');
  const firstPayload = validAppointmentPayload(firstPatient.id, testRunId, { scheduledAt });
  const firstResponse = await request.post('/appointments', { headers: authHeaders, data: firstPayload });
  expect(firstResponse.status()).toBe(201);

  // Act
  const secondPayload = validAppointmentPayload(secondPatient.id, testRunId, { scheduledAt });
  const secondResponse = await request.post('/appointments', { headers: authHeaders, data: secondPayload });
  expect(secondResponse.status()).toBe(409);

  // Assert — apenas o agendamento vencedor existe no banco para este slot
  const records = findAppointmentsByDoctorAndSlot(DOCTORS.CARDIOLOGISTA_30MIN, scheduledAt);
  expect(records).toHaveLength(1);
  expect(records[0].patientId).toBe(firstPatient.id);
});

test('CT-069 - deve expurgar agendamentos do banco', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const appointment = await createAppointment(request, testRunId);
  expect(findAppointmentsByTestRunId(testRunId)).toHaveLength(1);

  // Act
  await cleanupAppointmentsByTestRunId(request, testRunId);

  // Assert
  expect(findAppointmentsByTestRunId(testRunId)).toHaveLength(0);
  expect(appointment.id).toMatch(/^apt_/);
});

test('CT-070 - deve expurgar pacientes do banco', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  await registerPatient(request, testRunId);
  expect(findPatientsByTestRunId(testRunId)).toHaveLength(1);

  // Act
  await cleanupPatientsByTestRunId(request, testRunId);

  // Assert
  expect(findPatientsByTestRunId(testRunId)).toHaveLength(0);
});

test('CT-071 - deve manter unicidade de slot no banco após concorrência', async ({ request }) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);
  const patientA = await registerPatient(request, testRunId);
  const patientB = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('14:00');

  // Act — dispara as duas requisições simultaneamente
  const [responseA, responseB] = await Promise.all([
    request.post('/appointments', {
      headers: authHeaders,
      data: { patientId: patientA.id, doctorId: DOCTORS.CARDIOLOGISTA_30MIN, scheduledAt, testRunId }
    }),
    request.post('/appointments', {
      headers: authHeaders,
      data: { patientId: patientB.id, doctorId: DOCTORS.CARDIOLOGISTA_30MIN, scheduledAt, testRunId }
    })
  ]);
  const statuses = [responseA.status(), responseB.status()].sort();
  expect(statuses).toEqual([201, 409]);

  // Assert — o banco tem exatamente uma linha para o slot disputado
  const records = findAppointmentsByDoctorAndSlot(DOCTORS.CARDIOLOGISTA_30MIN, scheduledAt);
  expect(records).toHaveLength(1);
  expect(records[0].status).toBe('SCHEDULED');
});
