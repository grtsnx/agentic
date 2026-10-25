const agents = vi.hoisted(() => ({
  captureConfig: vi.fn(),
  run: vi.fn(),
  webSearchTool: vi.fn((options) => ({ name: 'web_search', options })),
  tool: vi.fn((options) => options),
}));

vi.mock('@openai/agents', () => ({
  Agent: class {
    constructor(config: unknown) {
      agents.captureConfig(config);
    }
  },
  run: agents.run,
  webSearchTool: agents.webSearchTool,
  tool: agents.tool,
}));

import { OpenaiService } from '@/lib';
import {
  WebToolsService,
  webToolInputSchema,
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
} from '@/config';
import { ConfigService } from '@nestjs/config';

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

  it.each([false, true])(
    'collects external citations and usage with hosted search disabled (stream=%s)',
    async (streaming) => {
      const webTools = WebToolsService.fromEnvironment({});
      const source = {
        title: 'Reference',
        url: 'https://example.com/',
        domain: 'example.com',
      };
      vi.spyOn(webTools, 'createTools').mockImplementation(
        (onSources = () => {}) => [
          {
            name: 'context_dev_search',
            description: 'Search',
            parameters: webToolInputSchema,
            execute: async (_input: unknown, signal?: AbortSignal) => {
              expect(signal).toBeInstanceOf(AbortSignal);
              onSources([source]);
              return {
                ok: true,
                provider: 'context.dev',
                contentTrust: 'untrusted',
                results: [
                  { ...source, content: 'reference', truncated: false },
                ],
              };
            },
          },
        ],
      );
      agents.run.mockImplementation(async () => {
        const config = agents.captureConfig.mock.calls.at(-1)![0] as {
          tools: Array<{
            name: string;
            execute(input: unknown): Promise<unknown>;
          }>;
        };
        expect(config.tools.map((tool) => tool.name)).toEqual([
          'context_dev_search',
        ]);
        await config.tools[0]!.execute({ input: 'reference' });
        return {
          finalOutput: streaming ? 'The answer.' : output,
          state: {
            usage: {
              requests: 1,
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              inputTokensDetails: [],
              outputTokensDetails: [],
            },
          },
          rawResponses: [],
          newItems: [
            { type: 'tool_call_item', toolName: 'context_dev_search' },
          ],
          completed: Promise.resolve(),
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'raw_model_stream_event',
              data: { type: 'output_text_delta', delta: 'The answer.' },
            };
          },
        };
      });
      const service = new OpenaiService(
        new ConfigService({ WEB_SEARCH_ENABLED: false }),
        webTools,
      );
      const events = [];
      if (streaming) {
        for await (const event of service.streamReply('Question'))
          events.push(event);
      }
      const response = streaming
        ? events.find((event) => event.type === 'completed')?.response
        : await service.generateReply('Question');
      expect(response?.sources).toEqual([source]);
      expect(response?.runtime.tools).toEqual([
        { name: 'context_dev_search', calls: 1 },
      ]);
      expect(response?.runtime.cost.includesToolCosts).toBe(false);
      expect(agents.webSearchTool).not.toHaveBeenCalled();
    },
  );

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

  it.each([false, true])(
    'does not shorten the model deadline just because search is enabled (stream=%s)',
    async (streaming) => {
      const config = new ConfigService({
        MODEL_TIMEOUT_MS: 1000,
        WEB_SEARCH_TIMEOUT_MS: 10,
        WEB_SEARCH_ENABLED: true,
      });
      agents.run.mockImplementation(async (_agent, _message, { signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(signal.aborted).toBe(false);
        return {
          finalOutput: streaming ? 'Complete answer' : output,
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
          rawResponses: [],
          newItems: [],
          completed: Promise.resolve(),
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'raw_model_stream_event',
              data: { type: 'output_text_delta', delta: 'Complete answer' },
            };
          },
        };
      });
      const service = new OpenaiService(config);
      if (streaming) {
        const events = [];
        for await (const event of service.streamReply('Explain this'))
          events.push(event);
        expect(events.at(-1)?.type).toBe('completed');
      } else {
        await expect(
          service.generateReply('Explain this'),
        ).resolves.toMatchObject({ message: output.message });
      }
    },
  );

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
        message: 'Checking sources',
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
