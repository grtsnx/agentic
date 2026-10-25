import type { Tool, MemorySession } from '@openai/agents';

// SDK token details can contain provider-specific nested breakdowns.
export interface TokenDetails {
  [key: string]: number | TokenDetails;
}

export interface RuntimeSource {
  state: {
    usage: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      inputTokensDetails: TokenDetails[];
      outputTokensDetails: TokenDetails[];
    };
  };
  newItems: Array<{ type: string; toolName?: string }>;
  rawResponses: Array<{ providerData?: Record<string, unknown> }>;
}

export interface OpenaiStreamOptions {
  tools?: Tool[];
  scopedToolsOnly?: boolean;
  hasAttachments?: boolean;
  sources?: import('../web-tools/web-tool.types.js').WebSource[];
  toolInstructions?: string;
  onToolAudit?: (
    event: import('../workspaces/workspace.types.js').ToolAudit,
  ) => void;
  scopeId?: string;
  traceId?: string;
  session?: MemorySession;
  signal?: AbortSignal;
}

export interface OpenaiReplyOptions extends OpenaiStreamOptions {}

export type ErrorRecord = {
  type?: unknown;
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};
