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

export type BuildStatus =
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'error'
  | 'stopped';

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
  /** Set by `cancel()` so the active turn loop breaks and reports `stopped`. */
  cancelRequested: boolean;
  /** The live SDK event stream, kept so `cancel()` can abort it mid-flight. */
  activeStream?: unknown;
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
      cancelRequested: false,
      createdAt: Date.now(),
    };
    this.builds.set(record.id, record);
    this.logger.log(`Build ${record.id} → session ${session.id}`);

    // Fire-and-forget: send the prompt, then stream the orchestrator's events.
    void this.runTurn(record, this.buildContent(input));

    return { buildId: record.id, sessionId: session.id };
  }

  /**
   * Re-binds a build to an existing (durable) Anthropic session after the runtime
   * has forgotten it — e.g. the server restarted while the user's browser still
   * holds the persisted `sessionId`. The session itself lives on Anthropic's side,
   * so we just recreate a local record pointing at it and the user can resume the
   * conversation. If we still have a live record for the session, we reuse it.
   */
  resume(
    sessionId: string,
    knownBuildId?: string,
  ): { buildId: string; sessionId: string; status: BuildStatus } {
    if (!sessionId?.trim()) {
      throw new BadRequestException('`sessionId` is required');
    }

    // Already tracking this session (or this exact build) → reuse it as-is.
    for (const r of this.builds.values()) {
      if (r.sessionId === sessionId || r.id === knownBuildId) {
        return { buildId: r.id, sessionId: r.sessionId, status: r.status };
      }
    }

    // Keep the client's build id when it's free, so its persisted references and
    // any in-flight stream URLs keep lining up after the rebind.
    const id =
      knownBuildId && !this.builds.has(knownBuildId)
        ? knownBuildId
        : randomUUID();

    const record: BuildRecord = {
      id,
      sessionId,
      status: 'awaiting_input',
      events$: new ReplaySubject<SseFrame>(),
      streaming: false,
      cancelRequested: false,
      createdAt: Date.now(),
    };
    this.builds.set(record.id, record);
    // Emit a status frame so a reconnecting client syncs immediately.
    this.setStatus(record, 'awaiting_input');
    this.logger.log(`Rebound build ${record.id} → existing session ${sessionId}`);

    return { buildId: record.id, sessionId, status: record.status };
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
    attachments?: BuildAttachment[],
  ): Promise<{ buildId: string; status: BuildStatus }> {
    const record = this.getRecord(buildId);
    if (record.streaming) {
      throw new BadRequestException(
        'Build is still running — wait for it to pause before approving.',
      );
    }
    const text = message?.trim() || 'Approved — deploy to production.';
    void this.runTurn(record, this.buildContent({ prompt: text, attachments }));
    return { buildId: record.id, status: 'running' };
  }

  /**
   * Stops the in-flight turn for a build. Best-effort: aborts the active event
   * stream and flags the run loop to break, then the turn finalizes as
   * `stopped`. The underlying session stays alive, so the user can resume by
   * sending another message (or wipe the chat and start fresh).
   */
  cancel(buildId: string): { buildId: string; status: BuildStatus } {
    const record = this.getRecord(buildId);
    if (!record.streaming) {
      return { buildId: record.id, status: record.status };
    }
    record.cancelRequested = true;
    const stream = record.activeStream as
      | { controller?: { abort?: () => void }; abort?: () => void }
      | undefined;
    try {
      stream?.controller?.abort?.();
      stream?.abort?.();
    } catch {
      // best-effort — the loop's cancelRequested check will still break it.
    }
    this.logger.log(`Build ${record.id} stop requested`);
    return { buildId: record.id, status: 'stopped' };
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
      // The model only consumes images and PDF/text documents. Other kinds the
      // composer accepts (audio, video, archives, …) are dropped here so an
      // unsupported attachment can never fail the whole build.
      if (!this.isModelSupportedAttachment(a)) {
        this.logger.debug(
          `Skipping unsupported attachment (${a.type}/${a.mediaType ?? '?'})`,
        );
        continue;
      }
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

  /** True when Anthropic can ingest the attachment as a content block. */
  private isModelSupportedAttachment(a: BuildAttachment): boolean {
    // URL attachments are trusted — we can't sniff their bytes here.
    if (a.url && !a.base64) return true;
    const mediaType = (a.mediaType ?? '').toLowerCase();
    if (a.type === 'image') {
      return mediaType === '' || mediaType.startsWith('image/');
    }
    return mediaType === 'application/pdf' || mediaType.startsWith('text/');
  }

  /**
   * Sends one user message and streams the resulting orchestrator events until the
   * turn ends, forwarding every event verbatim to subscribers. When the turn ends the
   * build moves to `awaiting_input` (it may be the preview pause, or simply done —
   * the client decides whether to call /approve).
   */
  private async runTurn(
    record: BuildRecord,
    content: unknown[],
  ): Promise<void> {
    if (record.streaming) return;
    record.streaming = true;
    record.cancelRequested = false;
    this.setStatus(record, 'running');

    try {
      await (this.client.beta as any).sessions.events.send(record.sessionId, {
        events: [{ type: 'user.message', content }],
      });

      const stream = await (this.client.beta as any).sessions.events.stream(
        record.sessionId,
      );
      record.activeStream = stream;

      for await (const event of stream) {
        if (record.cancelRequested) break;
        const kind = (event?.type as string) ?? 'event';
        this.push(record, kind, event);
      }

      record.activeStream = undefined;
      record.streaming = false;
      if (record.cancelRequested) {
        record.cancelRequested = false;
        this.logger.log(`Build ${record.id} stopped by user`);
        this.setStatus(record, 'stopped');
      } else {
        this.setStatus(record, 'awaiting_input');
      }
    } catch (err: any) {
      record.activeStream = undefined;
      record.streaming = false;
      // An abort triggered by cancel() surfaces here as a thrown error — treat
      // it as a clean stop, not a build failure.
      if (record.cancelRequested) {
        record.cancelRequested = false;
        this.logger.log(`Build ${record.id} stopped by user`);
        this.setStatus(record, 'stopped');
        return;
      }
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
