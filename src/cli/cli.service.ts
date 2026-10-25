import type { CliInput, CliOutput } from '@/config';
import { createInterface } from 'node:readline';
import { Injectable } from '@nestjs/common';
import { OpenaiService } from '@/lib';
import { type OpenaiRuntime } from '@/config';

@Injectable()
export class CliService {
  constructor(private readonly openaiService: OpenaiService) {}

  async run(input: CliInput, output: CliOutput): Promise<number> {
    const session = this.openaiService.createSession();
    const terminal = Boolean(input.isTTY && output.isTTY);
    const lines = createInterface({ input, output, terminal });
    const status = this.createStatusRenderer(output, terminal);
    let activeTurn: AbortController | undefined;
    let exitCode = 0;

    // Ctrl+C cancels the current model turn before it closes the CLI.
    lines.on('SIGINT', () => {
      status.clear();
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
      let responseStarted = false;
      let streamedOutput = false;

      try {
        for await (const event of this.openaiService.streamReply(message, {
          session,
          signal: activeTurn.signal,
        })) {
          if (event.type === 'status') {
            if (responseStarted) {
              output.write('\n');
              responseStarted = false;
            }
            status.show(event.message);
          } else if (event.type === 'delta') {
            status.clear();
            if (!responseStarted) output.write('Agent: ');
            output.write(event.delta);
            responseStarted = true;
            streamedOutput = true;
          } else {
            status.clear();
            if (!streamedOutput) {
              output.write(`Agent: ${event.response.message}`);
            }
            output.write(`\n${this.formatRuntime(event.response.runtime)}\n`);
          }
        }
      } catch {
        exitCode = 1;
        status.clear();
        output.write(
          activeTurn.signal.aborted
            ? '\nCancelled.\n'
            : '\nThe chat stream could not be completed.\n',
        );
      } finally {
        status.clear();
        activeTurn = undefined;
      }

      if (terminal) lines.prompt();
    }

    lines.close();
    return exitCode;
  }

  private createStatusRenderer(
    output: CliOutput,
    terminal: boolean,
  ): { show(message: string): void; clear(): void } {
    const frames = ['◐', '◓', '◑', '◒'];
    let frame = 0;
    let timer: NodeJS.Timeout | undefined;
    let visible = false;

    const clear = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (terminal && visible) output.write('\r\u001b[2K');
      visible = false;
    };

    return {
      show: (message: string) => {
        clear();
        if (!terminal) {
          output.write(`◌ ${message}…\n`);
          return;
        }

        const render = () => {
          output.write(
            `\r\u001b[2K${frames[frame % frames.length]} ${message}…`,
          );
          frame += 1;
        };
        visible = true;
        render();
        timer = setInterval(render, 90);
        timer.unref();
      },
      clear,
    };
  }

  private formatRuntime(runtime: OpenaiRuntime): string {
    const models = runtime.models
      .map(({ name, calls }) => `${name} (${calls})`)
      .join(', ');

    return [
      `Time: ${(runtime.durationMs / 1000).toFixed(2)}s`,
      `Tokens: ${runtime.tokens.input} in / ${runtime.tokens.output} out / ${runtime.tokens.total} total`,
      `Estimated cost: $${runtime.cost.estimatedUsd.toFixed(8)} USD`,
      `Models: ${models || 'none'}`,
    ].join('\n');
  }
}
