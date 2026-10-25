import type { PermissionTier, ToolAudit } from '../../schema/types/workspaces/workspace.types.js';
import { randomUUID } from 'node:crypto';

export const TOOL_PERMISSIONS: Readonly<Record<string, PermissionTier>> = Object.freeze({
  context_dev_search: 'safe_read', firecrawl_read_page: 'safe_read', valyu_search: 'safe_read',
  retrieve_files: 'sensitive_read', execute_code: 'write', delete_file: 'destructive',
  delegate_task: 'safe_read', send_message: 'message', make_payment: 'payment',
});
export function permissionFor(tool: string): PermissionTier {
  const tier = TOOL_PERMISSIONS[tool];
  if (!tier) throw new Error('TOOL_NOT_ALLOWED');
  return tier;
}
export function requiresApproval(tier: PermissionTier): boolean {
  return !['safe_read', 'sensitive_read'].includes(tier);
}
// Bounded, redacted snapshots avoid recording secrets or retaining entire uploaded files.
export function auditSnapshot(value: unknown): unknown {
  const json = JSON.stringify(value ?? null, (key, item: unknown) =>
    /token|secret|password|authorization|api.?key/i.test(key) ? '[redacted]' : item,
  ).replace(/\b(?:sk-|lk_)[A-Za-z0-9_-]{12,}\b/g, '[redacted]');
  return json.length > 4_000 ? { preview: json.slice(0, 4_000), truncated: true } : JSON.parse(json);
}
export async function auditedTool<T>(
  scopeId: string, traceId: string, tool: string, input: unknown,
  sink: (event: ToolAudit) => void, execute: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  const event: ToolAudit = {
    id: randomUUID(), scopeId, traceId, tool, tier: permissionFor(tool),
    startedAt: new Date().toISOString(), durationMs: 0, input: auditSnapshot(input), output: null,
    status: 'succeeded', cost: {usd: null, kind: 'unknown', currency: 'USD'},
  };
  try {
    const output = await execute();
    event.output = auditSnapshot(output);
    if (output && typeof output === 'object' && 'ok' in output && output.ok === false) {
      event.status = 'failed';
      event.errorCode = 'TOOL_FAILED';
    }
    return output;
  } catch (error) {
    event.status = error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed';
    event.errorCode = event.status === 'cancelled' ? 'CANCELLED' : 'TOOL_FAILED';
    throw error;
  } finally {
    event.durationMs = Math.round(performance.now() - start);
    sink(event);
  }
}
