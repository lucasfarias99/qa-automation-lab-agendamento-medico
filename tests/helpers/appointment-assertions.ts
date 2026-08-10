import { expect } from '@playwright/test';

export function expectAppointmentCreatedResponse(body: any, payload: any): void {
  expect(body.id).toMatch(/^apt_/);
  expect(body.patientId).toBe(payload.patientId);
  expect(body.doctorId).toBe(payload.doctorId);
  expect(body.scheduledAt).toBe(payload.scheduledAt);
  expect(body.status).toBe('SCHEDULED');
  expect(body.statusHistory).toHaveLength(1);
  expect(body.statusHistory[0]).toMatchObject({ from: null, to: 'SCHEDULED' });
  expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date');
  expect(new Date(body.updatedAt).toString()).not.toBe('Invalid Date');
}

export function expectAppointmentFoundResponse(body: any, expected: any): void {
  expect(body.id).toBe(expected.id);
  expect(body.patientId).toBe(expected.patientId);
  expect(body.doctorId).toBe(expected.doctorId);
  expect(body.scheduledAt).toBe(expected.scheduledAt);
  expect(body.status).toBe(expected.status);
}

export function expectAppointmentCancelledResponse(
  body: any,
  previousUpdatedAt: string,
  reason?: string
): void {
  expect(body.status).toBe('CANCELLED');
  expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(previousUpdatedAt).getTime());
  expect(body.statusHistory).toHaveLength(2);

  const lastEntry = body.statusHistory[body.statusHistory.length - 1];
  expect(lastEntry.from).toBe('SCHEDULED');
  expect(lastEntry.to).toBe('CANCELLED');
  if (reason) expect(lastEntry.reason).toBe(reason);
}

export function expectAppointmentStatusUpdatedResponse(
  body: any,
  expectedStatus: string,
  previousUpdatedAt: string,
  reason?: string
): void {
  expect(body.status).toBe(expectedStatus);
  expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(previousUpdatedAt).getTime());

  const lastEntry = body.statusHistory[body.statusHistory.length - 1];
  expect(lastEntry.to).toBe(expectedStatus);
  if (reason) expect(lastEntry.reason).toBe(reason);
}

export function expectErrorResponse(body: any, code: string, message?: string): void {
  expect(body.code).toBe(code);
  if (message) expect(body.message).toBe(message);
}

export function expectCleanupResponse(body: any, testRunId: string, minimumDeletedCount = 0): void {
  expect(body.message).toBe('Massa de teste expurgada com sucesso');
  expect(body.testRunId).toBe(testRunId);
  expect(body.deletedCount).toBeGreaterThanOrEqual(minimumDeletedCount);
}

export function expectPatientCreatedResponse(body: any, payload: any): void {
  expect(body.id).toMatch(/^pat_/);
  expect(body.name).toBe(payload.name);
  expect(body.email).toBe(payload.email);
  expect(body.document).toBe(payload.document);
  expect(body.passwordHash).toBeUndefined();
}

export function expectSlotsResponse(body: any, doctorId: string, date: string): void {
  expect(body.doctorId).toBe(doctorId);
  expect(body.date).toBe(date);
  expect(Array.isArray(body.availableSlots)).toBe(true);
  expect(Array.isArray(body.bookedSlots)).toBe(true);

  const intersection = body.availableSlots.filter((slot: string) => body.bookedSlots.includes(slot));
  expect(intersection).toHaveLength(0);
}
