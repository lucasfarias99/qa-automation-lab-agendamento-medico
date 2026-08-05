import { z } from 'zod';

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  scheduledAt: z.iso.datetime(),
  notes: z.string().optional(),
  testRunId: z.string().optional()
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().optional()
});

export const updateStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW']),
  reason: z.string().optional()
});

export const testRunIdQuerySchema = z.object({
  testRunId: z.string().min(1)
});

export const doctorSlotsQuerySchema = z.object({
  date: z.iso.date()
});
