import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      details: err.details
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
    details: []
  });
};
