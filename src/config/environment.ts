import { environmentSchema } from './schema/environment.schema.js';
import type { Environment } from '@/config';

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(values);
}
