import { Readable, Writable } from 'node:stream';
import { CliService } from '@/cli/cli.service.js';

describe('CliService', () => {
  it('streams a reply and prints runtime usage', async () => {
    const openaiService = {
      createSession: vi.fn(() => ({ id: 'session' })),
      streamReply: vi.fn(async function* () {
        yield {
          type: 'status',
          phase: 'thinking',
          message: 'Thinking',
        } as const;
        yield { type: 'delta', delta: 'Hello' } as const;
        yield {
          type: 'completed',
          response: {
            message: 'Hello',
            runtime: {
              durationMs: 250,
              tokens: { input: 10, output: 2, total: 12 },
              cost: { estimatedUsd: 0.0002 },
              models: [{ name: 'gpt-6-luna', calls: 1 }],
              tools: [{ name: 'context_dev_search', calls: 1 }],
            },
          },
        } as const;
      }),
    };
    let output = '';
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const input = Readable.from(['Hello\n/exit\n']);

    await expect(
      new CliService(openaiService as never).run(input, writable),
    ).resolves.toBe(0);

    expect(output).toContain('Hello');
    expect(output).toContain('Thinking');
    expect(output).toContain('Agent: Hello');
    expect(output).toContain('Time: 0.25s');
    expect(output).toContain('Tokens: 10 in / 2 out / 12 total');
    expect(output).toContain('Estimated cost: $0.00020000 USD');
    expect(output).toContain('Models: gpt-6-luna (1)');
    expect(output).not.toContain('context_dev_search');
    expect(openaiService.streamReply).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ session: { id: 'session' } }),
    );
  });

  it('returns a non-zero exit code when a provider turn fails', async () => {
    const openaiService = {
      createSession: vi.fn(() => ({ id: 'session' })),
      streamReply: vi.fn(async function* () {
        if (process.env.NODE_ENV === 'unreachable-test-state') yield undefined;
        throw new Error('provider secret');
      }),
    };
    let output = '';
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    await expect(
      new CliService(openaiService as never).run(
        Readable.from(['Hello\n/exit\n']),
        writable,
      ),
    ).resolves.toBe(1);
    expect(output).not.toContain('provider secret');
  });
});
