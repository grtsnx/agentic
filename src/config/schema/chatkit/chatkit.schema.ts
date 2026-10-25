import { z } from 'zod';

const threadId = z.string().uuid();
const pagination = z.object({
  // The web component requests large history pages; the adapter caps each response.
  limit: z.number().int().min(1).nullish(),
  order: z.enum(['asc', 'desc']).default('desc'),
  after: z.string().max(100).nullish(),
});
const input = z
  .object({
    content: z
      .array(
        z.object({ type: z.literal('input_text'), text: z.string().max(8000) }),
      )
      .max(20),
    // Only server-issued file IDs are accepted, never client-provided URLs or metadata.
    attachments: z.array(z.string().uuid()).max(5).default([]),
    quoted_text: z.string().max(8000).nullish(),
    inference_options: z
      .object({ model: z.null().optional(), tool_choice: z.null().optional() })
      .default({}),
  })
  .superRefine((value, context) => {
    const text = value.content.map((part) => part.text).join('\n');
    if (
      (!text.trim() && !value.attachments.length) ||
      text.length + (value.quoted_text?.length ?? 0) > 8000
    )
      context.addIssue({
        code: 'custom',
        message: 'Enter a message of at most 8000 characters.',
      });
  });

// Validate the supported ChatKit protocol subset. Unsupported operations fail explicitly.
export const chatkitRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('threads.create'), params: z.object({ input }) }),
  z.object({
    type: z.literal('threads.add_user_message'),
    params: z.object({ thread_id: threadId, input }),
  }),
  z.object({
    type: z.literal('threads.get_by_id'),
    params: z.object({ thread_id: threadId }),
  }),
  z.object({ type: z.literal('threads.list'), params: pagination }),
  z.object({
    type: z.literal('attachments.delete'),
    params: z.object({ attachment_id: z.string().uuid() }),
  }),
  z.object({
    type: z.literal('items.list'),
    params: pagination.extend({ thread_id: threadId }),
  }),
  z.object({
    type: z.literal('threads.update'),
    params: z.object({
      thread_id: threadId,
      title: z.string().trim().min(1).max(120),
    }),
  }),
  z.object({
    type: z.literal('threads.delete'),
    params: z.object({ thread_id: threadId }),
  }),
  z.object({
    type: z.literal('threads.custom_action'),
    params: z.object({
      thread_id: threadId,
      item_id: z.string().max(100),
      action: z
        .object({
          type: z.literal('approval.decide'),
          payload: z
            .object({ decision: z.enum(['approve', 'deny', 'cancel']) })
            .strict(),
        })
        .strict(),
    }),
  }),
]);
