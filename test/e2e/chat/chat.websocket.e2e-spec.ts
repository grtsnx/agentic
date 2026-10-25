import type { AddressInfo } from 'node:net';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap/application.js';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let socket: Socket;

  beforeEach(async () => {
    const openaiService = {
      createSession: vi.fn(() => ({ id: 'session' })),
      streamReply: vi.fn(async function* () {
        yield { type: 'delta', delta: 'Hello' } as const;
        yield {
          type: 'completed',
          response: {
            message: 'Hello',
            runtime: {
              tokens: {
                input: 10,
                output: 2,
                total: 12,
                cachedInput: 0,
                reasoningOutput: 0,
              },
              cost: {
                estimatedUsd: 0.0002,
                currency: 'USD',
                exact: false,
                includesToolCosts: true,
              },
              models: [{ name: 'gpt-6-astra', calls: 1 }],
              tools: [],
            },
          },
        } as const;
      }),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenaiService)
      .useValue(openaiService)
      .compile();

    app = module.createNestApplication({ logger: false });
    configureApplication(
      app,
      validateEnvironment({ NODE_ENV: 'test', SWAGGER_ENABLED: false }),
    );
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address() as AddressInfo;
    socket = io(`http://127.0.0.1:${address.port}/v1/chat`, {
      autoConnect: false,
      transports: ['websocket'],
    });
  });

  it('streams chat events over Socket.IO', async () => {
    const received: string[] = [];

    const completed = new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        socket.on('connect', () => {
          socket.emit('chat.send', { message: 'Hello' });
        });
        socket.on('chat.started', () => received.push('chat.started'));
        socket.on('chat.delta', () => received.push('chat.delta'));
        socket.on('chat.completed', (data) => {
          received.push('chat.completed');
          resolve(data);
        });
        socket.on('connect_error', reject);
        socket.connect();
      },
    );

    await expect(completed).resolves.toMatchObject({
      response: { message: 'Hello' },
    });
    expect(received).toEqual(['chat.started', 'chat.delta', 'chat.completed']);
  });

  it('rejects browser connections from untrusted origins', async () => {
    const address = app.getHttpServer().address() as AddressInfo;
    const untrusted = io(`http://127.0.0.1:${address.port}/v1/chat`, {
      autoConnect: false,
      transports: ['websocket'],
      extraHeaders: { Origin: 'https://evil.example.com' },
    });

    const rejected = new Promise<void>((resolve, reject) => {
      untrusted.on('connect_error', () => resolve());
      untrusted.on('connect', () =>
        reject(new Error('Untrusted origin connected')),
      );
      untrusted.connect();
    });

    await expect(rejected).resolves.toBeUndefined();
    untrusted.disconnect();
  });

  it('returns a safe event for invalid chat messages', async () => {
    const error = new Promise<Record<string, unknown>>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('chat.send', { message: '' });
      });
      socket.on('chat.error', resolve);
      socket.on('connect_error', reject);
      socket.connect();
    });

    await expect(error).resolves.toEqual({
      code: 'INVALID_MESSAGE',
      message: 'The WebSocket message is invalid.',
    });
  });

  afterEach(async () => {
    socket.disconnect();
    await app.close();
  });
});
