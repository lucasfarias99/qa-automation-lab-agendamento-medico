import type { RequestHandler } from 'express';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { fromZodError } from '../errors/app-error';
import * as authService from '../services/auth.service';

export const register: RequestHandler = (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    const patient = authService.registerPatient(parsed.data);
    res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    next(fromZodError(parsed.error));
    return;
  }

  try {
    const result = authService.login(parsed.data.email, parsed.data.password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
