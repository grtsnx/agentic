import { FILE_MIME_TYPES } from '@/config';
import { constants } from 'node:fs';
import { WorkspaceService } from '@/modules';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { CliInput, CliOutput, WorkspaceScope } from '@/config';
import { createInterface } from 'node:readline';
import { Injectable, Optional } from '@nestjs/common';
import { OpenaiService } from '@/lib';
import { type OpenaiRuntime } from '@/config';

@Injectable()
export class CliService {
  constructor(
    private readonly openaiService: OpenaiService,
    @Optional() private readonly workspaces?: WorkspaceService,
  ) {}

  async run(input: CliInput, output: CliOutput): Promise<number> {
    const session = this.openaiService.createSession();
    const terminal = Boolean(input.isTTY && output.isTTY);
    const lines = createInterface({ input, output, terminal });
    const status = this.createStatusRenderer(output, terminal);
    let activeTurn: AbortController | undefined;
    let exitCode = 0;
    let workspace: WorkspaceScope | undefined;

    // Ctrl+C cancels the current model turn before it closes the CLI.
    lines.on('SIGINT', () => {
      status.clear();
      if (workspace?.active) {
        this.workspaces?.cancel(workspace);
      } else if (activeTurn) {
        activeTurn.abort();
      } else {
        lines.close();
      }
    });

    output.write('Agentic CLI: type /exit to quit.\n');
    if (this.workspaces)
      output.write(
        'Use /workspace for files and actions, /attach PATH, /actions, /approve ID, /deny ID, /cancel ID.\n',
      );
    if (terminal) {
      lines.setPrompt('You: ');
      lines.prompt();
    }

    try {
      for await (const value of lines) {
        const message = value.trim();
        if (message === '/exit') break;
        if (!message) {
          if (terminal) lines.prompt();
          continue;
        }

        if (
          this.workspaces &&
          /^\/(workspace|attach|actions|approve|deny|cancel)(?:\s|$)/.test(
            message,
          )
        ) {
          try {
            if (!workspace) {
              const created = this.workspaces.store.create();
              workspace = this.workspaces.store.authorize(
                created.id,
                created.token,
              );
            }
            await this.workspaceCommand(workspace, message, output);
          } catch {
            exitCode = 1;
            output.write(
              'Workspace command failed. Check the file, approval ID, or workspace expiry.\n',
            );
          }
          if (terminal) lines.prompt();
          continue;
        }
        activeTurn = new AbortController();
        let responseStarted = false;
        let streamedOutput = false;

        try {
          for await (const event of workspace && this.workspaces
            ? this.workspaces.stream(workspace, message, activeTurn.signal)
            : this.openaiService.streamReply(message, {
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
          if (workspace) this.showApprovals(workspace, output);
        }

        if (terminal) lines.prompt();
      }
    } finally {
      lines.close();
      if (workspace) this.workspaces?.store.remove(workspace);
    }
    return exitCode;
  }

  private async workspaceCommand(
    scope: WorkspaceScope,
    message: string,
    output: CliOutput,
  ) {
    const service = this.workspaces!;
    const [command, ...parts] = message.split(' ');
    const argument = parts.join(' ').trim();
    if (command === '/attach') {
      const file = await open(
        argument,
        constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
      );
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > 1_048_576)
          throw new Error('Invalid file');
        const buffer = Buffer.alloc(1_048_577);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        const uploaded = await service.files.upload(scope, {
          originalname: basename(argument),
          mimetype:
            FILE_MIME_TYPES[extname(argument).slice(1).toLowerCase()] ?? '',
          buffer: buffer.subarray(0, bytesRead),
        });
        output.write(`Attached ${uploaded.filename}\n`);
      } finally {
        await file.close();
      }
    } else if (
      command === '/approve' ||
      command === '/deny' ||
      command === '/cancel'
    ) {
      const decision = command.slice(1) as 'approve' | 'deny' | 'cancel';
      const result = await service.decide(scope, argument, decision);
      output.write(JSON.stringify(result, null, 2) + '\n');
    } else output.write('Workspace active. Files expire with this session.\n');
    this.showApprovals(scope, output);
  }
  private showApprovals(scope: WorkspaceScope, output: CliOutput) {
    for (const action of this.workspaces!.store.approvals(scope).filter(
      (item) => item.status === 'pending',
    ))
      output.write(
        `Approval ${action.id}\nTarget: ${action.target}\nScope: this CLI workspace\nRisk: ${action.risk}\nExpires: ${new Date(action.expiresAt).toISOString()}\n${JSON.stringify(action.action, null, 2)}\nUse /approve, /deny, or /cancel followed by this ID.\n`,
      );
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
