import { z } from 'zod';
import { OPENAI_MODELS } from '../../openai/openai-model-router.js';

export const clefUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

// A noul question returns a probability, never an arbitrary model name or executable action.
export const clefResponseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    usage: clefUsageSchema.optional(),
    answers: z.object({
      // Clef returns typed answers. A `noul` answer is an object containing
      // the probability, rather than the probability at the answer root.
      needs_complex: z.object({
        type: z.literal('noul'),
        noul: z.number().min(0).max(1),
      }),
    }),
  }),
});
export const modelRoutingSchema = z
  .object({
    model: z.enum([OPENAI_MODELS.economical, OPENAI_MODELS.complex]),
    source: z.enum(['local', 'clef']),
    reason: z.enum([
      'classified',
      'fast_path',
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
    // List-price estimate based on reported usage, not the invoice after free allowances.
    estimatedCostUsd: z.number().nonnegative().nullable(),
    usage: clefUsageSchema.optional(),
    requestId: z.string().max(128).optional(),
  })
  .strict();
