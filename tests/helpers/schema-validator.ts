import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validatorCache = new Map<string, ValidateFunction>();

function getValidator(schemaRelativePath: string): ValidateFunction {
  const cached = validatorCache.get(schemaRelativePath);
  if (cached) return cached;

  const fullPath = path.resolve(process.cwd(), schemaRelativePath);
  const schema = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const validate = ajv.compile(schema);
  validatorCache.set(schemaRelativePath, validate);
  return validate;
}

export function validateSchema(data: unknown, schemaRelativePath: string): void {
  const validate = getValidator(schemaRelativePath);
  const valid = validate(data);

  if (!valid) {
    const errors = (validate.errors ?? [])
      .map((error) => `${error.instancePath || '(root)'} ${error.message}`)
      .join('; ');
    throw new Error(`Schema inválido em "${schemaRelativePath}": ${errors}`);
  }
}
