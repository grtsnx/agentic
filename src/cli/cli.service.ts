import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { OpenaiService, type OpenaiRuntime } from '@/lib';

type CliInput = Readable & { isTTY?: boolean };
type CliOutput = Writable & { isTTY?: boolean };

@Injectable()
export class CliService {
  constructor(private readonly openaiService: OpenaiService) {}

  async run(input: CliInput, output: CliOutput): Promise<void> {
    const session = this.openaiService.createSession();
    const terminal = Boolean(input.isTTY && output.isTTY);
    const lines = createInterface({ input, output, terminal });
    let activeTurn: AbortController | undefined;

    // Ctrl+C cancels the current model turn before it closes the CLI.
    lines.on('SIGINT', () => {
      if (activeTurn) {
        activeTurn.abort();
      } else {
        lines.close();
      }
    });

    output.write('Agentic CLI — type /exit to quit.\n');
    if (terminal) {
      lines.setPrompt('You: ');
      lines.prompt();
    }

    for await (const value of lines) {
      const message = value.trim();
      if (message === '/exit') break;
      if (!message) {
        if (terminal) lines.prompt();
        continue;
      }

      activeTurn = new AbortController();
      output.write(terminal ? 'Agent: ' : '');

      try {
        for await (const event of this.openaiService.streamReply(message, {
          session,
          signal: activeTurn.signal,
        })) {
          if (event.type === 'delta') {
            output.write(event.delta);
          } else {
            output.write(`\n${this.formatRuntime(event.response.runtime)}\n`);
          }
        }
      } catch {
        output.write(
          activeTurn.signal.aborted
            ? '\nCancelled.\n'
            : '\nThe chat stream could not be completed.\n',
        );
      } finally {
        activeTurn = undefined;
      }

      if (terminal) lines.prompt();
    }

    lines.close();
  }

  private formatRuntime(runtime: OpenaiRuntime): string {
    const models = runtime.models
      .map(({ name, calls }) => `${name} (${calls})`)
      .join(', ');
    const tools = runtime.tools
      .map(({ name, calls }) => `${name} (${calls})`)
      .join(', ');

    return [
      `Tokens: ${runtime.tokens.input} in / ${runtime.tokens.output} out / ${runtime.tokens.total} total`,
      `Estimated cost: $${runtime.cost.estimatedUsd.toFixed(8)} USD`,
      `Models: ${models || 'none'}`,
      `Tools: ${tools || 'none'}`,
    ].join('\n');
  }
}
