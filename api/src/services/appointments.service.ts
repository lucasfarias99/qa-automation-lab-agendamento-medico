import { randomUUID } from 'node:crypto';
import { createError } from '../errors/app-error';
import { getDoctorById } from './doctors.service';
import { findPatientById } from '../repositories/patients.repository';
import {
  insertAppointment,
  updateAppointment,
  findAppointmentById,
  findAppointmentsByTestRunId,
  findActiveByDoctorAndSlot,
  findActiveByPatientAndSlot,
  runInTransaction
} from '../repositories/appointments.repository';
import type { Appointment, AppointmentStatus, StatusHistoryEntry } from '../models/appointment.model';

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: []
};

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  notes?: string;
  testRunId?: string;
}

export function createAppointment(input: CreateAppointmentInput): Appointment {
  const patient = findPatientById(input.patientId);
  if (!patient) throw createError('PATIENT_NOT_FOUND');

  const doctor = getDoctorById(input.doctorId);
  if (!doctor.active) throw createError('DOCTOR_INACTIVE');

  if (new Date(input.scheduledAt).getTime() < Date.now()) {
    throw createError('PAST_DATE_NOT_ALLOWED');
  }

  const timeOnly = input.scheduledAt.slice(11, 16);
  assertWithinWorkingHours(timeOnly, doctor.workingHoursStart, doctor.workingHoursEnd, doctor.slotDurationMinutes);
  assertSlotAligned(timeOnly, doctor.workingHoursStart, doctor.slotDurationMinutes);

  return runInTransaction(() => {
    if (findActiveByDoctorAndSlot(input.doctorId, input.scheduledAt)) {
      throw createError('SLOT_ALREADY_BOOKED');
    }

    if (findActiveByPatientAndSlot(input.patientId, input.scheduledAt)) {
      throw createError('PATIENT_DOUBLE_BOOKING');
    }

    const now = new Date().toISOString();
    const appointment: Appointment = {
      id: `apt_${randomUUID()}`,
      patientId: input.patientId,
      doctorId: input.doctorId,
      scheduledAt: input.scheduledAt,
      status: 'SCHEDULED',
      notes: input.notes ?? null,
      statusHistory: [{ from: null, to: 'SCHEDULED', changedAt: now, reason: 'Agendamento criado' }],
      testRunId: input.testRunId ?? null,
      createdAt: now,
      updatedAt: now
    };

    insertAppointment(appointment);
    return appointment;
  });
}

export function getAppointmentById(id: string): Appointment {
  const appointment = findAppointmentById(id);
  if (!appointment) throw createError('APPOINTMENT_NOT_FOUND');
  return appointment;
}

export function listAppointmentsByTestRunId(testRunId: string): Appointment[] {
  return findAppointmentsByTestRunId(testRunId);
}

export function cancelAppointment(id: string, reason?: string): Appointment {
  const appointment = getAppointmentById(id);

  if (appointment.status !== 'SCHEDULED') {
    throw createError('INVALID_STATUS_TRANSITION');
  }

  const deadlineHours = Number(process.env.CANCELLATION_DEADLINE_HOURS ?? 24);
  const deadline = new Date(appointment.scheduledAt).getTime() - deadlineHours * 60 * 60 * 1000;
  if (Date.now() > deadline) {
    throw createError('CANCELLATION_DEADLINE_EXCEEDED');
  }

  return transitionStatus(appointment, 'CANCELLED', reason);
}

export function updateAppointmentStatus(id: string, status: AppointmentStatus, reason?: string): Appointment {
  const appointment = getAppointmentById(id);

  if (!VALID_TRANSITIONS[appointment.status].includes(status)) {
    throw createError('INVALID_STATUS_TRANSITION');
  }

  return transitionStatus(appointment, status, reason);
}

function transitionStatus(appointment: Appointment, to: AppointmentStatus, reason?: string): Appointment {
  const now = new Date().toISOString();
  const entry: StatusHistoryEntry = {
    from: appointment.status,
    to,
    changedAt: now,
    ...(reason ? { reason } : {})
  };

  const updated: Appointment = {
    ...appointment,
    status: to,
    statusHistory: [...appointment.statusHistory, entry],
    updatedAt: now
  };

  updateAppointment(updated);
  return updated;
}

function assertWithinWorkingHours(time: string, start: string, end: string, slotDurationMinutes: number): void {
  const t = toMinutes(time);
  const startMinutes = toMinutes(start);
  const lastValidStart = toMinutes(end) - slotDurationMinutes;

  if (t < startMinutes || t > lastValidStart) {
    throw createError('OUTSIDE_WORKING_HOURS');
  }
}

function assertSlotAligned(time: string, start: string, slotDurationMinutes: number): void {
  const minutesSinceStart = toMinutes(time) - toMinutes(start);
  if (minutesSinceStart < 0 || minutesSinceStart % slotDurationMinutes !== 0) {
    throw createError('INVALID_SLOT_ALIGNMENT');
  }
}

function toMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}
