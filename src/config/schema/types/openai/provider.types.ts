import type { MemorySession } from '@openai/agents';

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
  session?: MemorySession;
  signal?: AbortSignal;
}

export interface OpenaiReplyOptions extends OpenaiStreamOptions {}

export type ErrorRecord = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};
