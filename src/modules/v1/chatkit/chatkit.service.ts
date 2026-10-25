import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ChatkitAdapterService } from '@/lib';
import { describeException } from '@/middleware';
import {
  chatkitRequestSchema,
  type ChatkitEvent,
  type ChatkitInput,
  type ChatkitItem,
  type ChatkitRequest,
  type ChatkitThread,
  type WorkspaceScope,
  type OpenaiStreamResponse,
} from '@/config';
import { WorkspaceService } from '../workspaces/workspace.service.js';

@Injectable()
export class ChatkitService implements OnModuleDestroy {
  private readonly threads = new Map<string, ChatkitThread>();
  private readonly sweep = setInterval(() => this.expire(), 30_000).unref();

  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly adapter: ChatkitAdapterService,
  ) {}

  authorize(id: string, authorization?: string) {
    return this.workspaces.store.authorize(
      id,
      authorization?.startsWith('Bearer ') ? authorization.slice(7) : '',
    );
  }

  process(body: unknown, owner: WorkspaceScope, signal: AbortSignal) {
    const parsed = chatkitRequestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid or unsupported ChatKit request.');
    const request = parsed.data;
    this.expire();
    owner.abort.signal.throwIfAborted();
    if (request.type === 'threads.list') {
      const records = [...this.threads.values()].filter(
        (thread) => thread.ownerId === owner.id,
      );
      return {
        json: this.adapter.page(
          records.map((thread) => this.adapter.thread(thread, false)),
          request.params.limit ?? 20,
          request.params.order,
          request.params.after,
        ),
      };
    }
    if (request.type === 'threads.create') {
      const credentials = this.workspaces.store.create();
      const scope = this.workspaces.store.authorize(
        credentials.id,
        credentials.token,
      );
      // Child threads cannot outlive the browser capability that owns them.
      scope.expiresAt = Math.min(scope.expiresAt, owner.expiresAt);
      const thread: ChatkitThread = {
        ownerId: owner.id,
        ownerSignal: owner.abort.signal,
        scope,
        createdAt: new Date().toISOString(),
        title: request.params.input.content
          .map((part) => part.text)
          .join(' ')
          .slice(0, 80),
        items: [],
        approvals: new Map(),
        busy: false,
      };
      this.threads.set(scope.id, thread);
      return {
        stream: this.respond(thread, request.params.input, owner, signal, true),
      };
    }
    const thread = this.requireThread(request.params.thread_id, owner);
    switch (request.type) {
      case 'threads.get_by_id':
        return { json: this.adapter.thread(thread) };
      case 'items.list':
        return {
          json: this.adapter.page(
            thread.items,
            request.params.limit ?? 20,
            request.params.order,
            request.params.after,
          ),
        };
      case 'threads.update':
        thread.title = request.params.title;
        return { json: this.adapter.thread(thread) };
      case 'threads.delete':
        this.remove(thread);
        return { json: {} };
      case 'threads.add_user_message':
        this.requireIdle(thread);
        return {
          stream: this.respond(thread, request.params.input, owner, signal),
        };
      case 'threads.custom_action':
        this.requireIdle(thread);
        if (!thread.approvals.has(request.params.item_id))
          throw new NotFoundException('Action not found.');
        return { stream: this.decide(thread, request) };
    }
  }

  private async *respond(
    thread: ChatkitThread,
    input: ChatkitInput,
    owner: WorkspaceScope,
    external: AbortSignal,
    created = false,
  ): AsyncGenerator<ChatkitEvent> {
    this.requireIdle(thread);
    thread.busy = true;
    const signal = AbortSignal.any([
      external,
      owner.abort.signal,
      thread.scope.abort.signal,
    ]);
    const assistant: ChatkitItem = {
      ...this.adapter.base(thread.scope.id),
      type: 'assistant_message',
      content: [{ type: 'output_text', text: '', annotations: [] }],
    };
    let snapshot:
      Awaited<ReturnType<typeof thread.scope.session.getItems>> | undefined;
    let completed = false;
    let finalResponse: OpenaiStreamResponse | undefined;
    try {
      snapshot = await thread.scope.session.getItems();
      signal.throwIfAborted();
      if (created)
        yield { type: 'thread.created', thread: this.adapter.thread(thread) };
      const user: ChatkitItem = {
        ...this.adapter.base(thread.scope.id),
        type: 'user_message',
        content: input.content,
        attachments: [],
        inference_options: {},
        quoted_text: input.quoted_text,
      };
      thread.items.push(user);
      yield { type: 'thread.item.done', item: user };
      yield { type: 'stream_options', stream_options: { allow_cancel: true } };
      yield { type: 'thread.item.added', item: assistant };
      const message =
        input.content.map((part) => part.text).join('\n') +
        (input.quoted_text ? `\nQuoted context:\n${input.quoted_text}` : '');
      for await (const event of this.workspaces.stream(
        thread.scope,
        message,
        signal,
      )) {
        signal.throwIfAborted();
        if (event.type === 'status')
          yield { type: 'progress_update', text: event.message };
        if (event.type === 'delta') {
          assistant.content[0]!.text += event.delta;
          yield {
            type: 'thread.item.updated',
            item_id: assistant.id,
            update: {
              type: 'assistant_message.content_part.text_delta',
              content_index: 0,
              delta: event.delta,
            },
          };
        }
        if (event.type === 'completed') finalResponse = event.response;
      }
      if (!finalResponse) throw new Error('Stream ended without completion');
      signal.throwIfAborted();
      assistant.content[0] = this.adapter.content(finalResponse);
      const usage = this.adapter.usage(thread.scope.id, finalResponse);
      // Drain the workspace stream before committing the completed turn. Persist the
      // final UI items together so a disconnect cannot leave half a completed reply.
      thread.items.push(assistant, usage);
      completed = true;
      yield {
        type: 'thread.item.updated',
        item_id: assistant.id,
        update: {
          type: 'assistant_message.content_part.done',
          content_index: 0,
          content: assistant.content[0],
        },
      };
      yield { type: 'thread.item.done', item: assistant };
      yield { type: 'thread.item.done', item: usage };
      for (const approval of this.workspaces.store.approvals(thread.scope)) {
        if (
          approval.status !== 'pending' ||
          [...thread.approvals.values()].includes(approval.id)
        )
          continue;
        const item = this.adapter.approval(thread.scope.id, approval);
        thread.approvals.set(item.id, approval.id);
        thread.items.push(item);
        yield { type: 'thread.item.done', item };
      }
    } catch (error) {
      if (!signal.aborted)
        yield {
          type: 'error',
          code: 'custom',
          message: describeException(error).message,
          allow_retry: false,
        };
    } finally {
      // Interrupted turns must not silently become conversation history for the next model run.
      try {
        if (!completed && snapshot && !thread.scope.abort.signal.aborted) {
          await thread.scope.session.clearSession();
          await thread.scope.session.addItems(snapshot);
          assistant.content[0]!.text +=
            '\n\nResponse interrupted. Send a new message to continue.';
          thread.items.push(assistant);
        }
      } finally {
        thread.busy = false;
      }
    }
  }

  private async *decide(
    thread: ChatkitThread,
    request: Extract<ChatkitRequest, { type: 'threads.custom_action' }>,
  ): AsyncGenerator<ChatkitEvent> {
    this.requireIdle(thread);
    thread.busy = true;
    const itemId = request.params.item_id;
    const approvalId = thread.approvals.get(itemId)!;
    try {
      const result = await this.workspaces.decide(
        thread.scope,
        approvalId,
        request.params.action.payload.decision,
      );
      const approval = this.workspaces.store
        .approvals(thread.scope)
        .find((item) => item.id === approvalId)!;
      const item = this.adapter.approval(
        thread.scope.id,
        approval,
        itemId,
        result.status,
      );
      thread.items[thread.items.findIndex((entry) => entry.id === itemId)] =
        item;
      yield { type: 'thread.item.replaced', item };
    } catch (error) {
      yield {
        type: 'error',
        code: 'custom',
        message: describeException(error).message,
        allow_retry: false,
      };
    } finally {
      thread.busy = false;
    }
  }

  private requireThread(id: string, owner: WorkspaceScope) {
    const thread = this.threads.get(id);
    if (!thread || thread.ownerId !== owner.id)
      throw new NotFoundException('Conversation not found or expired.');
    return thread;
  }
  private requireIdle(thread: ChatkitThread) {
    if (thread.busy)
      throw new ConflictException(
        'A response is already running in this conversation.',
      );
    if (thread.items.length >= 250)
      throw new ConflictException(
        'Conversation limit reached. Start a new chat.',
      );
  }
  private remove(thread: ChatkitThread) {
    this.workspaces.store.remove(thread.scope);
    this.threads.delete(thread.scope.id);
  }
  private expire() {
    for (const thread of this.threads.values())
      if (
        thread.scope.expiresAt <= Date.now() ||
        thread.scope.abort.signal.aborted ||
        thread.ownerSignal.aborted
      )
        this.remove(thread);
  }
  onModuleDestroy() {
    clearInterval(this.sweep);
    for (const thread of this.threads.values()) this.remove(thread);
  }
}
