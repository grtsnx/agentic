#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { replaceTscAliasPaths } = require('tsc-alias');

const configFile = fileURLToPath(
  new URL('../tsconfig.build.json', import.meta.url),
);

await replaceTscAliasPaths({ configFile });

const child = spawn(process.execPath, process.argv.slice(2), {
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
