import { modelRoutingSchema } from '../clef/clef.schema.js';
import { z } from 'zod';

const callSchema = z
  .object({
    name: z.string().min(1),
    calls: z.number().int().nonnegative(),
  })
  .strict();

export const openaiRuntimeSchema = z
  .object({
    routing: modelRoutingSchema.optional(),
    durationMs: z.number().int().nonnegative(),
    tokens: z
      .object({
        input: z.number().int().nonnegative(),
        output: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        cachedInput: z.number().int().nonnegative(),
        reasoningOutput: z.number().int().nonnegative(),
      })
      .strict(),
    cost: z
      .object({
        estimatedUsd: z.number().nonnegative(),
        currency: z.literal('USD'),
        exact: z.literal(false),
        includesToolCosts: z.boolean(),
      })
      .strict(),
    models: z.array(callSchema),
    tools: z.array(callSchema),
  })
  .strict();
