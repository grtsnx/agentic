import { resolve } from 'node:path';
import { McpService } from '../../../../src/lib/mcp/mcp.service.js';
import { mcpServerConfigSchema } from '@/config';

describe('MCP stdio integration', () => {
  const config = mcpServerConfigSchema.parse({
    id: 'fixture',
    description: 'Test',
    transport: 'stdio',
    command: process.execPath,
    args: [resolve('test/fixtures/mcp/server.mjs')],
    allowedTools: ['lookup', 'write_note'],
    safeReadTools: ['lookup'],
    timeoutMs: 1500,
  });
  afterEach(() => vi.unstubAllEnvs());
  it('discovers allowed schemas and calls a real MCP fixture without inheriting secrets', async () => {
    vi.stubEnv('AGENTIC_TEST_SECRET', 'never-pass-this');
    const service = new McpService();
    const signal = new AbortController().signal;
    const list = await service.list(config, signal);
    expect(list.map((item) => [item.name, item.approvalRequired])).toEqual([
      ['lookup', false],
      ['write_note', true],
    ]);
    const action = await service.prepare(
      config,
      'lookup',
      '{"text":"hello"}',
      signal,
    );
    const result = await service.execute(config, action, signal);
    expect(result.text).toContain('hello');
    expect(result.text).toContain('unrelatedSecretVisible\\\":false');
  });
  it('rejects unlisted tools and an altered approval binding', async () => {
    const service = new McpService();
    const signal = new AbortController().signal;
    await expect(
      service.prepare(config, 'delete_everything', '{}', signal),
    ).rejects.toThrow('NOT_ALLOWED');
    const action = await service.prepare(
      config,
      'write_note',
      '{"text":"note"}',
      signal,
    );
    await expect(
      service.execute(
        { ...config, description: 'Changed destination contract' },
        action,
        signal,
      ),
    ).rejects.toThrow('CHANGED');
  });
  it('cancels an in-flight tool without replay', async () => {
    const service = new McpService();
    const controller = new AbortController();
    const action = await service.prepare(
      config,
      'lookup',
      '{"text":"hang"}',
      controller.signal,
    );
    const pending = service.execute(config, action, controller.signal);
    const timer = setTimeout(() => controller.abort(), 100);
    try {
      await expect(pending).rejects.toThrow();
    } finally {
      clearTimeout(timer);
    }
  });
});
