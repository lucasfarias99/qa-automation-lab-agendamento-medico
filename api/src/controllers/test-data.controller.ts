import type { RequestHandler } from 'express';
import { testRunIdQuerySchema } from '../validators/appointment.validator';
import { createError } from '../errors/app-error';
import { deleteAppointmentsByTestRunId } from '../repositories/appointments.repository';
import { deletePatientsByTestRunId } from '../repositories/patients.repository';

export const purgeAppointments: RequestHandler = (req, res, next) => {
  const parsed = testRunIdQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(createError('MISSING_TEST_RUN_ID'));
    return;
  }

  try {
    const deletedCount = deleteAppointmentsByTestRunId(parsed.data.testRunId);
    res.status(200).json({
      message: 'Massa de teste expurgada com sucesso',
      testRunId: parsed.data.testRunId,
      deletedCount
    });
  } catch (error) {
    next(error);
  }
};

export const purgePatients: RequestHandler = (req, res, next) => {
  const parsed = testRunIdQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(createError('MISSING_TEST_RUN_ID'));
    return;
  }

  try {
    const deletedCount = deletePatientsByTestRunId(parsed.data.testRunId);
    res.status(200).json({
      message: 'Massa de teste expurgada com sucesso',
      testRunId: parsed.data.testRunId,
      deletedCount
    });
  } catch (error) {
    next(error);
  }
};
