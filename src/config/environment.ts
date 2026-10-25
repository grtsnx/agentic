import { environmentSchema, type Environment } from '@/config/schema';

export type { Environment } from '@/config/schema';

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(values);
}
