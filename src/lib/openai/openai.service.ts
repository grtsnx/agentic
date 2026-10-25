import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Agent,
  MemorySession,
  run,
  tool,
  webSearchTool,
  type RunStreamEvent,
} from '@openai/agents';
import {
  openaiOutputSchema,
  openaiResponseSchema,
  type OpenaiResponse,
  openaiStreamResponseSchema,
  type OpenaiStreamEvent,
  type OpenaiRuntime,
  type WebSource,
} from '@/config/schema';
import {
  OPENAI_MODELS,
  routeOpenaiModel,
  type OpenaiModel,
} from './openai-model-router.js';
import {
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
} from '@/config/agent/agent-instructions.js';
import { ApplicationException } from '@/middleware/errors/application.exception.js';
import { mapProviderError } from './provider-error.js';
import { WebToolsService } from '@/config/web-tools';

const TOKENS_PER_MILLION = 1_000_000;

// GPT-6 Luna uses higher standard-tier rates when one request exceeds this input size.
const LONG_CONTEXT_THRESHOLD = 272_000;

// The SDK preserves provider-specific token breakdowns under dynamic keys.
interface TokenDetails {
  [key: string]: number | TokenDetails;
}

interface RuntimeSource {
  state: {
    usage: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      inputTokensDetails: TokenDetails[];
      outputTokensDetails: TokenDetails[];
    };
  };
  newItems: Array<{ type: string; toolName?: string }>;
  rawResponses: Array<{ providerData?: Record<string, unknown> }>;
}

export interface OpenaiStreamOptions {
  session?: MemorySession;
  signal?: AbortSignal;
}

export interface OpenaiReplyOptions extends OpenaiStreamOptions {}

@Injectable()
export class OpenaiService {
  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly webTools?: WebToolsService,
  ) {}

  createSession(): MemorySession {
    return new MemorySession();
  }

  async generateReply(
    message: string,
    options: OpenaiReplyOptions = {},
  ): Promise<OpenaiResponse> {
    const startedAt = performance.now();
    const model = routeOpenaiModel(message);
    const searchEnabled = this.setting('WEB_SEARCH_ENABLED', true);
    const signal = this.runSignal(options.signal);
    const sources: WebSource[] = [];
    const agent = new Agent({
      name: AGENT_NAME,
      instructions: AGENT_INSTRUCTIONS,
      model,
      outputType: openaiOutputSchema,
      tools: this.createTools(searchEnabled, signal, sources),
    });

    try {
      const result = await run(agent, message, {
        ...(options.session ? { session: options.session } : {}),
        signal,
      });
      if (!result.finalOutput) {
        throw new ApplicationException(
          'PROVIDER_INVALID_RESPONSE',
          'The AI provider returned no structured output.',
          502,
          true,
        );
      }

      // Validate model-controlled data before attaching server-controlled metadata.
      const output = openaiOutputSchema.parse(result.finalOutput);
      return openaiResponseSchema.parse({
        ...output,
        sources: this.extractSources(result, sources),
        runtime: this.buildRuntime(
          result,
          performance.now() - startedAt,
          model,
        ),
      });
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  async *streamReply(
    message: string,
    options: OpenaiStreamOptions = {},
  ): AsyncGenerator<OpenaiStreamEvent> {
    const startedAt = performance.now();
    let lastStatus = '';
    const thinking = {
      type: 'status',
      phase: 'thinking',
      message: 'Thinking',
    } as const;
    yield thinking;
    lastStatus = this.statusKey(thinking);

    const model = routeOpenaiModel(message);
    const searchEnabled = this.setting('WEB_SEARCH_ENABLED', true);
    const signal = this.runSignal(options.signal);
    const sources: WebSource[] = [];
    const agent = new Agent({
      name: AGENT_NAME,
      instructions: AGENT_INSTRUCTIONS,
      model,
      tools: this.createTools(searchEnabled, signal, sources),
    });
    let stream;
    try {
      stream = await run(agent, message, {
        stream: true,
        session: options.session,
        signal,
      });
    } catch (error) {
      throw mapProviderError(error);
    }

    try {
      for await (const event of stream) {
        const status = this.describeStreamEvent(event);
        if (status && this.statusKey(status) !== lastStatus) {
          yield status;
          lastStatus = this.statusKey(status);
        }

        if (
          event.type === 'raw_model_stream_event' &&
          event.data.type === 'output_text_delta'
        ) {
          const responding = {
            type: 'status',
            phase: 'responding',
            message: 'Responding',
          } as const;
          if (this.statusKey(responding) !== lastStatus) {
            yield responding;
            lastStatus = this.statusKey(responding);
          }
          yield { type: 'delta', delta: event.data.delta };
        }
      }

      await stream.completed;
      if (!stream.finalOutput) {
        throw new ApplicationException(
          'PROVIDER_INVALID_RESPONSE',
          'The AI provider returned no streamed output.',
          502,
          true,
        );
      }

      yield {
        type: 'completed',
        response: openaiStreamResponseSchema.parse({
          message: stream.finalOutput,
          sources: this.extractSources(stream, sources),
          runtime: this.buildRuntime(
            stream,
            performance.now() - startedAt,
            model,
          ),
        }),
      };
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  private createTools(
    searchEnabled: boolean,
    signal: AbortSignal,
    sources: WebSource[],
  ) {
    const domains = this.setting<string[]>('WEB_SEARCH_ALLOWED_DOMAINS', []);
    const external =
      this.webTools
        ?.createTools((found) => sources.push(...found))
        .map((definition) =>
          tool({
            name: definition.name,
            description: definition.description,
            parameters: definition.parameters,
            execute: (input) => definition.execute(input, signal),
          }),
        ) ?? [];
    return searchEnabled
      ? [
          webSearchTool({
            searchContextSize: 'medium',
            ...(domains.length > 0
              ? { filters: { allowedDomains: domains } }
              : {}),
          }),
          ...external,
        ]
      : external;
  }

  private runSignal(external: AbortSignal | undefined): AbortSignal {
    const modelTimeout = this.setting('MODEL_TIMEOUT_MS', 60_000);
    // Tool availability must not shorten the deadline for unrelated answers.
    // External tools enforce their own per-call timeout inside this run budget.
    const timeout = AbortSignal.timeout(modelTimeout);
    return external ? AbortSignal.any([external, timeout]) : timeout;
  }

  private setting<T>(key: string, fallback: T): T {
    return this.config?.get<T>(key) ?? fallback;
  }

  private extractSources(
    result: RuntimeSource,
    external: WebSource[] = [],
  ): Array<{
    title: string;
    url: string;
    domain: string;
    startIndex?: number;
    endIndex?: number;
  }> {
    const found = new Map<
      string,
      ReturnType<OpenaiService['extractSources']>[number]
    >();
    for (const source of external) found.set(source.url, source);
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (
        record.type === 'url_citation' &&
        typeof record.url === 'string' &&
        typeof record.title === 'string'
      ) {
        try {
          const url = new URL(record.url);
          if (!['http:', 'https:'].includes(url.protocol)) return;
          found.set(url.href, {
            title: record.title,
            url: url.href,
            domain: url.hostname,
            ...(typeof record.start_index === 'number'
              ? { startIndex: record.start_index }
              : {}),
            ...(typeof record.end_index === 'number'
              ? { endIndex: record.end_index }
              : {}),
          });
        } catch {
          // Ignore malformed provider annotations rather than exposing unsafe links.
        }
      }
      for (const child of Object.values(record)) visit(child);
    };
    visit(result.newItems);
    visit(result.rawResponses);
    return [...found.values()];
  }

  private describeStreamEvent(
    event: RunStreamEvent,
  ): Extract<OpenaiStreamEvent, { type: 'status' }> | undefined {
    if (event.type === 'agent_updated_stream_event') {
      return {
        type: 'status',
        phase: 'handoff',
        message: 'Working on your request',
      };
    }

    if (event.type !== 'run_item_stream_event') return undefined;

    if (event.name === 'tool_called' || event.name === 'tool_search_called') {
      return {
        type: 'status',
        phase: 'tool',
        message: 'Checking sources',
      };
    }

    if (
      event.name === 'tool_output' ||
      event.name === 'tool_search_output_created'
    ) {
      return {
        type: 'status',
        phase: 'thinking',
        message: 'Reviewing information',
      };
    }

    if (event.name === 'handoff_requested') {
      return {
        type: 'status',
        phase: 'handoff',
        message: 'Working on your request',
      };
    }

    if (event.name === 'handoff_occurred') {
      return {
        type: 'status',
        phase: 'handoff',
        message: 'Working on your request',
      };
    }

    if (event.name === 'tool_approval_requested') {
      return {
        type: 'status',
        phase: 'approval',
        message: 'Waiting for approval',
      };
    }

    if (event.name === 'compaction_item_created') {
      return {
        type: 'status',
        phase: 'thinking',
        message: 'Organizing context',
      };
    }

    if (event.name === 'reasoning_item_created') {
      return {
        type: 'status',
        phase: 'thinking',
        message: 'Thinking',
      };
    }

    if (event.name === 'message_output_created') {
      return {
        type: 'status',
        phase: 'responding',
        message: 'Responding',
      };
    }

    return undefined;
  }

  private statusKey(
    status: Extract<OpenaiStreamEvent, { type: 'status' }>,
  ): string {
    return `${status.phase}:${status.message}:${status.detail ?? ''}`;
  }

  private buildRuntime(
    result: RuntimeSource,
    durationMs: number,
    fallbackModel: OpenaiModel,
  ): OpenaiRuntime {
    const usage = result.state.usage;
    const tools = this.countCalls(
      result.newItems
        .filter((item) => item.type === 'tool_call_item')
        .map((item) => item.toolName)
        .filter((name): name is string => Boolean(name)),
    );
    const models = this.countCalls(
      result.rawResponses.map((response) => {
        const model = response.providerData?.model;
        return typeof model === 'string' && model.length > 0
          ? model
          : fallbackModel;
      }),
    );

    return {
      durationMs: Math.max(0, Math.round(durationMs)),
      tokens: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
        cachedInput: this.sumTokenDetail(
          usage.inputTokensDetails,
          'cached_tokens',
        ),
        reasoningOutput: this.sumTokenDetail(
          usage.outputTokensDetails,
          'reasoning_tokens',
        ),
      },
      cost: {
        estimatedUsd: this.estimateModelCost(
          usage,
          models[0]?.name ?? fallbackModel,
        ),
        currency: 'USD',
        exact: false,
        // Tool pricing varies by tool, so the model estimate covers the full run only without tools.
        includesToolCosts: tools.length === 0,
      },
      models:
        models.length > 0
          ? models
          : [{ name: fallbackModel, calls: usage.requests }],
      tools,
    };
  }

  private countCalls(names: string[]): Array<{ name: string; calls: number }> {
    const counts = new Map<string, number>();

    for (const name of names) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()].map(([name, calls]) => ({ name, calls }));
  }

  private sumTokenDetail(details: TokenDetails[], key: string): number {
    return details.reduce((total, detail) => {
      const value = detail[key];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  private estimateModelCost(
    usage: {
      inputTokens: number;
      outputTokens: number;
      inputTokensDetails: TokenDetails[];
    },
    model: string,
  ): number {
    // Rates are USD per one million tokens on OpenAI's standard tier.
    // This is an estimate because the Agents SDK does not return the invoiced amount.
    const cachedInput = this.sumTokenDetail(
      usage.inputTokensDetails,
      'cached_tokens',
    );
    const uncachedInput = Math.max(0, usage.inputTokens - cachedInput);
    const longContext = usage.inputTokens > LONG_CONTEXT_THRESHOLD;
    const rates = model.startsWith(OPENAI_MODELS.economical)
      ? { input: 0.05, cachedInput: 0.005, output: 0.4 }
      : {
          input: longContext ? 0.2 : 0.1,
          cachedInput: longContext ? 0.02 : 0.01,
          output: longContext ? 0.75 : 0.5,
        };
    const estimate =
      (uncachedInput * rates.input +
        cachedInput * rates.cachedInput +
        usage.outputTokens * rates.output) /
      TOKENS_PER_MILLION;

    return Number(estimate.toFixed(8));
  }
}
