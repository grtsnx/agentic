import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SkillsService } from '../../../../src/config/agent/skills/skills.service.js';
import { extensionsConfigSchema } from '@/config';

describe('developer-managed skills and MCP configuration', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'agentic-skills-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  it('discovers standard YAML front matter and loads relative references', async () => {
    const skill = join(root, 'review');
    await mkdir(skill);
    await writeFile(
      join(skill, 'SKILL.md'),
      '---\nname: review\ndescription: >\n  Review code carefully.\n---\nCheck for bugs.',
    );
    await writeFile(join(skill, 'notes.md'), 'Check cancellation.');
    const service = new SkillsService();
    expect(await service.list([skill])).toEqual([
      { name: 'review', description: 'Review code carefully.\n' },
    ]);
    expect(await service.read([skill], 'review', 'notes.md')).toContain(
      'Check cancellation.',
    );
  });
  it('rejects traversal, hidden files, scripts and symlink escapes', async () => {
    const skill = join(root, 'review');
    await mkdir(skill);
    await writeFile(
      join(skill, 'SKILL.md'),
      '---\nname: review\ndescription: Review\n---\nCheck.',
    );
    await writeFile(join(root, 'secret.md'), 'private');
    await symlink(join(root, 'secret.md'), join(skill, 'escape.md'));
    const service = new SkillsService();
    for (const path of ['../secret.md', '.env', 'run.sh', 'escape.md'])
      await expect(service.read([skill], 'review', path)).rejects.toThrow();
  });
  it('rejects unsafe URLs and safe-read grants outside the allowlist', () => {
    const base = {
      id: 'docs',
      description: 'Docs',
      transport: 'http',
      allowedTools: ['search'],
    };
    for (const url of [
      'file:///etc/passwd',
      'http://remote.example/mcp',
      'https://user:secret@example.com/mcp',
    ])
      expect(
        extensionsConfigSchema.safeParse({ servers: [{ ...base, url }] })
          .success,
      ).toBe(false);
    expect(
      extensionsConfigSchema.safeParse({
        servers: [
          { ...base, url: 'https://example.com/mcp', safeReadTools: ['send'] },
        ],
      }).success,
    ).toBe(false);
  });
});
