import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';

if (process.env.RUN_LIVEKIT_WORKER_SMOKE !== 'true') {
  throw new Error(
    'Set RUN_LIVEKIT_WORKER_SMOKE=true to register a temporary Cloud worker.',
  );
}

// A unique dispatch name and deployment prevent this check from accepting real jobs.
const identity = `agentic-worker-smoke-${process.pid}`;
const child = spawn(process.execPath, ['dist/voice.js', 'local'], {
  shell: false,
  detached: process.platform !== 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LIVEKIT_AGENT_NAME: identity,
    LIVEKIT_AGENT_NAME_OVERRIDE: identity,
    LIVEKIT_AGENT_DEPLOYMENT: identity,
  },
});
let output = '',
  stopping = false,
  forced = false;
const killTree = () => {
  forced = true;
  if (!child.pid) return;
  try {
    if (process.platform === 'win32')
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 3000,
      });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    /* The worker may already have exited. */
  }
};
const deadline = setTimeout(killTree, 30000);
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-64000);
    if (!stopping && output.includes('[Voice] Connected to LiveKit.')) {
      stopping = true;
      child.kill('SIGTERM');
    }
  });
}
try {
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  assert.equal(forced, false, 'Worker exceeded its deadline');
  assert.equal(code, 0, 'Worker did not stop cleanly');
  assert.ok(stopping, 'Worker did not register');
  assert.doesNotMatch(
    output,
    /dev mode is deprecated|\{"level":|server_info|agentNameIsEnv|registered worker/,
  );
  console.log(
    'PASS: Cloud registration, concise status without SDK metadata, no deprecation warning, and clean shutdown. No room or microphone opened.',
  );
} finally {
  clearTimeout(deadline);
  if (child.exitCode === null && child.signalCode === null) killTree();
}
