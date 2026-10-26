import type { ComputerService } from '../../../../../src/modules/v1/computer/computer.service.js';
import { WorkspaceService } from '../../../../../src/modules/v1/workspaces/workspace.service.js';
import { WorkspaceStore } from '../../../../../src/modules/v1/workspaces/workspace-store.service.js';
import { WorkspaceFilesService } from '../../../../../src/modules/v1/workspaces/workspace-files.service.js';
import type { OpenaiService, SandboxService, DelegationService } from '@/lib';
import { WebToolsService } from '@/config';

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
      {} as ComputerService,
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
