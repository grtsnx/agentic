import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function runLiveKitConsole(args: string[]): number {
  const worker =
    args.includes('--help') || args.includes('-h')
      ? []
      : [fileURLToPath(new URL('../../voice.js', import.meta.url))];
  // Use the native executable without a shell so device names stay literal on every OS.
  const result = spawnSync(
    process.platform === 'win32' ? 'lk.exe' : 'lk',
    ['agent', 'console', ...worker, ...args],
    { stdio: 'inherit', shell: false },
  );
  if (result.error) {
    const missing = 'code' in result.error && result.error.code === 'ENOENT';
    console.error(
      missing
        ? 'Install the LiveKit CLI and ensure lk is on PATH: https://docs.livekit.io/reference/developer-tools/livekit-cli/'
        : 'Unable to start the LiveKit console. Check executable permissions and audio device access.',
    );
    return missing ? 127 : 1;
  }
  return result.status ?? 1;
}

// This file is also the command entrypoint; importing it in tests must not open a microphone.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runLiveKitConsole(process.argv.slice(2));
}
