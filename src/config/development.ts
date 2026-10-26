import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './environment.js';

// Nest owns compilation and restarts this supervisor after a successful build.
// Children inherit the same .env loaded by Nest; they never compile into dist.
export async function runDevelopment(): Promise<number> {
  const { VOICE_ENABLED } = validateEnvironment(process.env);
  return new Promise((resolve) => {
    const children = new Map<ChildProcess, string>();
    let stopping = false;
    let exitCode = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const terminate = (child: ChildProcess, force = false) => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') {
          // Windows lacks POSIX process-group signals. Stop the owned tree,
          // including LiveKit job processes, rather than orphaning descendants.
          execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
            timeout: 3000,
          });
        } else {
          process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
        }
      } catch {
        // A sibling or the Nest watcher may already have stopped this tree.
      }
    };
    const finish = () => {
      if (children.size) return;
      clearTimeout(timer);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      resolve(exitCode);
    };
    const stop = (code: number) => {
      if (stopping) return;
      stopping = true;
      exitCode = code;
      for (const child of children.keys()) terminate(child);
      if (children.size) {
        timer = setTimeout(() => {
          for (const child of children.keys()) terminate(child, true);
        }, 5000);
      }
      finish();
    };
    const interrupt = () => stop(0);
    // Keep handlers installed until cleanup finishes: the terminal and Nest may
    // both forward Ctrl+C, and a second signal must not orphan the worker.
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);

    const start = (name: string, entry: string, args: string[] = []) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL('../' + entry, import.meta.url)), ...args],
        {
          stdio: 'inherit',
          shell: false,
          detached: process.platform !== 'win32',
        },
      );
      children.set(child, name);
      child.once('error', () => {
        console.error(`[Development] Could not start ${name}.`);
        stop(1);
      });
      child.once('close', (code, signal) => {
        // A crashed parent can leave job processes behind in its group.
        terminate(child, true);
        children.delete(child);
        if (!stopping) {
          console.error(
            `[Development] ${name} stopped (${signal ?? code ?? 'unknown'}). Stopping the other services.`,
          );
          stop(code && code > 0 ? code : 1);
        }
        finish();
      });
    };
    try {
      console.info(
        VOICE_ENABLED
          ? '[Development] Starting API and LiveKit voice worker. Ctrl+C stops both.'
          : '[Development] Starting API only (VOICE_ENABLED=false).',
      );
      start('API', 'main.js');
      if (VOICE_ENABLED)
        start('LiveKit voice worker', 'voice.js', [
          'dev',
          '--log-level',
          'info',
        ]);
    } catch {
      console.error('[Development] Could not start development services.');
      stop(1);
    }
  });
}
