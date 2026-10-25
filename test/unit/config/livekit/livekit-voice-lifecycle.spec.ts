import type { JobContext } from '@livekit/agents';

const fake = vi.hoisted(() => ({
  options: vi.fn(),
  start: vi.fn(),
  generateReply: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@livekit/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@livekit/agents')>();
  return {
    ...actual,
    voice: {
      ...actual.voice,
      AgentSession: class {
        constructor(options: unknown) {
          fake.options(options);
        }
        start = fake.start;
        generateReply = fake.generateReply;
        close = fake.close;
      },
    },
  };
});
vi.mock('@/lib', () => ({ createLiveKitVoiceModel: () => ({}) }));

import agent from '@/config/livekit/livekit-voice-agent.js';

function context() {
  const room = { isConnected: false };
  return {
    room,
    connect: vi.fn(async () => {
      room.isConnected = true;
    }),
    addShutdownCallback: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VOICE_ENABLED', 'true');
  vi.stubEnv('LIVEKIT_URL', 'wss://example.livekit.cloud');
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret');
  fake.start.mockResolvedValue(undefined);
  fake.generateReply.mockResolvedValue(undefined);
  fake.close.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('voice session lifecycle', () => {
  it('connects the room before any session event can be emitted and delegates turn detection to realtime', async () => {
    const ctx = context();
    fake.start.mockImplementationOnce(async () => {
      expect(ctx.room.isConnected).toBe(true);
    });
    await agent.entry(ctx as unknown as JobContext);
    expect(fake.options).toHaveBeenCalledWith(
      expect.objectContaining({
        vad: null,
        turnHandling: { turnDetection: 'realtime_llm' },
      }),
    );
    expect(ctx.connect).toHaveBeenCalledTimes(1);
    expect(fake.generateReply).toHaveBeenCalledTimes(1);
  });

  it('does not start the session or greet after room connection failure', async () => {
    const ctx = context();
    ctx.connect.mockRejectedValueOnce(new Error('Room unavailable'));
    await expect(agent.entry(ctx as unknown as JobContext)).rejects.toThrow(
      'Room unavailable',
    );
    expect(fake.start).not.toHaveBeenCalled();
    expect(fake.generateReply).not.toHaveBeenCalled();
  });

  it('closes the session on shutdown', async () => {
    const ctx = context();
    await agent.entry(ctx as unknown as JobContext);
    const cleanup = ctx.addShutdownCallback.mock.calls[0]?.[0] as
      (() => Promise<void>) | undefined;
    expect(cleanup).toBeTypeOf('function');
    await cleanup!();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
