import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { SandboxService } from '../../dist/lib/sandbox/sandbox.service.js';

if (process.env.RUN_SANDBOX_SMOKE !== 'true')
  throw new Error('Set RUN_SANDBOX_SMOKE=true.');
const sandbox = new SandboxService(
  new ConfigService({ SANDBOX_ENABLED: true }),
);
try {
  const result = await sandbox.execute(
    `
    import fs from 'node:fs';
    import net from 'node:net';
    let rootWritable=false;
    try {fs.writeFileSync('/escape.txt','x');rootWritable=true;} catch {}
    fs.writeFileSync('/tmp/test.txt','temporary');
    const network=await new Promise(resolve=>{const socket=net.connect({host:'1.1.1.1',port:80});socket.setTimeout(300);socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));socket.on('timeout',()=>{socket.destroy();resolve(false);});});
    console.log(JSON.stringify({rootWritable,network,uid:process.getuid(),secret:!!process.env.OPENAI_API_KEY,
      memory:fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),cpu:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim(),pids:fs.readFileSync('/sys/fs/cgroup/pids.max','utf8').trim()}));
  `,
    new AbortController().signal,
  );
  assert.equal(result.exitCode, 0, result.stderr);
  const limits = JSON.parse(result.stdout.trim());
  assert.deepEqual(limits, {
    rootWritable: false,
    network: false,
    uid: 65534,
    secret: false,
    memory: '134217728',
    cpu: '50000 100000',
    pids: '32',
  });
  console.log(
    'PASS: actual CPU, memory, PID, filesystem, network, and credential isolation',
  );
  const started = Date.now();
  const expired = await sandbox.execute(
    'setInterval(()=>{},1000)',
    new AbortController().signal,
  );
  assert.notEqual(expired.exitCode, 0);
  assert.ok(Date.now() - started < 12_000);
  console.log('PASS: independent in-container wall-clock limit');
  await assert.rejects(
    sandbox.execute(
      'console.log("x".repeat(100000))',
      new AbortController().signal,
    ),
  );
  console.log('PASS: output limit');
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 300);
  await assert.rejects(
    sandbox.execute('setInterval(()=>{},1000)', controller.signal),
  );
  console.log('PASS: cancellation and cleanup');
} finally {
  await sandbox.onModuleDestroy();
}
