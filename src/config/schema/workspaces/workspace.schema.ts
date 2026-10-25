import { z } from 'zod';

export const permissionTierSchema = z.enum(['safe_read', 'sensitive_read', 'write', 'message', 'payment', 'destructive']);
export const workspaceActionSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('execute_code'), code: z.string().min(1).max(16_000) }).strict(),
  z.object({ tool: z.literal('delete_file'), fileId: z.uuid() }).strict(),
]);
export const retrievalSchema = z.object({query: z.string().min(1).max(500), fileIds: z.array(z.uuid()).max(5)}).strict();
export const specialistOutputSchema = z.object({
  answer: z.string().min(1).max(12_000),
  evidence: z.array(z.string().max(1_000)).max(12),
  uncertainties: z.array(z.string().max(1_000)).max(8),
}).strict();
export const delegationSchema = z.object({task: z.string().min(1).max(4_000)}).strict();
