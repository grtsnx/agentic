import { EventEmitter } from 'node:events';
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), execFileSync: vi.fn() }));
vi.mock('node:child_process', () => mocks);
import { runDevelopment } from '../../../../src/config/development.js';

class Child extends EventEmitter {
  constructor(readonly pid: number) {
    super();
  }
}

describe('development process lifecycle', () => {
  const children: Child[] = [];
  const signals = new Map<string, () => void>();
  beforeEach(() => {
    vi.useFakeTimers();
    children.length = 0;
    signals.clear();
    vi.stubEnv('VOICE_ENABLED', 'false');
    mocks.spawn.mockReset().mockImplementation(() => {
      const child = new Child(900001 + children.length);
      children.push(child);
      return child;
    });
    vi.spyOn(process, 'on').mockImplementation(((
      name: string,
      callback: () => void,
    ) => {
      signals.set(name, callback);
      return process;
    }) as typeof process.on);
    vi.spyOn(process, 'removeListener').mockReturnValue(process);
    vi.spyOn(process, 'kill').mockReturnValue(true);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('starts only the API when voice is disabled and stops on Ctrl+C', async () => {
    const result = runDevelopment();
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn.mock.calls[0]![1][0]).toMatch(/main\.js$/);
    signals.get('SIGINT')!();
    children[0]!.emit('close', 0, null);
    await expect(result).resolves.toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts both services with shared environment and terminates them together', async () => {
    vi.stubEnv('VOICE_ENABLED', 'true');
    vi.stubEnv('LIVEKIT_URL', 'wss://example.livekit.cloud');
    vi.stubEnv('LIVEKIT_API_KEY', 'test-key');
    vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret');
    const result = runDevelopment();
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(mocks.spawn.mock.calls[1]![1]).toEqual([
      expect.stringMatching(/voice\.js$/),
      'dev',
      '--log-level',
      'info',
    ]);
    expect(mocks.spawn.mock.calls[1]![2]).toMatchObject({
      shell: false,
      stdio: 'inherit',
    });
    signals.get('SIGINT')!();
    signals.get('SIGINT')!();
    for (const child of children) child.emit('close', 143, 'SIGTERM');
    await expect(result).resolves.toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails the entire run when a service exits unexpectedly', async () => {
    const result = runDevelopment();
    children[0]!.emit('close', 7, null);
    await expect(result).resolves.toBe(7);
  });

  it('bounds shutdown when a service ignores the first signal', async () => {
    const result = runDevelopment();
    signals.get('SIGTERM')!();
    await vi.advanceTimersByTimeAsync(5000);
    if (process.platform === 'win32')
      expect(mocks.execFileSync).toHaveBeenCalled();
    else
      expect(process.kill).toHaveBeenCalledWith(-children[0]!.pid, 'SIGKILL');
    children[0]!.emit('close', null, 'SIGKILL');
    await expect(result).resolves.toBe(0);
  });

  it('returns failure on spawn errors and removes its signal handlers', async () => {
    const result = runDevelopment();
    children[0]!.emit('error', new Error('failed to spawn'));
    children[0]!.emit('close', -2, null);
    await expect(result).resolves.toBe(1);
    expect(process.removeListener).toHaveBeenCalledWith(
      'SIGINT',
      expect.any(Function),
    );
  });
});
