import { z } from 'zod';
export const computerTargetSchema = z.enum(['browser', 'desktop']);
export const computerObserveSchema = z
  .object({
    app: z
      .string()
      .max(120)
      .nullable()
      .describe('An allowed macOS bundle ID; null for the browser.'),
  })
  .strict();
export const computerActionSchema = z
  .object({
    observationId: z.uuid(),
    kind: z.enum(['navigate', 'click', 'type', 'key', 'scroll']),
    index: z.number().int().min(0).max(10000).nullable(),
    value: z.string().max(2000).nullable(),
  })
  .strict()
  .superRefine((action, context) => {
    const valid =
      action.kind === 'click'
        ? action.index !== null && action.value === null
        : action.kind === 'type'
          ? action.index !== null && action.value !== null
          : action.kind === 'navigate'
            ? action.index === null && !!action.value
            : action.kind === 'key'
              ? action.index === null &&
                [
                  'Enter',
                  'Tab',
                  'Escape',
                  'ArrowDown',
                  'ArrowUp',
                  'Backspace',
                ].includes(action.value ?? '')
              : action.index !== null &&
                ['up', 'down'].includes(action.value ?? '');
    if (!valid)
      context.addIssue({
        code: 'custom',
        message: 'Invalid action arguments.',
      });
  });
export const computerApprovedActionSchema = computerActionSchema.safeExtend({
  tool: z.literal('computer_action'),
  context: z.string().max(4000),
  leaseId: z.uuid(),
  target: computerTargetSchema,
  app: z.string().nullable(),
});
export const macosObservationSchema = z.object({
  text: z.string().max(200000),
  app: z.string(),
  screenshot: z.unknown().optional(),
});

export const macosDoctorSchema = z.object({ ready: z.boolean() }).passthrough();

// Describe conditional requirements in JSON Schema, not only a local refinement.
// This keeps small models from filling irrelevant fields for a navigation action.
export const computerToolActionSchema = z
  .object({
    observationId: z.uuid(),
    action: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('navigate'),
          url: z.string().max(2000).describe('Absolute public HTTP(S) URL'),
        })
        .strict(),
      z
        .object({
          kind: z.literal('click'),
          index: z.number().int().min(0).max(10000),
        })
        .strict(),
      z
        .object({
          kind: z.literal('type'),
          index: z.number().int().min(0).max(10000),
          text: z.string().max(2000),
        })
        .strict(),
      z
        .object({
          kind: z.literal('key'),
          key: z.enum([
            'Enter',
            'Tab',
            'Escape',
            'ArrowDown',
            'ArrowUp',
            'Backspace',
          ]),
        })
        .strict(),
      z
        .object({
          kind: z.literal('scroll'),
          index: z.number().int().min(0).max(10000),
          direction: z.enum(['up', 'down']),
        })
        .strict(),
    ]),
  })
  .strict();
