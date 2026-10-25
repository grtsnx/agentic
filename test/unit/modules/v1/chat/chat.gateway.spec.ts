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
      'chat.delta',
      'chat.completed',
    ]);
    expect(events[1]?.data).toEqual(
      expect.objectContaining({ delta: 'Hello' }),
    );
    expect(openaiService.streamReply).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ session, signal: expect.any(AbortSignal) }),
    );
  });
});
