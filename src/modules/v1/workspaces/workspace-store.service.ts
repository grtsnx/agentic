import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { MemorySession } from '@openai/agents';
import { workspaceActionSchema, permissionFor, auditSnapshot, type WorkspaceAction, type WorkspaceScope, type ToolAudit, type ActionApproval } from '@/config';

@Injectable()
export class WorkspaceStore implements OnModuleDestroy {
  private readonly scopes = new Map<string, WorkspaceScope>();
  private readonly sweep = setInterval(() => this.expire(), 30_000).unref();

  create() {
    this.expire();
    if (this.scopes.size >= 32) throw new ServiceUnavailableException('Workspace capacity reached.');
    const token = randomBytes(32).toString('base64url');
    const scope: WorkspaceScope = {
      id: randomUUID(), tokenHash: this.hash(token), expiresAt: Date.now() + 1_800_000,
      abort: new AbortController(), files: new Map(), approvals: new Map(), audit: [],
      session: new MemorySession(), turns: 0,
    };
    this.scopes.set(scope.id, scope);
    return {id: scope.id, token, expiresAt: new Date(scope.expiresAt).toISOString()};
  }

  authorize(id: string, token: string): WorkspaceScope {
    this.expire();
    const scope = this.scopes.get(id);
    if (!scope || !token || !timingSafeEqual(scope.tokenHash, this.hash(token)))
      throw new UnauthorizedException('Workspace access denied or expired.');
    return scope;
  }

  propose(scope: WorkspaceScope, input: WorkspaceAction, traceId: string = randomUUID()): ActionApproval {
    scope.abort.signal.throwIfAborted();
    const action = workspaceActionSchema.parse(input);
    const digest = this.hash(JSON.stringify(action)).toString('hex');
    this.expireApprovals(scope);
    const pending = [...scope.approvals.values()].find(x => x.digest === digest && x.status === 'pending');
    if (pending) return structuredClone(pending);
    if (scope.approvals.size >= 100) throw new ConflictException('Approval limit reached.');
    const record: ActionApproval = {
      id: randomUUID(), action, digest, traceId, scopeId: scope.id,
      tier: permissionFor(action.tool), expiresAt: Math.min(scope.expiresAt, Date.now() + 300_000), status: 'pending',
      target: action.tool === 'execute_code' ? 'Isolated JavaScript container' : `File ${action.fileId}`,
      risk: action.tool === 'execute_code' ? 'Runs the exact code shown. Network is disabled; only temporary sandbox files can be written.' : 'Permanently removes this uploaded file from the workspace.',
    };
    scope.approvals.set(record.id, record);
    this.audit(scope, {tool: action.tool, traceId, tier: record.tier, input: action, output: {approvalId: record.id}, status: 'pending'});
    // Return a copy: neither clients nor tool callers can mutate the authorized payload.
    return structuredClone(record);
  }

  consume(scope: WorkspaceScope, id: string, decision: 'approve' | 'deny' | 'cancel'): ActionApproval {
    scope.abort.signal.throwIfAborted();
    this.expireApprovals(scope);
    const record = scope.approvals.get(id);
    if (!record) throw new NotFoundException('Approval not found.');
    if (record.status !== 'pending') throw new ConflictException('Approval is no longer pending.');
    // Consume synchronously before any side effect, so concurrent approvals cannot replay.
    record.status = decision === 'approve' ? 'consumed' : decision === 'deny' ? 'denied' : 'cancelled';
    this.audit(scope, {tool: record.action.tool, traceId: record.traceId, tier: record.tier, input: {id, digest: record.digest, decision}, output: null, status: decision === 'approve' ? 'succeeded' : decision === 'deny' ? 'denied' : 'cancelled'});
    return structuredClone(record);
  }

  approvals(scope: WorkspaceScope) {
    this.expireApprovals(scope);
    return structuredClone([...scope.approvals.values()]);
  }

  append(scope: WorkspaceScope, event: ToolAudit) {
    if (scope.abort.signal.aborted) return;
    scope.audit.push(structuredClone(event));
    if (scope.audit.length > 300) scope.audit.shift();
  }

  audit(scope: WorkspaceScope, event: Pick<ToolAudit, 'tool' | 'traceId' | 'tier' | 'input' | 'output' | 'status'>) {
    this.append(scope, { ...event, input: auditSnapshot(event.input), output: auditSnapshot(event.output),
      id: randomUUID(), scopeId: scope.id, startedAt: new Date().toISOString(), durationMs: 0,
      cost: {usd: 0, kind: 'local', currency: 'USD'},
    });
  }

  remove(scope: WorkspaceScope) {
    scope.active?.abort(); scope.abort.abort(); scope.files.clear(); scope.approvals.clear(); scope.audit.length = 0;
    void scope.session.clearSession();
    this.scopes.delete(scope.id);
  }
  onModuleDestroy() { clearInterval(this.sweep); for (const scope of this.scopes.values()) this.remove(scope); }
  private expire() { for (const scope of this.scopes.values()) if (scope.expiresAt <= Date.now()) this.remove(scope); }
  private expireApprovals(scope: WorkspaceScope) {
    for (const record of scope.approvals.values()) if (record.status === 'pending' && record.expiresAt <= Date.now()) {
      record.status = 'expired';
      this.audit(scope, {tool: record.action.tool, traceId: record.traceId, tier: record.tier, input: {id: record.id}, output: null, status: 'expired'});
    }
  }
  private hash(value: string) { return createHash('sha256').update(value).digest(); }
}
