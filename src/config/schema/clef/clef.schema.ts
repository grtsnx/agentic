import { z } from 'zod';
import { OPENAI_MODELS } from '../../openai/openai-model-router.js';

// A noul question returns a probability, never an arbitrary model name or executable action.
export const clefResponseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    answers: z.object({ needs_complex: z.number().min(0).max(1) }),
  }),
});
export const modelRoutingSchema = z
  .object({
    model: z.enum([OPENAI_MODELS.economical, OPENAI_MODELS.complex]),
    source: z.enum(['local', 'clef']),
    reason: z.enum([
      'classified',
      'disabled',
      'credentials_missing',
      'uncertain',
      'timeout',
      'provider_error',
      'invalid_response',
      'busy',
    ]),
    probability: z.number().min(0).max(1).optional(),
    durationMs: z.number().int().nonnegative(),
    // Provider billing is separate from generation usage until verified usage is available.
    estimatedCostUsd: z.null(),
  })
  .strict();
