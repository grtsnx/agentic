import { Readable, Writable } from 'node:stream';
import { CliService } from '@/cli/cli.service.js';

describe('CliService', () => {
  it('streams a reply and prints runtime usage', async () => {
    const openaiService = {
      createSession: vi.fn(() => ({ id: 'session' })),
      streamReply: vi.fn(async function* () {
        yield { type: 'delta', delta: 'Hello' } as const;
        yield {
          type: 'completed',
          response: {
            message: 'Hello',
            runtime: {
              tokens: { input: 10, output: 2, total: 12 },
              cost: { estimatedUsd: 0.0002 },
              models: [{ name: 'gpt-6-astra', calls: 1 }],
              tools: [],
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

    await new CliService(openaiService as never).run(input, writable);

    expect(output).toContain('Hello');
    expect(output).toContain('Tokens: 10 in / 2 out / 12 total');
    expect(output).toContain('Estimated cost: $0.00020000 USD');
    expect(output).toContain('Models: gpt-6-astra (1)');
    expect(openaiService.streamReply).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ session: { id: 'session' } }),
    );
  });
});
