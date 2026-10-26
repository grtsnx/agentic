const fake = vi.hoisted(() => ({
  run: vi.fn(),
  close: vi.fn(),
  options: vi.fn(),
  logger: vi.fn(),
  cli: vi.fn(),
}));
vi.mock('@livekit/agents', async (original) => {
  const actual = await original<typeof import('@livekit/agents')>();
  return {
    ...actual,
    initializeLogger: fake.logger,
    cli: { runApp: fake.cli },
    AgentServer: class {
      constructor(options: unknown) {
        fake.options(options);
      }
      run = fake.run;
      close = fake.close;
    },
  };
});
import { runLiveKitVoiceWorker } from '../../../../src/config/livekit/livekit-voice-worker.js';

describe('supervised LiveKit development worker', () => {
  const signals = new Map<string, () => void>();
  let finishRun: () => void;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv('LIVEKIT_URL', 'wss://example.livekit.cloud');
    vi.stubEnv('LIVEKIT_DEV_MODE', '');
    signals.clear();
    fake.run.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRun = resolve;
        }),
    );
    fake.close.mockImplementation(async () => {
      finishRun?.();
    });
    vi.spyOn(process, 'on').mockImplementation(((
      name: string,
      fn: () => void,
    ) => {
      signals.set(name, fn);
      return process;
    }) as typeof process.on);
    vi.spyOn(process, 'removeListener').mockReturnValue(process);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('uses readable logging and loopback ephemeral health without production pooling', async () => {
    const running = runLiveKitVoiceWorker('local');
    expect(fake.logger).toHaveBeenCalledWith({ pretty: true, level: 'info' });
    expect(fake.options).toHaveBeenCalledWith(
      expect.objectContaining({
        production: false,
        host: '127.0.0.1',
        port: 0,
        numIdleProcesses: 0,
        wsURL: 'wss://example.livekit.cloud',
      }),
    );
    expect(fake.cli).not.toHaveBeenCalled();
    expect(process.env.LIVEKIT_DEV_MODE).toBe('1');
    signals.get('SIGINT')!();
    signals.get('SIGTERM')!();
    await running;
    expect(fake.close).toHaveBeenCalledTimes(1);
    expect(process.removeListener).toHaveBeenCalledWith(
      'SIGTERM',
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up and propagates startup failures', async () => {
    fake.run.mockRejectedValueOnce(new Error('connection failed'));
    await expect(runLiveKitVoiceWorker('local')).rejects.toThrow(
      'connection failed',
    );
    expect(fake.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled shutdown', async () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    fake.close.mockImplementationOnce(() => new Promise(() => {}));
    void runLiveKitVoiceWorker('local');
    signals.get('SIGTERM')!();
    await vi.advanceTimersByTimeAsync(5000);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('preserves the SDK CLI for production and console commands', async () => {
    await runLiveKitVoiceWorker('start');
    expect(fake.cli).toHaveBeenCalledTimes(1);
    expect(fake.run).not.toHaveBeenCalled();
  });
});
