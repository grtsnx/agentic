import { runInNewContext } from 'node:vm';
import { CHATKIT_APP } from '@/config/playground/chatkit.asset.js';

function setup(responses: Response[]) {
  const fetch = vi.fn(async () => responses.shift()!);
  const events: Array<[string, unknown]> = [];
  const browserEvents = new Map<string, () => void>();
  const transport = runInNewContext(
    CHATKIT_APP + '\ncreateChatkitTransport();',
    {
      fetch,
      AbortController,
      AbortSignal,
      TextDecoder,
      navigator: { onLine: true },
      queueMicrotask: () => {},
      addEventListener: (name: string, fn: () => void) =>
        browserEvents.set(name, fn),
      workspacePanel: {
        prepare: async () => {},
        credentials: () => ({ workspaceId: 'owner', workspaceToken: 'secret' }),
        clearDrafts: async () => {},
        useFiles: () => {},
      },
    },
  ) as {
    emit(name: string, data: unknown): void;
    on(name: string, handler: (data: unknown) => void): void;
    busy: boolean;
    action(item: { id: string }, action: unknown): Promise<void>;
  };
  for (const name of [
    'chat.started',
    'chat.delta',
    'chat.completed',
    'chat.error',
    'chat.cancelled',
    'chat.widget',
  ])
    transport.on(name, (data) => events.push([name, data]));
  return { transport, fetch, events, browserEvents };
}
function sse(events: unknown[], truncate = false) {
  const bytes = new TextEncoder().encode(
    events
      .map((event) => 'data: ' + JSON.stringify(event) + '\r\n\r\n')
      .join('') + (truncate ? 'data: {' : ''),
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        // Exercise boundaries inside JSON, UTF-8, and CRLF delimiters.
        for (let offset = 0; offset < bytes.length; offset += 3)
          controller.enqueue(bytes.slice(offset, offset + 3));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
const completed = {
  type: 'thread.item.done',
  item: {
    type: 'assistant_message',
    content: [{ text: 'Hello 🙂' }],
    agentic: {
      message: 'Hello 🙂',
      sources: [],
      runtime: { tokens: { input: 5, output: 2, total: 7 } },
    },
  },
};

describe('custom playground ChatKit transport', () => {
  it('preserves streamed UTF-8, runtime metadata and thread continuation', async () => {
    const ui = setup([
      sse([
        { type: 'thread.created', thread: { id: 'thread' } },
        {
          type: 'thread.item.updated',
          update: {
            type: 'assistant_message.content_part.text_delta',
            delta: 'Hello 🙂',
          },
        },
        completed,
      ]),
      Response.json({ files: [] }),
      sse([completed]),
      Response.json({ files: [] }),
    ]);
    ui.transport.emit('chat.send', { message: 'Hello', attachments: ['file'] });
    await vi.waitFor(() => expect(ui.transport.busy).toBe(false));
    expect(ui.events).toContainEqual(['chat.delta', { delta: 'Hello 🙂' }]);
    expect(ui.events).toContainEqual([
      'chat.completed',
      { response: completed.item.agentic },
    ]);
    const first = ui.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(first[0]).toBe('/v1/chatkit/owner');
    expect(
      JSON.parse(first[1].body as string).params.input.attachments,
    ).toEqual(['file']);
    ui.transport.emit('chat.send', { message: 'Continue' });
    await vi.waitFor(() => expect(ui.transport.busy).toBe(false));
    const continuation = ui.fetch.mock.calls[2] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(continuation[1].body as string)).toMatchObject({
      type: 'threads.add_user_message',
      params: { thread_id: 'thread' },
    });
  });
  it('reports truncated streams without declaring completion or replaying the request', async () => {
    const ui = setup([sse([completed], true)]);
    ui.transport.emit('chat.send', { message: 'Hello' });
    await vi.waitFor(() => expect(ui.transport.busy).toBe(false));
    expect(ui.events.some(([name]) => name === 'chat.error')).toBe(true);
    expect(ui.events.some(([name]) => name === 'chat.completed')).toBe(false);
    expect(ui.fetch).toHaveBeenCalledTimes(1);
  });
  it('surfaces provider errors and does not automatically retry approval actions', async () => {
    const ui = setup([sse([{ type: 'error', message: 'Request expired.' }])]);
    await expect(
      ui.transport.action(
        { id: 'approval' },
        { type: 'approval.decide', payload: { decision: 'approve' } },
      ),
    ).rejects.toThrow('Request expired.');
    expect(ui.fetch).toHaveBeenCalledTimes(1);
    expect(ui.transport.busy).toBe(false);
  });
  it('aborts an active stream when stopped', async () => {
    const ui = setup([]);
    ui.fetch.mockImplementation(
      (...args: unknown[]) =>
        new Promise((_resolve, reject) => {
          const signal = (args[1] as RequestInit).signal!;
          signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    ui.transport.emit('chat.send', { message: 'Hello' });
    await vi.waitFor(() => expect(ui.fetch).toHaveBeenCalledTimes(1));
    ui.transport.emit('chat.cancel', {});
    await vi.waitFor(() => expect(ui.transport.busy).toBe(false));
    expect(ui.events.some(([name]) => name === 'chat.cancelled')).toBe(true);
  });
});
