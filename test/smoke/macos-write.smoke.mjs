// Requires a disposable TextEdit document containing only the sentinel below.
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { MacosService } from '../../dist/lib/macos/macos.service.js';
import { BrowserService } from '../../dist/lib/browser/browser.service.js';
import { ComputerService } from '../../dist/modules/v1/computer/computer.service.js';
import { WorkspaceStore } from '../../dist/modules/v1/workspaces/workspace-store.service.js';
if (process.env.RUN_MACOS_WRITE_SMOKE !== 'true')
  throw new Error(
    'Set RUN_MACOS_WRITE_SMOKE=true only with a disposable TextEdit scratch document.',
  );
const sentinel = 'Agentic integration test scratch 7219',
  replacement = 'Agentic approved local action verified 7219';
const config = new ConfigService({
  COMPUTER_ENABLED: true,
  COMPUTER_ALLOWED_APPS: ['com.apple.TextEdit'],
});
const mac = new MacosService(config),
  computer = new ComputerService(config, new BrowserService(config), mac),
  store = new WorkspaceStore();
const created = store.create(),
  scope = store.authorize(created.id, created.token);
try {
  await computer.connect(scope, 'desktop');
  const state = await computer.observe(
    scope.id,
    'com.apple.TextEdit',
    scope.abort.signal,
  );
  assert.match(state.text, /Untitled/);
  assert.ok(state.text.includes(sentinel));
  const line = state.text
    .split('\n')
    .find(
      (line) => line.includes('text entry area') && line.includes(sentinel),
    );
  assert.ok(line, 'Expected the test sentinel in an editable TextEdit area');
  const index = Number(line.trim().match(/^\d+/)?.[0]);
  assert.ok(Number.isInteger(index));
  const pending = store.propose(
    scope,
    computer.proposal(scope.id, {
      observationId: state.observationId,
      kind: 'type',
      index,
      value: replacement,
    }),
  );
  const approved = store.consume(scope, pending.id, 'approve');
  await computer.execute(scope.id, approved.action, scope.abort.signal);
  const updated = await computer.observe(
    scope.id,
    'com.apple.TextEdit',
    scope.abort.signal,
  );
  assert.ok(updated.text.includes(replacement));
  console.log(
    'PASS: approved native TextEdit write verified in the disposable scratch document. No app contents sent to a model.',
  );
} finally {
  store.onModuleDestroy();
  await computer.onModuleDestroy();
}
