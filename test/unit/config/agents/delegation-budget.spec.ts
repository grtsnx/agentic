import { BoundedAgentModel } from '../../../../src/config/openai/bounded-agent-model.js';
import type { Model, ModelRequest } from '@openai/agents';
describe('shared delegation budgets', () => {
  const request = {
    input: 'task',
    modelSettings: {},
    tools: [],
    handoffs: [],
    outputType: { type: 'text' },
  } as unknown as ModelRequest;
  it('rejects oversized calls before contacting the model', async () => {
    const getResponse = vi.fn();
    const bounded = new BoundedAgentModel(
      { getResponse } as unknown as Model,
      new AbortController().signal,
    );
    await expect(
      bounded.getResponse({ ...request, input: 'x'.repeat(50_000) }),
    ).rejects.toThrow('BUDGET');
    expect(getResponse).not.toHaveBeenCalled();
  });
  it('enforces shared call and output limits', async () => {
    const getResponse = vi.fn(async () => ({
      usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      output: [],
    }));
    const bounded = new BoundedAgentModel(
      { getResponse } as unknown as Model,
      new AbortController().signal,
    );
    for (let i = 0; i < 8; i++) await bounded.getResponse(request);
    await expect(bounded.getResponse(request)).rejects.toThrow('BUDGET');
    expect(getResponse.mock.calls).toHaveLength(8);
    expect(bounded.usage.totalTokens).toBe(96);
  });
  it('rejects concurrent calls and propagates cancellation', async () => {
    let release!: (value: unknown) => void;
    const controller = new AbortController();
    const getResponse = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const bounded = new BoundedAgentModel(
      { getResponse } as unknown as Model,
      controller.signal,
    );
    const first = bounded.getResponse(request);
    await expect(bounded.getResponse(request)).rejects.toThrow('PARALLEL');
    release({
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      output: [],
    });
    await first;
    controller.abort();
    await expect(bounded.getResponse(request)).rejects.toThrow();
    expect(getResponse).toHaveBeenCalledTimes(1);
  });
});
