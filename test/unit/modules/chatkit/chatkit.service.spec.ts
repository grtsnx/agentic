import { ChatkitService } from '../../../../src/modules/v1/chatkit/chatkit.service.js';
import { WorkspaceService } from '../../../../src/modules/v1/workspaces/workspace.service.js';
import { WorkspaceStore } from '../../../../src/modules/v1/workspaces/workspace-store.service.js';
import { ChatkitAdapterService } from '@/lib';
import type { ChatkitEvent, WorkspaceScope } from '@/config';

describe('ChatKit lifecycle', () => {
  let store: WorkspaceStore;
  let service: ChatkitService;
  let owner: WorkspaceScope;
  const stream = vi.fn();
  const decide = vi.fn();
  beforeEach(() => {
    store = new WorkspaceStore();
    const credentials = store.create();
    owner = store.authorize(credentials.id, credentials.token);
    service = new ChatkitService(
      { store, stream, decide } as unknown as WorkspaceService,
      new ChatkitAdapterService(),
    );
  });
  afterEach(() => {
    service.onModuleDestroy();
    store.onModuleDestroy();
    vi.clearAllMocks();
  });
  const input = {
    content: [{ type: 'input_text', text: 'Hi' }],
    attachments: [],
    inference_options: {},
  };
  const collect = async (events: AsyncGenerator<ChatkitEvent>) => {
    const result = [];
    for await (const event of events) result.push(event);
    return result;
  };
  it('rolls back failed model context and exposes a sanitized error', async () => {
    let scope: WorkspaceScope;
    stream.mockImplementation(async function* (thread: WorkspaceScope) {
      scope = thread;
      await thread.session.addItems([
        { role: 'user', content: 'partial context' },
      ]);
      yield { type: 'delta', delta: 'Partial' };
      throw new Error('secret upstream detail');
    });
    const result = service.process(
      { type: 'threads.create', params: { input } },
      owner,
      new AbortController().signal,
    );
    const events = await collect(result.stream!);
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(events)).not.toContain('secret upstream');
    expect(await scope!.session.getItems()).toEqual([]);
  });
  it('propagates cancellation and releases the per-thread lock', async () => {
    let signal: AbortSignal;
    stream.mockImplementation(async function* (
      _scope: WorkspaceScope,
      _message: string,
      external: AbortSignal,
    ) {
      signal = external;
      yield { type: 'delta', delta: 'Partial' };
      external.throwIfAborted();
    });
    const abort = new AbortController();
    const { stream: iterator } = service.process(
      { type: 'threads.create', params: { input } },
      owner,
      abort.signal,
    );
    const created = (await iterator!.next()).value as Extract<
      ChatkitEvent,
      { type: 'thread.created' | 'thread.updated' }
    >;
    const request = {
      type: 'threads.add_user_message',
      params: { thread_id: created.thread.id, input },
    };
    expect(() => service.process(request, owner, abort.signal)).toThrow(
      'already running',
    );
    await iterator!.next();
    await iterator!.next();
    await iterator!.next();
    await iterator!.next();
    abort.abort();
    await collect(iterator!);
    expect(signal!.aborted).toBe(true);
    expect(() =>
      service.process(request, owner, new AbortController().signal),
    ).not.toThrow();
  });
  it('expires thread history when the owning workspace is deleted', async () => {
    stream.mockImplementation(async function* () {
      yield { type: 'status', phase: 'thinking', message: 'Thinking' };
      throw new Error('failure');
    });
    const events = await collect(
      service.process(
        { type: 'threads.create', params: { input } },
        owner,
        new AbortController().signal,
      ).stream!,
    );
    const created = events[0] as Extract<
      ChatkitEvent,
      { type: 'thread.created' | 'thread.updated' }
    >;
    store.remove(owner);
    const other = store.create();
    const otherScope = store.authorize(other.id, other.token);
    expect(
      service.process(
        { type: 'threads.list', params: {} },
        otherScope,
        new AbortController().signal,
      ).json,
    ).toMatchObject({ data: [] });
    expect(() =>
      service.process(
        { type: 'threads.get_by_id', params: { thread_id: created.thread.id } },
        otherScope,
        new AbortController().signal,
      ),
    ).toThrow();
  });

  it('binds approval actions to server-owned widgets and rejects replay', async () => {
    stream.mockImplementation(async function* (scope: WorkspaceScope) {
      store.propose(scope, {
        tool: 'execute_code',
        code: 'console.log(2 + 2)',
      });
      yield {
        type: 'completed',
        response: {
          message: 'Review the action card.',
          sources: [],
          runtime: {
            durationMs: 1,
            tokens: {
              input: 1,
              output: 1,
              total: 2,
              cachedInput: 0,
              reasoningOutput: 0,
            },
            cost: {
              estimatedUsd: 0,
              currency: 'USD',
              exact: false,
              includesToolCosts: false,
            },
            models: [],
            tools: [],
          },
        },
      };
    });
    decide.mockImplementation(
      async (
        scope: WorkspaceScope,
        id: string,
        decision: 'approve' | 'deny' | 'cancel',
      ) => ({ status: store.consume(scope, id, decision).status }),
    );
    const events = await collect(
      service.process(
        { type: 'threads.create', params: { input } },
        owner,
        new AbortController().signal,
      ).stream!,
    );
    const created = events[0] as Extract<
      ChatkitEvent,
      { type: 'thread.created' | 'thread.updated' }
    >;
    const card = events.at(-1) as Extract<
      ChatkitEvent,
      {
        type: 'thread.item.added' | 'thread.item.done' | 'thread.item.replaced';
      }
    >;
    const action = {
      type: 'threads.custom_action',
      params: {
        thread_id: created.thread.id,
        item_id: card.item.id,
        action: { type: 'approval.decide', payload: { decision: 'deny' } },
      },
    };
    const result = await collect(
      service.process(action, owner, new AbortController().signal).stream!,
    );
    expect(result[0]).toMatchObject({ type: 'thread.item.replaced' });
    expect(JSON.stringify(result)).toContain('denied');
    expect(JSON.stringify(result)).not.toContain('Approve once');
    const replay = await collect(
      service.process(action, owner, new AbortController().signal).stream!,
    );
    expect(replay[0]).toMatchObject({
      type: 'error',
      message: 'Approval is no longer pending.',
    });
    expect(() =>
      service.process(
        { ...action, params: { ...action.params, item_id: 'forged' } },
        owner,
        new AbortController().signal,
      ),
    ).toThrow('Action not found');
  });
});
