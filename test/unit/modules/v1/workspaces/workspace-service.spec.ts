import type { ComputerService } from '../../../../../src/modules/v1/computer/computer.service.js';
import { WorkspaceService } from '../../../../../src/modules/v1/workspaces/workspace.service.js';
import { WorkspaceStore } from '../../../../../src/modules/v1/workspaces/workspace-store.service.js';
import { WorkspaceFilesService } from '../../../../../src/modules/v1/workspaces/workspace-files.service.js';
import type { OpenaiService, SandboxService, DelegationService } from '@/lib';
import { WebToolsService, AgentExtensionsService } from '@/config';

describe('workspace decisions after turn limits', () => {
  it('allows approval of the final turn action without replay', async () => {
    const store = new WorkspaceStore();
    const created = store.create();
    const scope = store.authorize(created.id, created.token);
    scope.turns = 50;
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    }));
    const service = new WorkspaceService(
      store,
      new WorkspaceFilesService(),
      {} as OpenaiService,
      { execute } as unknown as SandboxService,
      {} as DelegationService,
      WebToolsService.fromEnvironment({}),
      { status: () => ({ connected: false }) } as unknown as ComputerService,
      AgentExtensionsService.fromEnvironment({}),
    );
    try {
      const pending = store.propose(scope, {
        tool: 'execute_code',
        code: 'console.log(1)',
      });
      await expect(
        service.decide(scope, pending.id, 'approve'),
      ).resolves.toMatchObject({ status: 'executed' });
      await expect(
        service.decide(scope, pending.id, 'approve'),
      ).rejects.toThrow();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(scope.active).toBeUndefined();
    } finally {
      store.onModuleDestroy();
    }
  });
});

describe('authoritative approval responses', () => {
  const notice = 'Review the pending action to approve or deny it.';
  const response = {
    message: 'I prepared a card. Would you like me to open it?',
    status: 'completed',
    summary: 'Long explanation',
    keyPoints: ['Details'],
    suggestedActions: ['Approve in chat'],
    followUpQuestions: ['Proceed?'],
    sources: [],
    runtime: { tokens: { input: 20, output: 10, total: 30 } },
  };
  let store: WorkspaceStore;
  beforeEach(() => {
    store = new WorkspaceStore();
  });
  afterEach(() => store.onModuleDestroy());

  function setup(createApproval: boolean) {
    const created = store.create();
    const scope = store.authorize(created.id, created.token);
    const propose = (options: { traceId: string }) => {
      if (createApproval)
        store.propose(
          scope,
          { tool: 'execute_code', code: 'console.log(1)' },
          options.traceId,
        );
    };
    const openai = {
      generateReply: async (_message: string, options: { traceId: string }) => {
        propose(options);
        return response;
      },
      streamReply: async function* (
        _message: string,
        options: { traceId: string },
      ) {
        propose(options);
        yield { type: 'delta', delta: response.message };
        yield { type: 'completed', response };
      },
    };
    const service = new WorkspaceService(
      store,
      new WorkspaceFilesService(),
      openai as unknown as OpenaiService,
      {} as SandboxService,
      {} as DelegationService,
      WebToolsService.fromEnvironment({}),
      { status: () => ({ connected: false }) } as unknown as ComputerService,
      AgentExtensionsService.fromEnvironment({}),
    );
    return { service, scope };
  }

  it('replaces model approval narration and preserves actual usage', async () => {
    const { service, scope } = setup(true);
    const result = await service.send(scope, 'Run code');
    expect(result).toMatchObject({
      message: notice,
      status: 'needs_input',
      followUpQuestions: [],
      runtime: response.runtime,
    });
    expect(result.approvals).toHaveLength(1);
    expect(result.approvals[0].status).toBe('pending');
  });

  it('streams a single notice instead of invented approval instructions', async () => {
    const { service, scope } = setup(true);
    const events = [];
    for await (const event of service.stream(
      scope,
      'Run code',
      new AbortController().signal,
    ))
      events.push(event);
    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', delta: notice },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      response: { message: notice, runtime: response.runtime },
    });
    expect(scope.active).toBeUndefined();
  });

  it('does not suppress unrelated replies when an older approval is pending', async () => {
    const { service, scope } = setup(false);
    store.propose(
      scope,
      { tool: 'execute_code', code: 'console.log(0)' },
      'older-turn',
    );
    expect((await service.send(scope, 'Explain something')).message).toBe(
      response.message,
    );
    const events = [];
    for await (const event of service.stream(
      scope,
      'Explain something else',
      new AbortController().signal,
    ))
      events.push(event);
    expect(events[0]).toEqual({ type: 'delta', delta: response.message });
  });
});
