import { randomUUID } from 'crypto';

export function generateTestRunId(prefix = 'run') {
  return `${prefix}_${Date.now()}_${randomUUID()}`;
}
