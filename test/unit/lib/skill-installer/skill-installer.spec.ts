import { writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { AgentExtensionsService } from '@/config';
import { McpService } from '../../../../src/lib/mcp/mcp.service.js';
import { SkillsService } from '../../../../src/config/agent/skills/skills.service.js';
import { WorkspaceStore } from '../../../../src/modules/v1/workspaces/workspace-store.service.js';
import { mkdtemp, readFile, rm, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SkillInstallerService } from '../../../../src/lib/skill-installer/skill-installer.service.js';

const sha = 'a'.repeat(40);
const skill =
  '---\nname: example\ndescription: Review an example.\n---\nBe helpful.\n';
describe('approved skill installation', () => {
  let root: string;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'skill-install-')));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(root, { recursive: true, force: true });
  });
  function fixture() {
    return vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/commits/')) return Response.json({ sha });
        if (url.includes('/git/trees/'))
          return Response.json({
            truncated: false,
            tree: [
              {
                path: 'skills/example/SKILL.md',
                type: 'blob',
                mode: '100644',
                size: skill.length,
              },
              {
                path: 'skills/example/run.sh',
                type: 'blob',
                mode: '100755',
                size: 20,
              },
            ],
          });
        if (url.endsWith('/SKILL.md')) return new Response(skill);
        throw new Error('Unexpected fetch');
      }),
    );
  }
  it('pins a skills.sh link, writes nothing during proposal, and atomically installs documentation only', async () => {
    fixture();
    const service = new SkillInstallerService(root),
      signal = new AbortController().signal;
    const action = await service.prepare(
      'https://skills.sh/owner/repo/example',
      null,
      signal,
    );
    expect(action).toMatchObject({
      name: 'example',
      repository: 'owner/repo',
      commit: sha,
      omittedFiles: 1,
    });
    expect(await readdir(root)).toEqual([]);
    expect(await service.install(action, signal)).toMatchObject({
      status: 'installed',
      name: 'example',
    });
    expect(await service.installedPaths()).toEqual([join(root, 'example')]);
    expect(await readFile(join(root, 'example', 'SKILL.md'), 'utf8')).toBe(
      skill,
    );
    expect(await readdir(join(root, 'example'))).not.toContain('run.sh');
    await expect(service.install(action, signal)).rejects.toThrow(
      'ALREADY_INSTALLED',
    );
  });
  it('proposes before writing and discovers the approved skill without restarting', async () => {
    fixture();
    const manifest = join(root, 'extensions.json');
    await writeFile(manifest, JSON.stringify({ servers: [], skills: [] }));
    const installer = new SkillInstallerService(join(root, 'installed'));
    const extensions = new AgentExtensionsService(
      new ConfigService({
        AGENT_EXTENSIONS_ENABLED: true,
        AGENT_SKILL_INSTALL_ENABLED: true,
        NODE_ENV: 'test',
        AGENT_EXTENSIONS_FILE: manifest,
      }),
      new McpService(),
      new SkillsService(),
      installer,
    );
    const store = new WorkspaceStore(),
      issued = store.create(),
      scope = store.authorize(issued.id, issued.token);
    try {
      const [tool] = extensions.createTools({
        propose: (action) => store.propose(scope, action),
      });
      await tool!.execute(
        {
          action: {
            kind: 'install_skill',
            source: 'https://skills.sh/owner/repo/example',
            skill: null,
          },
        },
        scope.abort.signal,
      );
      expect(await installer.installedPaths()).toEqual([]);
      const pending = store.approvals(scope)[0]!;
      expect(pending.status).toBe('pending');
      const approved = store.consume(scope, pending.id, 'approve');
      if (approved.action.tool !== 'install_skill')
        throw new Error('Wrong action');
      await extensions.installApproved(approved.action, scope.abort.signal);
      await expect(
        tool!.execute({ action: { kind: 'list_skills' } }, scope.abort.signal),
      ).resolves.toMatchObject({ skills: [{ name: 'example' }] });
      await expect(
        tool!.execute(
          { action: { kind: 'read_skill', name: 'example', file: 'SKILL.md' } },
          scope.abort.signal,
        ),
      ).resolves.toMatchObject({ text: skill });
    } finally {
      store.onModuleDestroy();
    }
  });
  it('rejects changed content and cancellation without registering a partial skill', async () => {
    fixture();
    const service = new SkillInstallerService(root),
      signal = new AbortController().signal;
    const action = await service.prepare(
      'https://github.com/owner/repo/tree/main/skills/example',
      null,
      signal,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(skill + 'changed')),
    );
    await expect(service.install(action, signal)).rejects.toThrow('CHANGED');
    expect(await service.installedPaths()).toEqual([]);
    await expect(
      service.install(action, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(await service.installedPaths()).toEqual([]);
  });
  it('matches frontmatter names that differ from their GitHub directory', async () => {
    fixture();
    const service = new SkillInstallerService(root);
    const original = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const response = await original(url);
        return url.endsWith('/SKILL.md')
          ? new Response(
              skill.replace('name: example', 'name: branded-example'),
            )
          : response;
      }),
    );
    const action = await service.prepare(
      'https://skills.sh/owner/repo/branded-example',
      null,
      new AbortController().signal,
    );
    expect(action.name).toBe('branded-example');
  });
  it('serializes concurrent installs and never overwrites a completed skill', async () => {
    fixture();
    const service = new SkillInstallerService(root),
      signal = new AbortController().signal;
    const action = await service.prepare(
      'https://skills.sh/owner/repo/example',
      null,
      signal,
    );
    const results = await Promise.allSettled([
      service.install(action, signal),
      service.install(action, signal),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await service.installedPaths()).toHaveLength(1);
  });
  it('rejects untrusted hosts, ambiguous repositories, and symlink content', async () => {
    fixture();
    const service = new SkillInstallerService(root),
      signal = new AbortController().signal;
    await expect(
      service.prepare(
        'https://skills.sh.evil.test/owner/repo/example',
        null,
        signal,
      ),
    ).rejects.toThrow();
    await expect(
      service.prepare(
        'https://github.com/owner/repo/tree/main/../../secret',
        null,
        signal,
      ),
    ).rejects.toThrow();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/commits/')
          ? Response.json({ sha })
          : Response.json({
              truncated: false,
              tree: [
                {
                  path: 'skills/example/SKILL.md',
                  mode: '120000',
                  type: 'blob',
                  size: 10,
                },
              ],
            }),
      ),
    );
    await expect(
      service.prepare('https://skills.sh/owner/repo/example', null, signal),
    ).rejects.toThrow();
  });
});
