import { findAllDoctors, findDoctorById } from '../repositories/doctors.repository';
import { findScheduledByDoctorAndDate } from '../repositories/appointments.repository';
import { createError } from '../errors/app-error';
import type { Doctor } from '../models/doctor.model';

export function listDoctors(specialty?: string): Doctor[] {
  return findAllDoctors(specialty);
}

export function getDoctorById(id: string): Doctor {
  const doctor = findDoctorById(id);
  if (!doctor) throw createError('DOCTOR_NOT_FOUND');
  return doctor;
}

export interface SlotsResult {
  doctorId: string;
  date: string;
  slotDurationMinutes: number;
  availableSlots: string[];
  bookedSlots: string[];
}

export function getAvailableSlots(doctorId: string, date: string): SlotsResult {
  const doctor = getDoctorById(doctorId);

  const grid = buildSlotGrid(doctor.workingHoursStart, doctor.workingHoursEnd, doctor.slotDurationMinutes);
  const bookedSet = new Set(
    findScheduledByDoctorAndDate(doctorId, date).map((appointment) => appointment.scheduledAt.slice(11, 16))
  );

  return {
    doctorId,
    date,
    slotDurationMinutes: doctor.slotDurationMinutes,
    availableSlots: grid.filter((slot) => !bookedSet.has(slot)),
    bookedSlots: grid.filter((slot) => bookedSet.has(slot))
  };
}

export function buildSlotGrid(start: string, end: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  const endMinutes = toMinutes(end);

  let minutes = toMinutes(start);
  while (minutes + durationMinutes <= endMinutes) {
    slots.push(toTime(minutes));
    minutes += durationMinutes;
  }

  return slots;
}

function toMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function toTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const mins = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}
