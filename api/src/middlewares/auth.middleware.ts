import type { RequestHandler } from 'express';
import { createError } from '../errors/app-error';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header) {
    next(createError('UNAUTHORIZED'));
    return;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(createError('UNAUTHORIZED'));
    return;
  }

  const expectedToken = process.env.API_TOKEN ?? 'qa-lab-token';
  if (token !== expectedToken) {
    next(createError('INVALID_TOKEN'));
    return;
  }

  next();
};
