import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentExtensionsService } from '@/config';
import { WorkspaceStore } from '../../../../src/modules/v1/workspaces/workspace-store.service.js';

describe('MCP application approval boundary', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'agentic-mcp-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  async function service() {
    const path = join(root, 'extensions.json');
    await writeFile(
      path,
      JSON.stringify({
        servers: [
          {
            id: 'fixture',
            description: 'Test',
            transport: 'stdio',
            command: process.execPath,
            args: [join(process.cwd(), 'test/fixtures/mcp/server.mjs')],
            allowedTools: ['lookup', 'write_note'],
            safeReadTools: ['lookup'],
          },
        ],
      }),
    );
    return AgentExtensionsService.fromEnvironment({
      AGENT_EXTENSIONS_ENABLED: true,
      AGENT_EXTENSIONS_FILE: path,
    });
  }
  it('proposes an immutable single-use approval and runs only after approval', async () => {
    const extensions = await service();
    const store = new WorkspaceStore();
    const issued = store.create(),
      scope = store.authorize(issued.id, issued.token);
    try {
      const [tool] = extensions.createTools({
        scopeId: scope.id,
        audit: (event) => store.append(scope, event),
        propose: (action) => store.propose(scope, action),
      });
      const result = await tool!.execute(
        {
          action: {
            kind: 'call_mcp_tool',
            server: 'fixture',
            name: 'write_note',
            argumentsJson: '{"text":"exact approved input"}',
          },
        },
        scope.abort.signal,
      );
      expect(result).toMatchObject({
        status: 'pending',
        target: 'MCP fixture: write_note',
      });
      const pending = store.approvals(scope)[0]!;
      const consumed = store.consume(scope, pending.id, 'approve');
      if (consumed.action.tool !== 'mcp_call_tool')
        throw new Error('Wrong action');
      const executed = await extensions.executeApproved(
        consumed.action,
        scope.abort.signal,
      );
      expect(executed.text).toContain('exact approved input');
      expect(() => store.consume(scope, pending.id, 'approve')).toThrow();
    } finally {
      store.onModuleDestroy();
    }
  });
  it('returns stable errors for asynchronous MCP failures', async () => {
    const extensions = await service();
    const [tool] = extensions.createTools();
    await expect(
      tool!.execute(
        {
          action: {
            kind: 'call_mcp_tool',
            server: 'fixture',
            name: 'lookup',
            argumentsJson: '{"text":"fail"}',
          },
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'EXTENSION_FAILED' },
    });
  });
  it('blocks writes without an approval channel, but allows configured safe reads', async () => {
    const extensions = await service();
    const signal = new AbortController().signal;
    const [tool] = extensions.createTools();
    const call = {
      kind: 'call_mcp_tool' as const,
      server: 'fixture',
      argumentsJson: '{"text":"hello"}',
    };
    await expect(
      tool!.execute({ action: { ...call, name: 'write_note' } }, signal),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'APPROVAL_REQUIRED' },
    });
    await expect(
      tool!.execute({ action: { ...call, name: 'lookup' } }, signal),
    ).resolves.toMatchObject({ contentTrust: 'untrusted' });
    expect(AgentExtensionsService.fromEnvironment({}).createTools()).toEqual(
      [],
    );
  });
});
