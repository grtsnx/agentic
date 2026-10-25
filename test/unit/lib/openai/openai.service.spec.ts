const agents = vi.hoisted(() => ({
  captureConfig: vi.fn(),
  run: vi.fn(),
  webSearchTool: vi.fn((options) => ({ name: 'web_search', options })),
}));

vi.mock('@openai/agents', () => ({
  Agent: class {
    constructor(config: unknown) {
      agents.captureConfig(config);
    }
  },
  run: agents.run,
  webSearchTool: agents.webSearchTool,
}));

import { OpenaiService } from '@/lib';
import {
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
} from '@/config/agent/agent-instructions.js';

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
    agents.webSearchTool.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a Zod output type and returns validated structured output', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(350);
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
      rawResponses: [{ providerData: { model: 'gpt-5-nano-2025-08-07' } }],
      newItems: [
        { type: 'tool_call_item', toolName: 'web_search' },
        { type: 'tool_call_item', toolName: 'web_search' },
      ],
    });

    const service = new OpenaiService();
    await expect(service.generateReply('Question')).resolves.toEqual({
      ...output,
      sources: [],
      runtime: {
        durationMs: 250,
        tokens: {
          input: 100,
          output: 50,
          total: 150,
          cachedInput: 20,
          reasoningOutput: 15,
        },
        cost: {
          estimatedUsd: 0.0000241,
          currency: 'USD',
          exact: false,
          includesToolCosts: false,
        },
        models: [{ name: 'gpt-5-nano-2025-08-07', calls: 1 }],
        tools: [{ name: 'web_search', calls: 2 }],
      },
    });
    const config = agents.captureConfig.mock.calls[0]?.[0] as {
      instructions?: string;
      model?: string;
      name?: string;
      outputType?: { safeParse(value: unknown): { success: boolean } };
    };

    expect(config.name).toBe(AGENT_NAME);
    expect(config.instructions).toBe(AGENT_INSTRUCTIONS);
    expect(config.model).toBe('gpt-5-nano');
    expect(config.outputType).toBeDefined();
    expect(config.outputType?.safeParse(output).success).toBe(true);
  });

  it('promotes complex requests to GPT-6 Luna', async () => {
    agents.run.mockResolvedValue({
      finalOutput: output,
      state: {
        usage: {
          requests: 1,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          inputTokensDetails: [],
          outputTokensDetails: [],
        },
      },
      rawResponses: [{ providerData: { model: 'gpt-6-luna' } }],
      newItems: [],
    });

    await new OpenaiService().generateReply(
      'Design and implement a secure distributed architecture with tests.',
    );

    expect(agents.captureConfig).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-6-luna' }),
    );
  });

  it('rejects a run without structured output', async () => {
    agents.run.mockResolvedValue({ finalOutput: undefined });

    await expect(
      new OpenaiService().generateReply('Question'),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
  });

  it('rejects malformed structured model output with a stable error', async () => {
    agents.run.mockResolvedValue({ finalOutput: { status: 'completed' } });

    await expect(
      new OpenaiService().generateReply('Question'),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
  });

  it('configures web-search domain controls and a provider timeout', async () => {
    agents.run.mockResolvedValue({
      finalOutput: output,
      state: {
        usage: {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          inputTokensDetails: [],
          outputTokensDetails: [],
        },
      },
      rawResponses: [],
      newItems: [],
    });
    const values = {
      MODEL_TIMEOUT_MS: 5_000,
      WEB_SEARCH_TIMEOUT_MS: 1_000,
      WEB_SEARCH_ENABLED: true,
      WEB_SEARCH_ALLOWED_DOMAINS: ['openai.com'],
    };
    const config = { get: vi.fn((key: keyof typeof values) => values[key]) };

    await new OpenaiService(config as never).generateReply(
      'latest OpenAI news',
    );

    expect(agents.webSearchTool).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { allowedDomains: ['openai.com'] } }),
    );
    expect(agents.run).toHaveBeenCalledWith(
      expect.anything(),
      'latest OpenAI news',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('extracts deduplicated citation metadata from provider annotations', async () => {
    agents.run.mockResolvedValue({
      finalOutput: output,
      state: {
        usage: {
          requests: 1,
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokensDetails: [],
          outputTokensDetails: [],
        },
      },
      rawResponses: [
        {
          providerData: {
            output: [
              {
                content: [
                  {
                    annotations: [
                      {
                        type: 'url_citation',
                        title: 'OpenAI docs',
                        url: 'https://developers.openai.com/docs',
                        start_index: 1,
                        end_index: 4,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      newItems: [],
    });

    const response = await new OpenaiService().generateReply('Question');

    expect(response.sources).toEqual([
      {
        title: 'OpenAI docs',
        url: 'https://developers.openai.com/docs',
        domain: 'developers.openai.com',
        startIndex: 1,
        endIndex: 4,
      },
    ]);
  });

  it('streams text deltas and finishes with runtime metadata', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(350);
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'run_item_stream_event',
          name: 'tool_called',
          item: { type: 'tool_call_item', toolName: 'web_search' },
        };
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
      rawResponses: [{ providerData: { model: 'gpt-5-nano' } }],
      newItems: [],
    };
    agents.run.mockResolvedValue(stream);

    const events = [];
    for await (const event of new OpenaiService().streamReply('Question')) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'status', phase: 'thinking', message: 'Thinking' },
      {
        type: 'status',
        phase: 'tool',
        message: 'Using web search',
        detail: 'web_search',
      },
      { type: 'status', phase: 'responding', message: 'Responding' },
      { type: 'delta', delta: 'Hello' },
      { type: 'delta', delta: ' world' },
      {
        type: 'completed',
        response: {
          message: 'Hello world',
          sources: [],
          runtime: {
            durationMs: 250,
            tokens: {
              input: 10,
              output: 2,
              total: 12,
              cachedInput: 0,
              reasoningOutput: 0,
            },
            cost: {
              estimatedUsd: 0.0000013,
              currency: 'USD',
              exact: false,
              includesToolCosts: true,
            },
            models: [{ name: 'gpt-5-nano', calls: 1 }],
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
