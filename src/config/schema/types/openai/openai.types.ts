import type { z } from 'zod';
import type {
  openaiOutputSchema,
  openaiResponseSchema,
} from '../../openai/openai-output.schema.js';
import type { openaiRuntimeSchema } from '../../openai/openai-runtime.schema.js';
import type {
  openaiStreamEventSchema,
  openaiStreamResponseSchema,
} from '../../openai/openai-stream.schema.js';
import type { OPENAI_MODELS } from '../../../openai/openai-model-router.js';

export type OpenaiOutput = z.infer<typeof openaiOutputSchema>;

export type OpenaiResponse = z.infer<typeof openaiResponseSchema>;

export type OpenaiRuntime = z.infer<typeof openaiRuntimeSchema>;

export type OpenaiStreamEvent = z.infer<typeof openaiStreamEventSchema>;

export type OpenaiStreamResponse = z.infer<typeof openaiStreamResponseSchema>;

export type OpenaiModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];
