import type { ZodError } from 'zod';

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly details: ErrorDetail[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const ERROR_CATALOG = {
  UNAUTHORIZED: { httpStatus: 401, message: 'Token de autenticação não informado' },
  INVALID_TOKEN: { httpStatus: 401, message: 'Token de autenticação inválido' },
  INVALID_PAYLOAD: { httpStatus: 400, message: 'Payload inválido' },
  MISSING_TEST_RUN_ID: { httpStatus: 400, message: 'Parâmetro testRunId é obrigatório' },
  DOCTOR_NOT_FOUND: { httpStatus: 404, message: 'Médico não encontrado' },
  PATIENT_NOT_FOUND: { httpStatus: 404, message: 'Paciente não encontrado' },
  APPOINTMENT_NOT_FOUND: { httpStatus: 404, message: 'Agendamento não encontrado' },
  EMAIL_ALREADY_REGISTERED: { httpStatus: 409, message: 'E-mail já cadastrado' },
  SLOT_ALREADY_BOOKED: { httpStatus: 409, message: 'Já existe um agendamento para este médico neste horário' },
  PATIENT_DOUBLE_BOOKING: { httpStatus: 409, message: 'Paciente já possui agendamento neste horário' },
  INVALID_STATUS_TRANSITION: { httpStatus: 409, message: 'Transição de status não permitida' },
  DOCTOR_INACTIVE: { httpStatus: 422, message: 'Médico não está disponível para agendamento' },
  OUTSIDE_WORKING_HOURS: { httpStatus: 422, message: 'Horário fora do expediente do médico' },
  INVALID_SLOT_ALIGNMENT: { httpStatus: 422, message: 'Horário não corresponde a um slot válido' },
  PAST_DATE_NOT_ALLOWED: { httpStatus: 422, message: 'Não é permitido agendar em data passada' },
  CANCELLATION_DEADLINE_EXCEEDED: { httpStatus: 403, message: 'Cancelamento permitido apenas com 24h de antecedência' },
  INVALID_CREDENTIALS: { httpStatus: 401, message: 'E-mail ou senha inválidos' }
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function createError(code: ErrorCode, details: ErrorDetail[] = []): AppError {
  const entry = ERROR_CATALOG[code];
  return new AppError(code, entry.httpStatus, entry.message, details);
}

export function fromZodError(error: ZodError): AppError {
  const details: ErrorDetail[] = error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message
  }));
  return createError('INVALID_PAYLOAD', details);
}
