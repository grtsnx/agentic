import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ConfigService } from '@nestjs/config';
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), execFile: vi.fn() }));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  ...mocks,
}));
import { SandboxService } from '../../../../src/lib/sandbox/sandbox.service.js';

describe('sandbox cleanup failure', () => {
  beforeEach(() => {
    mocks.spawn.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: vi.fn(),
      });
      setImmediate(() => child.emit('close', 0));
      return child;
    });
    mocks.execFile.mockImplementation((_cmd, _args, _options, callback) => {
      setImmediate(() =>
        callback(
          Object.assign(new Error('daemon unavailable'), {
            stderr: 'connection refused',
          }),
        ),
      );
    });
  });
  it('keeps capacity reserved when removal cannot be confirmed', async () => {
    const sandbox = new SandboxService(
      new ConfigService({ SANDBOX_ENABLED: true }),
    );
    try {
      await expect(
        sandbox.execute('1', new AbortController().signal),
      ).rejects.toThrow('cleanup');
      await expect(
        sandbox.execute('2', new AbortController().signal),
      ).rejects.toThrow('cleanup');
      await expect(
        sandbox.execute('3', new AbortController().signal),
      ).rejects.toThrow('capacity');
      expect(mocks.spawn).toHaveBeenCalledTimes(2);
    } finally {
      await sandbox.onModuleDestroy();
    }
  });
});
