import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillInstallerService } from '../../dist/lib/skill-installer/skill-installer.service.js';

// Public skill import into an isolated temporary directory, not the app's live skills.
const root = await realpath(
  await mkdtemp(join(tmpdir(), 'agentic-skill-smoke-')),
);
try {
  const service = new SkillInstallerService(root),
    signal = AbortSignal.timeout(60000);
  const proposal = await service.prepare(
    'https://skills.sh/vercel-labs/agent-skills/web-design-guidelines',
    null,
    signal,
  );
  assert.match(proposal.commit, /^[a-f0-9]{40}$/);
  assert.equal(proposal.name, 'web-design-guidelines');
  assert.deepEqual(await service.installedPaths(), []);
  const github = await service.prepare(
    `https://github.com/${proposal.repository}/tree/${proposal.commit}/${proposal.directory}`,
    null,
    signal,
  );
  assert.deepEqual(github.files, proposal.files);
  const installed = await service.install(proposal, signal);
  assert.equal(installed.status, 'installed');
  assert(
    (await readFile(join(root, proposal.name, 'SKILL.md'), 'utf8')).includes(
      'Web Interface Guidelines',
    ),
  );
  console.log(
    JSON.stringify({
      status: 'PASS',
      sources: ['skills.sh', 'github'],
      commit: proposal.commit,
      files: proposal.files.length,
      installedInTemporaryDirectory: true,
    }),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
