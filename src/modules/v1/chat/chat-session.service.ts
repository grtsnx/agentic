import type { SessionRecord } from '@/config';
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MemorySession } from '@openai/agents';
import { type ChatSessionDto, type ChatV1ResponseDto } from '@/dto';
import { OpenaiService } from '@/lib';

@Injectable()
export class ChatSessionService {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly openai: OpenaiService,
    private readonly config: ConfigService,
  ) {}

  create(): ChatSessionDto {
    const now = Date.now();
    const record: SessionRecord = {
      id: randomUUID(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttl).toISOString(),
      turns: 0,
      providerSession: this.openai.createSession(),
      busy: false,
    };
    this.sessions.set(record.id, record);
    return this.publicRecord(record);
  }

  async send(id: string, message: string): Promise<ChatV1ResponseDto> {
    const record = this.requireActive(id);
    if (Math.ceil(message.length / 4) > this.maxTokens) {
      throw new PayloadTooLargeException({
        message: 'The message exceeds the session token budget.',
        data: { code: 'SESSION_TOKEN_LIMIT' },
      });
    }
    if (record.busy) {
      throw new ConflictException({
        message: 'A turn is already active for this session.',
        data: { code: 'SESSION_BUSY' },
      });
    }
    if (record.turns >= this.maxTurns) {
      throw new ConflictException({
        message: 'The session turn limit has been reached.',
        data: { code: 'SESSION_TURN_LIMIT' },
      });
    }

    record.busy = true;
    try {
      await this.compactIfNeeded(record.providerSession, message);
      const response = await this.openai.generateReply(message.trim(), {
        session: record.providerSession,
      });
      record.turns += 1;
      record.expiresAt = new Date(Date.now() + this.ttl).toISOString();
      return response;
    } finally {
      record.busy = false;
    }
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  private requireActive(id: string): SessionRecord {
    const record = this.sessions.get(id);
    if (!record) throw new NotFoundException('Chat session not found.');
    if (Date.parse(record.expiresAt) <= Date.now()) {
      this.sessions.delete(id);
      throw new GoneException({
        message: 'The chat session has expired.',
        data: { code: 'SESSION_EXPIRED' },
      });
    }
    return record;
  }

  private async compactIfNeeded(
    session: MemorySession,
    nextMessage: string,
  ): Promise<void> {
    const items = await session.getItems();
    const serialized = JSON.stringify(items);
    const estimatedTokens = Math.ceil(
      (serialized.length + nextMessage.length) / 4,
    );
    if (estimatedTokens < this.maxTokens * 0.8) return;

    // This bounded extractive summary prevents old context from growing indefinitely.
    const summary = serialized.slice(-Math.max(100, this.maxTokens * 2));
    await session.clearSession();
    await session.addItems([
      {
        role: 'user',
        content: `[Conversation summary of earlier turns]\n${summary}`,
      },
    ]);
  }

  private publicRecord(record: SessionRecord): ChatSessionDto {
    return {
      id: record.id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      turns: record.turns,
    };
  }

  private get ttl(): number {
    return this.config.getOrThrow<number>('SESSION_TTL_MS');
  }

  private get maxTurns(): number {
    return this.config.getOrThrow<number>('SESSION_MAX_TURNS');
  }

  private get maxTokens(): number {
    return this.config.getOrThrow<number>('SESSION_MAX_TOKENS');
  }
}
