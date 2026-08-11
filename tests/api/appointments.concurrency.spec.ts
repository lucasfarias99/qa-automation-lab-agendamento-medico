import { test, expect } from '@playwright/test';
import { authHeaders } from '../helpers/auth';
import { generateTestRunId } from '../helpers/test-run';
import { nextBusinessDayAt } from '../helpers/date-helpers';
import { cleanupAllByTestRunId } from '../helpers/cleanup';
import { validPatientPayload } from '../fixtures/patient.fixture';
import { DOCTORS } from '../fixtures/appointment.fixture';

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

// Nota de honestidade técnica: este é um teste de integridade sob concorrência
// (duas requisições disparadas simultaneamente contra o mesmo slot), não um teste de carga.
test('CT-032 - deve permitir apenas um agendamento quando dois pacientes disputam o mesmo slot', async ({
  request
}) => {
  // Arrange
  const testRunId = generateTestRunId();
  testRunIdsToCleanup.push(testRunId);

  const patientA = await registerPatient(request, testRunId);
  const patientB = await registerPatient(request, testRunId);
  const scheduledAt = nextBusinessDayAt('10:00');

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

  // Assert — exatamente um sucesso (201) e uma rejeição por conflito (409)
  const statuses = [responseA.status(), responseB.status()].sort();
  expect(statuses).toEqual([201, 409]);

  const winner = responseA.status() === 201 ? responseA : responseB;
  const loser = responseA.status() === 201 ? responseB : responseA;

  const winnerBody = await winner.json();
  const loserBody = await loser.json();
  expect(winnerBody.status).toBe('SCHEDULED');
  expect(loserBody.code).toBe('SLOT_ALREADY_BOOKED');
});
