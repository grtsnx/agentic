import type { z } from 'zod';
import type { modelRoutingSchema } from '../../clef/clef.schema.js';
export type ModelRoutingDecision = z.infer<typeof modelRoutingSchema>;
