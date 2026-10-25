import type { Request } from 'express';
import type { z } from 'zod';
import type { MemorySession } from '@openai/agents';
import type {
  permissionTierSchema,
  workspaceActionSchema,
  specialistOutputSchema,
} from '../../workspaces/workspace.schema.js';

export type PermissionTier = z.infer<typeof permissionTierSchema>;
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
export type SpecialistOutput = z.infer<typeof specialistOutputSchema>;
export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}
export interface WorkspaceFile {
  id: string;
  filename: string;
  mime: string;
  bytes: number;
  chunks: string[];
  content: Buffer;
  text: string;
  kind: 'text' | 'image' | 'pdf';
  pages?: number;
}
export interface ToolAudit {
  id: string;
  traceId: string;
  scopeId: string;
  tool: string;
  tier: PermissionTier;
  startedAt: string;
  durationMs: number;
  input: unknown;
  output: unknown;
  status:
    'succeeded' | 'failed' | 'cancelled' | 'pending' | 'denied' | 'expired';
  errorCode?: string;
  cost: {
    usd: number | null;
    kind: 'unknown' | 'estimated' | 'local';
    currency: 'USD';
  };
}
export interface ActionApproval {
  id: string;
  digest: string;
  action: WorkspaceAction;
  scopeId: string;
  traceId: string;
  tier: PermissionTier;
  target: string;
  risk: string;
  expiresAt: number;
  status: 'pending' | 'consumed' | 'denied' | 'cancelled' | 'expired';
}
export interface WorkspaceScope {
  id: string;
  tokenHash: Buffer;
  expiresAt: number;
  abort: AbortController;
  files: Map<string, WorkspaceFile>;
  approvals: Map<string, ActionApproval>;
  audit: ToolAudit[];
  session: MemorySession;
  active?: AbortController;
  turns: number;
}
export interface SpecialistContribution {
  agent: string;
  output?: SpecialistOutput;
  error?: string;
}
export interface DelegationContext {
  scopeId: string;
  traceId: string;
  signal: AbortSignal;
  visited: Set<string>;
  handoffs: number;
  contributions: SpecialistContribution[];
}
export interface WorkspaceRequest extends Request {
  workspace: WorkspaceScope;
}

export interface ParsedDocument {
  text: string;
  kind: 'text' | 'image' | 'pdf';
  content?: Uint8Array;
  pages?: number;
}
