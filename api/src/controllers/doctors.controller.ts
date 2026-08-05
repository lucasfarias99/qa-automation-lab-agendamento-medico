import type { RequestHandler } from 'express';
import * as doctorsService from '../services/doctors.service';
import { doctorSlotsQuerySchema } from '../validators/appointment.validator';
import { fromZodError } from '../errors/app-error';

export const listDoctors: RequestHandler = (req, res, next) => {
  try {
    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : undefined;
    res.status(200).json(doctorsService.listDoctors(specialty));
  } catch (error) {
    next(error);
  }
};

export const getDoctor: RequestHandler<{ id: string }> = (req, res, next) => {
  try {
    res.status(200).json(doctorsService.getDoctorById(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const getDoctorSlots: RequestHandler<{ id: string }> = (req, res, next) => {
  const parsed = doctorSlotsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    res.status(200).json(doctorsService.getAvailableSlots(req.params.id, parsed.data.date));
  } catch (error) {
    next(error);
  }
};
