import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ChatkitAdapterService } from '@/lib';
import { MemorySession } from '@openai/agents';
import { describeException } from '@/middleware';
import {
  chatkitRequestSchema,
  WORKSPACE_MAX_BYTES,
  type UploadedDocument,
  type WorkspaceFile,
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

  computerScope(owner: WorkspaceScope, id: string) { return this.requireThread(id, owner).scope; }
  get computer() { return this.workspaces.computer; }

  async upload(owner: WorkspaceScope, file: UploadedDocument) {
    const uploaded = await this.workspaces.files.upload(owner, file);
    return this.adapter.attachment(
      this.workspaces.files.get(owner, uploaded.id),
    );
  }

  file(owner: WorkspaceScope, id: string): WorkspaceFile {
    this.expire();
    const staged = owner.files.get(id);
    if (staged) return staged;
    for (const thread of this.threads.values()) {
      if (thread.ownerId === owner.id && thread.scope.files.has(id))
        return thread.scope.files.get(id)!;
    }
    throw new NotFoundException('File not found or expired.');
  }

  private attach(
    thread: ChatkitThread,
    input: ChatkitInput,
    owner: WorkspaceScope,
  ) {
    const files = [...new Set(input.attachments)].map((id) => {
      const file = owner.files.get(id) ?? thread.scope.files.get(id);
      if (!file)
        throw new NotFoundException(
          'Attachment not found in this conversation.',
        );
      return file;
    });
    const merged = new Map(thread.scope.files);
    for (const file of files) merged.set(file.id, file);
    if (
      merged.size > 5 ||
      [...merged.values()].reduce((sum, file) => sum + file.bytes, 0) >
        WORKSPACE_MAX_BYTES
    )
      throw new PayloadTooLargeException(
        'Limit: five files and 2 MiB per conversation.',
      );
    // Validate the whole set before synchronously moving staging files into this
    // thread. Other threads cannot retrieve them through the model's tools.
    for (const file of files) {
      thread.scope.files.set(file.id, file);
      owner.files.delete(file.id);
    }
    return files;
  }

  process(body: unknown, owner: WorkspaceScope, signal: AbortSignal) {
    const parsed = chatkitRequestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid or unsupported ChatKit request.');
    const request = parsed.data;
    this.expire();
    owner.abort.signal.throwIfAborted();
    if (request.type === 'attachments.delete') {
      // Removing a draft attachment must not delete files already sent to a thread.
      if (owner.files.has(request.params.attachment_id))
        this.workspaces.files.delete(owner, request.params.attachment_id);
      return { json: {} };
    }
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
      owner.abort.signal.addEventListener('abort',()=>this.workspaces.store.remove(scope),{once:true});
      const thread: ChatkitThread = {
        ownerId: owner.id,
        ownerSignal: owner.abort.signal,
        scope,
        createdAt: new Date().toISOString(),
        title:
          request.params.input.content
            .map((part) => part.text)
            .join(' ')
            .slice(0, 80) || 'Attachments',
        items: [],
        approvals: new Map(),
        busy: false,
        checkpoints: new Map(),
      };
      try {
        this.attach(thread, request.params.input, owner);
      } catch (error) {
        this.workspaces.store.remove(scope);
        throw error;
      }
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
        this.attach(thread, request.params.input, owner);
        return {
          stream: this.respond(thread, request.params.input, owner, signal),
        };
      case 'threads.edit_user_message': {
        this.requireIdle(thread);
        const item = thread.items.find(
          (item) => item.id === request.params.item_id,
        );
        if (
          !item ||
          item.type !== 'user_message' ||
          !thread.checkpoints.has(item.id)
        )
          throw new NotFoundException(
            'Message not found or no longer editable.',
          );
        if (item.attachments.some((file) => !thread.scope.files.has(file.id)))
          throw new ConflictException(
            'An attachment was deleted. Send a new message instead.',
          );
        const edited: ChatkitInput = {
          content: [{ type: 'input_text', text: request.params.text }],
          attachments: item.attachments.map((file) => file.id),
          inference_options: {},
          quoted_text: item.quoted_text,
        };
        if (
          !chatkitRequestSchema.safeParse({
            type: 'threads.create',
            params: { input: edited },
          }).success
        )
          throw new BadRequestException('The edited message is too long.');
        return {
          stream: this.respond(thread, edited, owner, signal, false, item.id),
        };
      }
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
    editId?: string,
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
      if (editId) {
        const index = thread.items.findIndex((item) => item.id === editId);
        const offset = thread.checkpoints.get(editId);
        if (index < 0 || offset === undefined)
          throw new NotFoundException(
            'Message not found or no longer editable.',
          );
        const kept = thread.items.slice(0, index);
        const removed = thread.items.slice(index);
        const retainedFiles = new Set(input.attachments);
        for (const item of kept)
          if (item.type === 'user_message')
            for (const file of item.attachments) retainedFiles.add(file.id);
        snapshot = snapshot.slice(0, offset);
        // Prepare replacement memory before committing. No async gap during the
        // history/file/approval transition; completed side effects and audits remain.
        const session = new MemorySession({ initialItems: snapshot });
        const pending = this.workspaces.store
          .approvals(thread.scope)
          .filter((approval) => approval.status === 'pending');
        for (const approval of pending)
          this.workspaces.store.consume(thread.scope, approval.id, 'cancel');
        thread.scope.session = session;
        thread.items = kept;
        for (const id of thread.scope.files.keys())
          if (!retainedFiles.has(id)) thread.scope.files.delete(id);
        for (const item of removed) {
          thread.checkpoints.delete(item.id);
          thread.approvals.delete(item.id);
        }
        // Clear stale cards in the retained prefix too. Never replay an approval
        // or refund the workspace turn budget just because text was edited.
        const updated: ChatkitItem[] = [];
        for (const [itemId, approvalId] of thread.approvals) {
          const approval = this.workspaces.store
            .approvals(thread.scope)
            .find((item) => item.id === approvalId);
          if (!approval || !pending.some((item) => item.id === approvalId))
            continue;
          const card = this.adapter.approval(thread.scope.id, approval, itemId);
          const position = thread.items.findIndex((item) => item.id === itemId);
          if (position >= 0) {
            thread.items[position] = card;
            updated.push(card);
          }
        }
        for (const item of removed)
          yield { type: 'thread.item.removed', item_id: item.id };
        for (const item of updated)
          yield { type: 'thread.item.replaced', item };
      }
      if (created)
        yield { type: 'thread.created', thread: this.adapter.thread(thread) };
      const user: ChatkitItem = {
        ...this.adapter.base(thread.scope.id),
        type: 'user_message',
        content: input.content,
        attachments: input.attachments.map((id) =>
          this.adapter.attachment(thread.scope.files.get(id)!),
        ),
        inference_options: {},
        quoted_text: input.quoted_text,
      };
      thread.checkpoints.set(user.id, snapshot.length);
      thread.items.push(user);
      yield { type: 'thread.item.done', item: user };
      if (input.attachments.length) {
        const files = this.adapter.files(
          thread.scope.id,
          input.attachments.map((id) => thread.scope.files.get(id)!),
        );
        thread.items.push(files);
        yield { type: 'thread.item.done', item: files };
      }
      yield { type: 'stream_options', stream_options: { allow_cancel: true } };
      yield { type: 'thread.item.added', item: assistant };
      const message =
        (input.content.map((part) => part.text).join('\n') ||
          'Help me understand the attached files.') +
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
      assistant.agentic = finalResponse;
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
