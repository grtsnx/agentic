import { WorkspaceStore } from '../../../../../src/modules/v1/workspaces/workspace-store.service.js';

describe('workspace isolation and approvals', () => {
  const create = () => new WorkspaceStore();
  it('rejects another workspace capability and expires scopes', () => {
    const store = create();
    const a = store.create();
    const b = store.create();
    expect(() => store.authorize(a.id, b.token)).toThrow();
    expect(store.authorize(a.id, a.token).id).toBe(a.id);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_001);
    expect(() => store.authorize(a.id, a.token)).toThrow();
    vi.restoreAllMocks();
  });
  it('binds an approval to its original payload and consumes it once', () => {
    const store = create();
    const scope = store.authorize(...credentials(store));
    const action = { tool: 'execute_code' as const, code: 'console.log(1)' };
    const approval = store.propose(scope, action);
    action.code = 'console.log(2)';
    expect(store.consume(scope, approval.id, 'approve').action).toEqual({
      tool: 'execute_code',
      code: 'console.log(1)',
    });
    expect(() => store.consume(scope, approval.id, 'approve')).toThrow();
  });
  it('denies, cancels, and expires without authorizing execution', () => {
    const store = create();
    const scope = store.authorize(...credentials(store));
    for (const decision of ['deny', 'cancel'] as const) {
      const pending = store.propose(scope, { tool: 'execute_code', code: '1' });
      expect(store.consume(scope, pending.id, decision).status).toBe(
        decision === 'deny' ? 'denied' : 'cancelled',
      );
      expect(() => store.consume(scope, pending.id, 'approve')).toThrow();
    }
    const pending = store.propose(scope, { tool: 'execute_code', code: '2' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    expect(() => store.consume(scope, pending.id, 'approve')).toThrow();
    vi.restoreAllMocks();
  });
  it('aborts active work and erases files on deletion', () => {
    const store = create();
    const scope = store.authorize(...credentials(store));
    store.remove(scope);
    expect(scope.abort.signal.aborted).toBe(true);
    expect(() => store.authorize(scope.id, 'invalid')).toThrow();
  });
});
function credentials(store: WorkspaceStore): [string, string] {
  const created = store.create();
  return [created.id, created.token];
}
