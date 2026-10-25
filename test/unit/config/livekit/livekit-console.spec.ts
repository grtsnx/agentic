import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLiveKitConsole } from '@/config/livekit/livekit-console.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const spawn = vi.mocked(spawnSync);

function result(status: number | null, error?: NodeJS.ErrnoException) {
  return {
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    signal: null,
    status,
    error,
  };
}

describe('native voice console launcher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves device names containing spaces and shell characters as literal arguments', () => {
    spawn.mockReturnValue(result(0));
    expect(
      runLiveKitConsole(['--input-device', 'USB Mic & Headset', '--text']),
    ).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'lk.exe' : 'lk',
      [
        'agent',
        'console',
        fileURLToPath(new URL('../../../../src/voice.js', import.meta.url)),
        '--input-device',
        'USB Mic & Headset',
        '--text',
      ],
      { stdio: 'inherit', shell: false },
    );
  });

  it('shows CLI help without treating the worker path as a help topic', () => {
    spawn.mockReturnValue(result(0));
    expect(runLiveKitConsole(['--help'])).toBe(0);
    expect(spawn.mock.lastCall?.[1]).toEqual(['agent', 'console', '--help']);
  });

  it('preserves non-zero CLI exit codes', () => {
    spawn.mockReturnValue(result(23));
    expect(runLiveKitConsole([])).toBe(23);
  });

  it('reports a missing native executable without leaking the environment', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    spawn.mockReturnValue(
      result(
        null,
        Object.assign(new Error('spawn failed'), { code: 'ENOENT' }),
      ),
    );
    expect(runLiveKitConsole([])).toBe(127);
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('Install the LiveKit CLI'),
    );
  });

  it('treats termination without an exit status as a failure', () => {
    spawn.mockReturnValue({ ...result(null), signal: 'SIGTERM' });
    expect(runLiveKitConsole([])).toBe(1);
  });
});
