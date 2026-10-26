// Run after `bun run build`. Uses an isolated browser, no provider or installation.
// Set PLAYWRIGHT_CHROME_PATH when using an existing Chrome installation.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  WORKSPACE_APP,
  WORKSPACE_STYLES,
} from '../../dist/config/playground/workspace.asset.js';
import { CHATKIT_APP } from '../../dist/config/playground/chatkit.asset.js';
import { ChatkitAdapterService } from '../../dist/lib/chatkit/chatkit.service.js';

const adapter = new ChatkitAdapterService();
const approval = {
  id: 'approval',
  status: 'pending',
  expiresAt: Date.now() + 300000,
  target: 'Install web-design-guidelines',
  risk: 'Adds third-party instructions. Only documents are installed.',
  action: {
    tool: 'install_skill',
    name: 'web-design-guidelines',
    description: 'Review interface accessibility and design.',
    repository: 'vercel-labs/agent-skills',
    commit: 'a'.repeat(40),
    directory: 'skills/web-design-guidelines',
    files: [{ path: 'SKILL.md', bytes: 240, sha256: 'b'.repeat(64) }],
    omittedFiles: 1,
    preview:
      '# Guidelines\n\n<img src=x onerror="window.compromised=true">\nReview the UI.',
  },
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || undefined,
});
try {
  const page = await browser.newPage();
  await page.setContent(
    `<style>:root{--border:#ddd;--surface:#fff;--surface-subtle:#fafafa;--text:#171717;--muted:#666}body{margin:0;font-family:Arial}${WORKSPACE_STYLES}</style><main id="messages"></main>`,
  );
  await page.addScriptTag({
    content: WORKSPACE_APP.slice(
      0,
      WORKSPACE_APP.indexOf('function createWorkspacePanel'),
    ),
  });
  await page.addScriptTag({
    content:
      'let active=false;const chatTransport={busy:false,action:async()=>{window.decisions=(window.decisions||0)+1}};' +
      CHATKIT_APP.replace('queueMicrotask(setupChatkitHistory);', ''),
  });
  await page.evaluate(
    (item) => renderChatkitWidget(item),
    adapter.approval('thread', approval, 'card'),
  );
  assert.equal(await page.locator('details').getAttribute('open'), null);
  assert.equal(
    await page.locator('.approval-source').getAttribute('href'),
    `https://github.com/${approval.action.repository}/tree/${approval.action.commit}/${approval.action.directory}`,
  );
  await page.getByText('Review instructions and files (1)').click();
  assert.equal(await page.locator('pre').innerText(), approval.action.preview);
  assert.equal(await page.locator('img').count(), 0);
  assert.equal(await page.evaluate(() => window.compromised), undefined);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.getByRole('button', { name: 'Approve once' }).click();
  assert.equal(await page.evaluate(() => window.decisions), 1);
  assert.equal(
    await page.getByRole('button', { name: 'Approve once' }).isDisabled(),
    true,
  );
  await page.evaluate(
    (item) => renderChatkitWidget(item),
    adapter.approval(
      'thread',
      { ...approval, expiresAt: Date.now() - 1 },
      'card',
    ),
  );
  assert.equal(
    await page.getByRole('button', { name: 'Approve once' }).isDisabled(),
    true,
  );
  assert.match(await page.locator('[role=status]').innerText(), /expired/);
  await page.evaluate(
    (item) => renderChatkitWidget(item),
    adapter.approval(
      'thread',
      { ...approval, status: 'denied' },
      'card',
      'Denied. Nothing was installed.',
    ),
  );
  assert.equal(await page.getByRole('button').count(), 0);
  assert.match(
    await page.locator('.approval-card').innerText(),
    /Nothing was installed/,
  );
  console.log(
    'Approval UI passed: collapsed preview, inert content, source link, mobile/desktop layout, single submission, expiry and denial.',
  );
} finally {
  await browser.close();
}
