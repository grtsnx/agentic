import type { MemorySession } from '@openai/agents';
import type { WsResponse } from '@nestjs/websockets';
import type { ChatSessionDto } from '@/dto';
import type { OpenaiService } from '@/lib';

export interface SessionRecord extends ChatSessionDto {
  providerSession: MemorySession;
  busy: boolean;
}

export interface ConnectionState {
  abortController?: AbortController;
  session: ReturnType<OpenaiService['createSession']>;
}

export type ChatSocketResponse = WsResponse<Record<string, unknown>>;
