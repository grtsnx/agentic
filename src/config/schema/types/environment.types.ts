import type { z } from 'zod';
import type { environmentSchema } from '../environment.schema.js';

export type Environment = z.infer<typeof environmentSchema>;
