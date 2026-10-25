import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { DelegationService } from '../../dist/lib/index.js';

if (process.env.RUN_DELEGATION_SMOKE !== 'true') {
  throw new Error(
    'Set RUN_DELEGATION_SMOKE=true; this check calls the provider.',
  );
}
const result = await new DelegationService().execute(
  'Ask the Researcher to independently check whether 2 + 2 equals 4 using basic arithmetic, then merge its result. No external sources are needed. Use the specialist tool at least once.',
  {
    scopeId: randomUUID(),
    traceId: `trace_${randomBytes(16).toString('hex')}`,
    signal: AbortSignal.timeout(45_000),
    visited: new Set(),
    handoffs: 0,
    contributions: [],
  },
  [],
  [],
);
assert.equal(
  result.status,
  'completed',
  JSON.stringify({
    failure: result.failure,
    contributions: result.contributions,
  }),
);
assert.ok(
  result.contributions.length > 0,
  'Expected a real specialist contribution',
);
assert.ok(result.answer.includes('4'), 'Expected a merged answer');
assert.ok(result.usage.totalTokens > 0, 'Expected real provider usage');
console.log(
  JSON.stringify({
    status: result.status,
    specialists: result.contributions.map((item) => item.agent),
    usage: result.usage,
  }),
);
