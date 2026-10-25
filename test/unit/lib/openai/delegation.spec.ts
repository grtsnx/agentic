import {
  OpenAIProvider,
  Usage,
  setTracingDisabled,
  type Model,
  type ModelResponse,
} from '@openai/agents';
import { DelegationService } from '../../../../src/lib/openai/delegation.service.js';

setTracingDisabled(true);
const message = (answer: string): ModelResponse => ({
  usage: new Usage({ inputTokens: 100, outputTokens: 20, totalTokens: 120 }),
  output: [
    {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({
            answer,
            evidence: ['file:notes#1'],
            uncertainties: ['Conflicting dates need confirmation.'],
          }),
        },
      ],
    },
  ],
});
const call = (name: string, args: unknown): ModelResponse => ({
  usage: new Usage({ inputTokens: 100, outputTokens: 20, totalTokens: 120 }),
  output: [
    {
      type: 'function_call',
      callId: crypto.randomUUID(),
      name,
      arguments: JSON.stringify(args),
    },
  ],
});

describe('actual SDK delegation and handoffs', () => {
  afterEach(() => vi.restoreAllMocks());
  it('delegates through asTool, hands off to a reviewer, and retains provenance and budget usage', async () => {
    const getResponse = vi
      .fn()
      .mockResolvedValueOnce(
        call('consult_researcher', { input: 'Review dates' }),
      )
      .mockResolvedValueOnce(call('review_evidence', {}))
      .mockResolvedValueOnce(message('Reviewed the evidence.'))
      .mockResolvedValueOnce(message('Merged the evidence.'));
    vi.spyOn(OpenAIProvider.prototype, 'getModel').mockResolvedValue({
      getResponse,
    } as unknown as Model);
    const context = {
      scopeId: 'scope-a',
      traceId: 'trace_0123456789abcdef0123456789abcdef',
      signal: new AbortController().signal,
      visited: new Set<string>(),
      handoffs: 0,
      contributions: [],
    };
    const result = await new DelegationService().execute(
      'Check conflicting dates',
      context,
      [],
      [],
    );
    expect(result.status).toBe('completed');
    expect(result.answer).toBe('Merged the evidence.');
    expect(result.contributions).toEqual([
      expect.objectContaining({
        agent: 'Reviewer',
        output: expect.objectContaining({ answer: 'Reviewed the evidence.' }),
      }),
    ]);
    expect(result.conflicts).toContain('Conflicting dates need confirmation.');
    expect(result.usage.totalTokens).toBe(480);
    expect(context.handoffs).toBe(1);
    expect(
      getResponse.mock.calls.every(([r]) => r.signal instanceof AbortSignal),
    ).toBe(true);
  });
  it('reports malformed specialist output as a partial result', async () => {
    const getResponse = vi
      .fn()
      .mockResolvedValueOnce(call('consult_coder', { input: 'Check code' }))
      .mockResolvedValueOnce({
        ...message('unused'),
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'not JSON' }],
          },
        ],
      })
      .mockResolvedValueOnce(message('Unable to verify the code.'));
    vi.spyOn(OpenAIProvider.prototype, 'getModel').mockResolvedValue({
      getResponse,
    } as unknown as Model);
    const result = await new DelegationService().execute(
      'Check code',
      {
        scopeId: 'scope',
        traceId: 'trace_0123456789abcdef0123456789abcdef',
        signal: new AbortController().signal,
        visited: new Set(),
        handoffs: 0,
        contributions: [],
      },
      [],
      [],
    );
    expect(result.status).toBe('partial');
    expect(result.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: 'Coder', error: 'SPECIALIST_FAILED' }),
      ]),
    );
  });
});
