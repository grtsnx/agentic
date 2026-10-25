import { z } from 'zod';
import { openaiRuntimeSchema } from './openai-runtime.schema.js';

export const openaiStreamResponseSchema = z
  .object({
    message: z.string().min(1),
    runtime: openaiRuntimeSchema,
  })
  .strict();

export const openaiStreamEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('delta'),
      delta: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('completed'),
      response: openaiStreamResponseSchema,
    })
    .strict(),
]);

export type OpenaiStreamEvent = z.infer<typeof openaiStreamEventSchema>;
export type OpenaiStreamResponse = z.infer<typeof openaiStreamResponseSchema>;
