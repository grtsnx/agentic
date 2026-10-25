import { z } from 'zod';
import { openaiRuntimeSchema } from './openai-runtime.schema.js';

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

export const openaiResponseSchema = openaiOutputSchema.extend({
  runtime: openaiRuntimeSchema,
});

export type OpenaiResponse = z.infer<typeof openaiResponseSchema>;
