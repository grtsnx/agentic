import { ServiceUnavailableException } from '@nestjs/common';

const agents = vi.hoisted(() => ({
  captureConfig: vi.fn(),
  run: vi.fn(),
}));

vi.mock('@openai/agents', () => ({
  Agent: class {
    constructor(config: unknown) {
      agents.captureConfig(config);
    }
  },
  run: agents.run,
}));

import { OpenaiService } from '@/lib';

describe('OpenaiService', () => {
  const output = {
    status: 'completed',
    message: 'The answer.',
    summary: 'A summary.',
    keyPoints: ['A key point.'],
    suggestedActions: [],
    followUpQuestions: ['A follow-up?'],
  };

  beforeEach(() => {
    agents.captureConfig.mockClear();
    agents.run.mockReset();
  });

  it('uses a Zod output type and returns validated structured output', async () => {
    agents.run.mockResolvedValue({
      finalOutput: output,
      state: {
        usage: {
          requests: 1,
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          inputTokensDetails: [{ cached_tokens: 20 }],
          outputTokensDetails: [{ reasoning_tokens: 15 }],
        },
      },
      rawResponses: [{ providerData: { model: 'gpt-6-astra' } }],
      newItems: [
        { type: 'tool_call_item', toolName: 'web_search' },
        { type: 'tool_call_item', toolName: 'web_search' },
      ],
    });

    const service = new OpenaiService();
    const config = agents.captureConfig.mock.calls[0]?.[0] as {
      outputType?: { safeParse(value: unknown): { success: boolean } };
    };

    expect(config.outputType).toBeDefined();
    expect(config.outputType?.safeParse(output).success).toBe(true);
    await expect(service.generateReply('Question')).resolves.toEqual({
      ...output,
      runtime: {
        tokens: {
          input: 100,
          output: 50,
          total: 150,
          cachedInput: 20,
          reasoningOutput: 15,
        },
        cost: {
          estimatedUsd: 0.00332,
          currency: 'USD',
          exact: false,
          includesToolCosts: false,
        },
        models: [{ name: 'gpt-6-astra', calls: 1 }],
        tools: [{ name: 'web_search', calls: 2 }],
      },
    });
  });

  it('rejects a run without structured output', async () => {
    agents.run.mockResolvedValue({ finalOutput: undefined });

    await expect(
      new OpenaiService().generateReply('Question'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('streams text deltas and finishes with runtime metadata', async () => {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'raw_model_stream_event',
          data: { type: 'output_text_delta', delta: 'Hello' },
        };
        yield {
          type: 'raw_model_stream_event',
          data: { type: 'output_text_delta', delta: ' world' },
        };
      },
      completed: Promise.resolve(),
      finalOutput: 'Hello world',
      state: {
        usage: {
          requests: 1,
          inputTokens: 10,
          outputTokens: 2,
          totalTokens: 12,
          inputTokensDetails: [],
          outputTokensDetails: [],
        },
      },
      rawResponses: [{ providerData: { model: 'gpt-6-astra' } }],
      newItems: [],
    };
    agents.run.mockResolvedValue(stream);

    const events = [];
    for await (const event of new OpenaiService().streamReply('Question')) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'delta', delta: 'Hello' },
      { type: 'delta', delta: ' world' },
      {
        type: 'completed',
        response: {
          message: 'Hello world',
          runtime: {
            tokens: {
              input: 10,
              output: 2,
              total: 12,
              cachedInput: 0,
              reasoningOutput: 0,
            },
            cost: {
              estimatedUsd: 0.0002,
              currency: 'USD',
              exact: false,
              includesToolCosts: true,
            },
            models: [{ name: 'gpt-6-astra', calls: 1 }],
            tools: [],
          },
        },
      },
    ]);
    expect(agents.run).toHaveBeenCalledWith(
      expect.anything(),
      'Question',
      expect.objectContaining({ stream: true }),
    );
  });
});
