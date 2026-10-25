import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../dist/app/index.js';
import { WorkspaceService } from '../../dist/modules/index.js';

if (process.env.RUN_WORKSPACE_SMOKE !== 'true') {
  throw new Error(
    'Set RUN_WORKSPACE_SMOKE=true; this check calls the provider.',
  );
}
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const service = app.get(WorkspaceService);
  const access = service.store.create();
  const scope = service.store.authorize(access.id, access.token);
  const file = await service.files.upload(scope, {
    originalname: 'fixture.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from('The fictional project identifier is PINE-742.'),
  });
  const response = await service.send(
    scope,
    'Read the uploaded fixture.txt to tell me its project identifier. Also create a pending approval for console.log(2+2). Do not execute it.',
  );
  assert.match(
    JSON.stringify({
      message: response.message,
      summary: response.summary,
      keyPoints: response.keyPoints,
    }),
    /PINE-742/,
  );
  assert.ok(
    response.runtime.tools.some((tool) => tool.name === 'retrieve_files'),
  );
  assert.equal(response.approvals.length, 1);
  assert.equal(response.approvals[0].status, 'pending');
  assert.equal(response.approvals[0].action.tool, 'execute_code');
  assert.ok(scope.files.has(file.id));
  assert.ok(
    !scope.audit.some(
      (event) => event.tool === 'execute_code' && event.status === 'succeeded',
    ),
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      pendingApprovals: response.approvals.length,
      tokens: response.runtime.tokens,
    }),
  );
} finally {
  await app.close();
}
