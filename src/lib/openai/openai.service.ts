import { ClefService } from '../clef/clef.service.js';
import type {
  ModelRoutingDecision,
  TokenDetails,
  RuntimeSource,
  OpenaiStreamOptions,
  OpenaiReplyOptions,
} from '@/config';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Agent,
  MemorySession,
  Runner,
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
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
  OPENAI_MODELS,
  routeOpenaiModel,
  openaiModelSettings,
  isDirectTextRequest,
  mapProviderError,
  type OpenaiModel,
  WebToolsService,
} from '@/config';

import { ApplicationException } from '@/middleware';

const TOKENS_PER_MILLION = 1_000_000;

// GPT-6 Luna uses higher standard-tier rates when one request exceeds this input size.
const LONG_CONTEXT_THRESHOLD = 272_000;

@Injectable()
export class OpenaiService {
  private readonly runner: Runner;
  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly webTools?: WebToolsService,
    @Optional() private readonly clef?: ClefService,
  ) {
    // Keep structural traces without exporting prompts, answers, or tool payloads.
    // A per-call output cap bounds reasoning and visible output, not total run cost.
    this.runner = new Runner({
      traceIncludeSensitiveData: false,
      modelSettings: {
        maxTokens: this.setting('MODEL_MAX_OUTPUT_TOKENS', 8192),
      },
    });
  }

  createSession(): MemorySession {
    return new MemorySession();
  }

  async generateReply(
    message: string,
    options: OpenaiReplyOptions = {},
  ): Promise<OpenaiResponse> {
    const startedAt = performance.now();
    const signal = this.runSignal(options.signal);
    const routing = await this.selectModel(message, { ...options, signal });
    const model = routing.model;
    const searchEnabled = this.setting('WEB_SEARCH_ENABLED', true);
    const sources: WebSource[] = options.sources ?? [];
    const tools = isDirectTextRequest(message)
      ? []
      : [
          ...this.createTools(model, searchEnabled, signal, sources, options),
          ...(options.tools ?? []),
        ];
    const agent = new Agent({
      name: AGENT_NAME,
      instructions: AGENT_INSTRUCTIONS + (options.toolInstructions ?? ''),
      model,
      modelSettings: openaiModelSettings(model, tools.length > 0),
      outputType: openaiOutputSchema,
      tools,
    });

    try {
      const result = await this.runner.run(agent, message, {
        ...(options.session ? { session: options.session } : {}),
        signal,
        maxTurns: 8,
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
          routing,
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

    const signal = this.runSignal(options.signal);
    const routing = await this.selectModel(message, { ...options, signal });
    const model = routing.model;
    const searchEnabled = this.setting('WEB_SEARCH_ENABLED', true);
    const sources: WebSource[] = options.sources ?? [];
    const tools = isDirectTextRequest(message)
      ? []
      : [
          ...this.createTools(model, searchEnabled, signal, sources, options),
          ...(options.tools ?? []),
        ];
    const agent = new Agent({
      name: AGENT_NAME,
      instructions: AGENT_INSTRUCTIONS + (options.toolInstructions ?? ''),
      model,
      modelSettings: openaiModelSettings(model, tools.length > 0),
      tools,
    });
    let stream;
    try {
      stream = await this.runner.run(agent, message, {
        stream: true,
        session: options.session,
        signal,
        maxTurns: 8,
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
            routing,
          ),
        }),
      };
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  private async selectModel(
    message: string,
    options: OpenaiStreamOptions,
  ): Promise<ModelRoutingDecision> {
    try {
      if (isDirectTextRequest(message))
        return {
          model: OPENAI_MODELS.economical,
          source: 'local',
          reason: 'fast_path',
          durationMs: 0,
          estimatedCostUsd: 0,
        };
      const history = (await options.session?.getItems(24)) ?? [];
      const recentUserMessages = history.flatMap((item) => {
        if (!('role' in item) || item.role !== 'user' || !('content' in item))
          return [];
        const content =
          typeof item.content === 'string'
            ? item.content
            : item.content
                .flatMap((part) =>
                  part.type === 'input_text' ? [part.text] : [],
                )
                .join('\n');
        if (
          content.startsWith('[Server-confirmed action result.') ||
          content.startsWith('[Conversation summary of earlier turns]')
        )
          return [];
        return [content.slice(0, 4000)];
      });
      const context = {
        recentUserMessages,
        hasAttachments: options.hasAttachments,
      };
      options.signal?.throwIfAborted();
      if (this.clef)
        return await this.clef.route(message, context, options.signal);
      return {
        model: routeOpenaiModel(message, context),
        source: 'local',
        reason: 'disabled',
        durationMs: 0,
        estimatedCostUsd: null,
      };
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  private createTools(
    model: OpenaiModel,
    searchEnabled: boolean,
    signal: AbortSignal,
    sources: WebSource[],
    options: OpenaiReplyOptions,
  ) {
    if (options.scopedToolsOnly) return [];
    const domains = this.setting<string[]>('WEB_SEARCH_ALLOWED_DOMAINS', []);
    const external =
      this.webTools
        ?.createTools(
          (found) => sources.push(...found),
          options.onToolAudit,
          options.scopeId,
          options.traceId,
        )
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
            searchContextSize:
              model === OPENAI_MODELS.economical ? 'low' : 'medium',
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
    // Forward only allowlisted activity labels, never raw reasoning or tool input.
    if (
      event.type === 'raw_model_stream_event' &&
      event.data.type === 'model'
    ) {
      const raw = event.data.event as Record<string, unknown>;
      if (!raw || typeof raw !== 'object') return undefined;
      if (
        raw.type === 'response.web_search_call.in_progress' ||
        raw.type === 'response.web_search_call.searching'
      ) {
        return { type: 'status', phase: 'tool', message: 'Searching the web' };
      }
      if (raw.type === 'response.web_search_call.completed') {
        return {
          type: 'status',
          phase: 'thinking',
          message: 'Reviewing sources',
        };
      }
      if (
        raw.type === 'response.output_item.added' &&
        (raw.item as { type?: string } | undefined)?.type === 'reasoning'
      ) {
        return { type: 'status', phase: 'thinking', message: 'Thinking' };
      }
    }

    if (event.type !== 'run_item_stream_event') return undefined;

    if (event.name === 'tool_called' || event.name === 'tool_search_called') {
      const item = event.item as {
        toolName?: string;
        rawItem?: { name?: string; type?: string; status?: string };
      };
      // Hosted calls are reported again after they finish; don't show them as active.
      if (item.rawItem?.type === 'hosted_tool_call') return undefined;
      const name = item.toolName ?? item.rawItem?.name;
      const message =
        name === 'firecrawl_read_page'
          ? 'Reading a page'
          : ['web_search', 'context_dev_search', 'valyu_search'].includes(
                name ?? '',
              )
            ? 'Searching the web'
            : 'Using a tool';
      return { type: 'status', phase: 'tool', message };
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
    routing?: ModelRoutingDecision,
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
      ...(routing && routing.reason !== 'disabled' ? { routing } : {}),
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
