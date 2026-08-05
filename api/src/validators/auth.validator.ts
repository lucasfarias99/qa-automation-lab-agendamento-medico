import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  document: z.string().regex(/^\d{11}$/, 'document deve conter 11 dígitos numéricos'),
  password: z.string().min(6),
  testRunId: z.string().optional()
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});
