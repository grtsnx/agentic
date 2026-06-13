import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { Observable, ReplaySubject } from 'rxjs';

import { AgentsConfig, loadAgentsConfig } from './agents-config';

/** A user-supplied attachment forwarded to the Orchestrator as a content block. */
export interface BuildAttachment {
  /** 'image' for logos/screenshots/photos, 'document' for PDFs/brand kits. */
  type: 'image' | 'document';
  /** Public URL to fetch (preferred). */
  url?: string;
  /** Or inline base64 bytes (use mediaType to declare the format). */
  base64?: string;
  /** e.g. 'image/png', 'image/jpeg', 'application/pdf'. Defaults to image/png. */
  mediaType?: string;
}

export interface StartBuildInput {
  /** The natural-language build request, e.g. "Build a landing page for my bakery". */
  prompt: string;
  /** Optional images/logos/links the user attached — honored end-to-end by the agents. */
  attachments?: BuildAttachment[];
}

export type BuildStatus = 'running' | 'awaiting_input' | 'completed' | 'error';

/** Envelope every SSE frame is wrapped in so the frontend can switch on `kind`. */
interface SseFrame {
  data: { kind: string; payload: unknown };
}

interface BuildRecord {
  id: string;
  sessionId: string;
  status: BuildStatus;
  /** ReplaySubject so late subscribers / reconnects replay the full event history. */
  events$: ReplaySubject<SseFrame>;
  /** Guards against two turns streaming the same session concurrently. */
  streaming: boolean;
  createdAt: number;
}

@Injectable()
export class RuntimeService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeService.name);
  private readonly builds = new Map<string, BuildRecord>();

  private client!: Anthropic;
  private agents!: AgentsConfig;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.client = new Anthropic({
      apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
    });
    // Loaded once at boot; fails fast with a clear message if setup wasn't run.
    this.agents = loadAgentsConfig();
    this.logger.log(
      `Runtime ready — orchestrator ${this.agents.agentIds.orchestrator}`,
    );
  }

  /**
   * Opens a session on the Orchestrator, attaches the provisioned memory store, and
   * kicks off the build in the background. Returns immediately with a build id the
   * caller streams from.
   */
  async start(
    input: StartBuildInput,
  ): Promise<{ buildId: string; sessionId: string }> {
    if (!input?.prompt?.trim()) {
      throw new BadRequestException('`prompt` is required');
    }

    const resources = this.agents.memoryStoreId
      ? [{ type: 'memory_store', memory_store_id: this.agents.memoryStoreId }]
      : [];

    const session = await (this.client.beta as any).sessions.create({
      agent: this.agents.agentIds.orchestrator,
      environment_id: this.agents.environmentId,
      resources,
    });

    const record: BuildRecord = {
      id: randomUUID(),
      sessionId: session.id,
      status: 'running',
      events$: new ReplaySubject<SseFrame>(),
      streaming: false,
      createdAt: Date.now(),
    };
    this.builds.set(record.id, record);
    this.logger.log(`Build ${record.id} → session ${session.id}`);

    // Fire-and-forget: send the prompt, then stream the orchestrator's events.
    void this.runTurn(record, this.buildContent(input));

    return { buildId: record.id, sessionId: session.id };
  }

  /** Returns the live SSE stream of orchestrator events for a build. */
  stream(buildId: string): Observable<SseFrame> {
    return this.getRecord(buildId).events$.asObservable();
  }

  /** Lightweight status poll (for clients that don't want the SSE stream). */
  getStatus(buildId: string): {
    buildId: string;
    sessionId: string;
    status: BuildStatus;
    createdAt: number;
  } {
    const r = this.getRecord(buildId);
    return {
      buildId: r.id,
      sessionId: r.sessionId,
      status: r.status,
      createdAt: r.createdAt,
    };
  }

  /**
   * Continues a paused build past the preview gate. The Orchestrator pauses after
   * preview and waits for input; this sends an approval message and resumes streaming
   * on the same session (so deploy + version run).
   */
  async approve(
    buildId: string,
    message?: string,
  ): Promise<{ buildId: string; status: BuildStatus }> {
    const record = this.getRecord(buildId);
    if (record.streaming) {
      throw new BadRequestException(
        'Build is still running — wait for it to pause before approving.',
      );
    }
    const text = message?.trim() || 'Approved — deploy to production.';
    void this.runTurn(record, [{ type: 'text', text }]);
    return { buildId: record.id, status: 'running' };
  }

  // ── internals ─────────────────────────────────────────────────────────

  private getRecord(buildId: string): BuildRecord {
    const record = this.builds.get(buildId);
    if (!record) throw new NotFoundException(`Unknown build: ${buildId}`);
    return record;
  }

  private buildContent(input: StartBuildInput): unknown[] {
    const blocks: unknown[] = [{ type: 'text', text: input.prompt }];
    for (const a of input.attachments ?? []) {
      const blockType = a.type === 'document' ? 'document' : 'image';
      if (a.url) {
        blocks.push({ type: blockType, source: { type: 'url', url: a.url } });
      } else if (a.base64) {
        blocks.push({
          type: blockType,
          source: {
            type: 'base64',
            media_type: a.mediaType ?? 'image/png',
            data: a.base64,
          },
        });
      }
    }
    return blocks;
  }

  /**
   * Sends one user message and streams the resulting orchestrator events until the
   * turn ends, forwarding every event verbatim to subscribers. When the turn ends the
   * build moves to `awaiting_input` (it may be the preview pause, or simply done —
   * the client decides whether to call /approve).
   */
  private async runTurn(record: BuildRecord, content: unknown[]): Promise<void> {
    if (record.streaming) return;
    record.streaming = true;
    this.setStatus(record, 'running');

    try {
      await (this.client.beta as any).sessions.events.send(record.sessionId, {
        events: [{ type: 'user.message', content }],
      });

      const stream = await (this.client.beta as any).sessions.events.stream(
        record.sessionId,
      );

      for await (const event of stream) {
        const kind = (event?.type as string) ?? 'event';
        this.push(record, kind, event);
      }

      record.streaming = false;
      this.setStatus(record, 'awaiting_input');
    } catch (err: any) {
      record.streaming = false;
      this.logger.error(`Build ${record.id} failed: ${err?.message ?? err}`);
      this.push(record, 'error', { message: String(err?.message ?? err) });
      this.setStatus(record, 'error');
    }
  }

  private push(record: BuildRecord, kind: string, payload: unknown): void {
    record.events$.next({ data: { kind, payload } });
  }

  private setStatus(record: BuildRecord, status: BuildStatus): void {
    record.status = status;
    this.push(record, 'status', { status });
  }
}
