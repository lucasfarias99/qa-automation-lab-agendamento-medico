import { createHash, randomUUID } from 'node:crypto';
import { insertPatient, findPatientByEmail } from '../repositories/patients.repository';
import { createError } from '../errors/app-error';
import type { Patient, PublicPatient } from '../models/patient.model';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function toPublicPatient(patient: Patient): PublicPatient {
  const { passwordHash: _passwordHash, ...publicPatient } = patient;
  return publicPatient;
}

export interface RegisterPatientInput {
  name: string;
  email: string;
  document: string;
  password: string;
  testRunId?: string;
}

export function registerPatient(input: RegisterPatientInput): PublicPatient {
  const existing = findPatientByEmail(input.email);
  if (existing) {
    throw createError('EMAIL_ALREADY_REGISTERED');
  }

  const patient: Patient = {
    id: `pat_${randomUUID()}`,
    name: input.name,
    email: input.email,
    document: input.document,
    passwordHash: hashPassword(input.password),
    testRunId: input.testRunId ?? null,
    createdAt: new Date().toISOString()
  };

  insertPatient(patient);
  return toPublicPatient(patient);
}

export interface LoginResult {
  token: string;
  patientId: string;
}

export function login(email: string, password: string): LoginResult {
  const patient = findPatientByEmail(email);
  if (!patient || patient.passwordHash !== hashPassword(password)) {
    throw createError('INVALID_CREDENTIALS');
  }

  return { token: process.env.API_TOKEN ?? 'qa-lab-token', patientId: patient.id };
}
