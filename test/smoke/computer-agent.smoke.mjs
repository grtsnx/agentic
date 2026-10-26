// Opt-in contract test: fixed public fixture only, no browser, Mac, or screenshots.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Agent, Runner, tool } from '@openai/agents';
import {
  computerToolActionSchema,
  computerObserveSchema,
} from '../../dist/config/schema/computer/computer.schema.js';
if (process.env.RUN_COMPUTER_AGENT_SMOKE !== 'true')
  throw new Error(
    'Set RUN_COMPUTER_AGENT_SMOKE=true. This uses a model and may incur charges.',
  );
const observationId = randomUUID();
let observed = false;
let proposed;
const agent = new Agent({
  name: 'Computer contract check',
  model: 'gpt-5-nano',
  modelSettings: { reasoning: { effort: 'low' } },
  instructions:
    'This is a fixed synthetic test, not a real computer. Observe the fixture with computer_observe, then use computer_action to propose exactly one navigation to https://example.com. Use the observationId returned. Stop after proposing. Never execute actions.',
  tools: [
    tool({
      name: 'computer_observe',
      description: 'Read a synthetic blank-page fixture. Use app null.',
      parameters: computerObserveSchema,
      execute: () => {
        observed = true;
        return {
          observationId,
          app: null,
          state: {
            title: 'Test fixture',
            url: 'about:blank',
            text: '',
            elements: [],
          },
        };
      },
    }),
    tool({
      name: 'computer_action',
      description:
        'Record a proposal only. The nested action for navigate has kind and url only.',
      parameters: computerToolActionSchema,
      execute: (args) => {
        assert.ok(observed);
        assert.equal(args.observationId, observationId);
        assert.equal(args.action.kind, 'navigate');
        assert.equal(new URL(args.action.url).href, 'https://example.com/');
        proposed = args;
        return {
          status: 'pending',
          message: 'Awaiting human approval. No action executed.',
        };
      },
    }),
  ],
});
const runner = new Runner({ tracingDisabled: true });
const result = await runner.run(
  agent,
  'Observe the fixture and propose opening https://example.com.',
  { maxTurns: 4, signal: AbortSignal.timeout(60000) },
);
if (!proposed) console.log('Contract failed: ' + result.finalOutput);
assert.ok(proposed);
console.log(
  'PASS: live model accepted the computer tool schemas, observed a synthetic fixture, and proposed the expected action. No real UI data sent or computer action executed.',
);
