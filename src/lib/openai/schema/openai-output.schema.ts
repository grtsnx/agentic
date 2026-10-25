import { z } from 'zod';
import { openaiRuntimeSchema } from './openai-runtime.schema.js';

export const openaiSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.url(),
    domain: z.string().min(1),
    startIndex: z.number().int().nonnegative().optional(),
    endIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export const openaiOutputSchema = z
  .object({
    status: z.enum(['completed', 'needs_input', 'refused']),
    message: z.string().min(1),
    summary: z.string(),
    keyPoints: z.array(z.string()),
    suggestedActions: z.array(z.string()),
    followUpQuestions: z.array(z.string()),
  })
  .strict();

export type OpenaiOutput = z.infer<typeof openaiOutputSchema>;

// Runtime metadata comes from the SDK, not from the model's structured output.
export const openaiResponseSchema = openaiOutputSchema.extend({
  runtime: openaiRuntimeSchema,
  sources: z.array(openaiSourceSchema).default([]),
});

export type OpenaiResponse = z.infer<typeof openaiResponseSchema>;
