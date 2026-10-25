import { lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import type { Socket } from 'socket.io';
import { ChatV1Gateway } from '@/modules/v1/chat/chat.gateway.js';

describe('ChatV1Gateway', () => {
  it('maps the shared chat stream to versioned WebSocket events', async () => {
    const session = { id: 'session' };
    const openaiService = {
      createSession: vi.fn(() => session),
      streamReply: vi.fn(async function* () {
        yield {
          type: 'status',
          phase: 'thinking',
          message: 'Thinking',
        } as const;
        yield { type: 'delta', delta: 'Hello' } as const;
        yield {
          type: 'completed',
          response: { message: 'Hello', runtime: { tokens: {} } },
        } as const;
      }),
    };
    const gateway = new ChatV1Gateway(openaiService as never);
    const client = {} as Socket;
    gateway.handleConnection(client);

    const events = await lastValueFrom(
      gateway.sendMessage(client, { message: 'Hello' }).pipe(toArray()),
    );

    expect(events.map((event) => event.event)).toEqual([
      'chat.started',
      'chat.status',
      'chat.delta',
      'chat.completed',
    ]);
    expect(events[1]?.data).toEqual(
      expect.objectContaining({ phase: 'thinking', message: 'Thinking' }),
    );
    expect(events[2]?.data).toEqual(
      expect.objectContaining({ delta: 'Hello' }),
    );
    expect(openaiService.streamReply).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ session, signal: expect.any(AbortSignal) }),
    );
  });

  it('prevents overlapping turns and cancels the active turn', async () => {
    const openaiService = {
      createSession: vi.fn(() => ({ id: 'session' })),
      streamReply: vi.fn(async function* (
        _message: string,
        _options: { signal: AbortSignal },
      ) {
        await new Promise(() => undefined);
        yield { type: 'delta', delta: '' } as const;
      }),
    };
    const gateway = new ChatV1Gateway(openaiService as never);
    const client = {} as Socket;
    gateway.handleConnection(client);

    gateway.sendMessage(client, { message: 'First' });
    const busy = await lastValueFrom(
      gateway.sendMessage(client, { message: 'Second' }),
    );
    const cancelling = gateway.cancel(client);
    const signal = openaiService.streamReply.mock.calls[0]?.[1]?.signal;

    expect(busy).toEqual({
      event: 'chat.error',
      data: {
        code: 'CHAT_BUSY',
        message: 'Wait for the active response or cancel it first.',
      },
    });
    expect(cancelling).toEqual({ event: 'chat.cancelling', data: {} });
    expect(signal?.aborted).toBe(true);
  });
});
