import type { RequestHandler } from 'express';
import {
  createAppointmentSchema,
  cancelAppointmentSchema,
  updateStatusSchema,
  testRunIdQuerySchema
} from '../validators/appointment.validator';
import { createError, fromZodError } from '../errors/app-error';
import * as appointmentsService from '../services/appointments.service';

export const createAppointment: RequestHandler = (req, res, next) => {
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    const appointment = appointmentsService.createAppointment(parsed.data);
    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const getAppointment: RequestHandler<{ id: string }> = (req, res, next) => {
  try {
    res.status(200).json(appointmentsService.getAppointmentById(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const listAppointments: RequestHandler = (req, res, next) => {
  const parsed = testRunIdQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(createError('MISSING_TEST_RUN_ID'));
    return;
  }

  try {
    res.status(200).json(appointmentsService.listAppointmentsByTestRunId(parsed.data.testRunId));
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment: RequestHandler<{ id: string }> = (req, res, next) => {
  const parsed = cancelAppointmentSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    const appointment = appointmentsService.cancelAppointment(req.params.id, parsed.data.reason);
    res.status(200).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus: RequestHandler<{ id: string }> = (req, res, next) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    const appointment = appointmentsService.updateAppointmentStatus(
      req.params.id,
      parsed.data.status,
      parsed.data.reason
    );
    res.status(200).json(appointment);
  } catch (error) {
    next(error);
  }
};
