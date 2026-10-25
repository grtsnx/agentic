import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Agent, MemorySession, run, type RunStreamEvent } from '@openai/agents';
import {
  openaiOutputSchema,
  openaiResponseSchema,
  type OpenaiResponse,
} from './schema/openai-output.schema.js';
import {
  openaiStreamResponseSchema,
  type OpenaiStreamEvent,
} from './schema/openai-stream.schema.js';
import type { OpenaiRuntime } from './schema/openai-runtime.schema.js';
import {
  OPENAI_MODELS,
  routeOpenaiModel,
  type OpenaiModel,
} from './openai-model-router.js';

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

@Injectable()
export class OpenaiService {
  createSession(): MemorySession {
    return new MemorySession();
  }

  async generateReply(message: string): Promise<OpenaiResponse> {
    const startedAt = performance.now();
    const model = routeOpenaiModel(message);
    const agent = new Agent({
      name: 'History tutor',
      instructions: 'You answer history questions clearly and concisely.',
      model,
      outputType: openaiOutputSchema,
    });
    const result = await run(agent, message);
    if (!result.finalOutput) {
      throw new ServiceUnavailableException(
        'The AI provider returned no structured output',
      );
    }

    // Validate model-controlled data before attaching server-controlled runtime metadata.
    const output = openaiOutputSchema.parse(result.finalOutput);

    return openaiResponseSchema.parse({
      ...output,
      runtime: this.buildRuntime(result, performance.now() - startedAt, model),
    });
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
    const agent = new Agent({
      name: 'History tutor',
      instructions: 'You answer history questions clearly and concisely.',
      model,
    });
    const stream = await run(agent, message, {
      stream: true,
      session: options.session,
      signal: options.signal,
    });

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
      throw new ServiceUnavailableException(
        'The AI provider returned no streamed output',
      );
    }

    yield {
      type: 'completed',
      response: openaiStreamResponseSchema.parse({
        message: stream.finalOutput,
        runtime: this.buildRuntime(
          stream,
          performance.now() - startedAt,
          model,
        ),
      }),
    };
  }

  private describeStreamEvent(
    event: RunStreamEvent,
  ): Extract<OpenaiStreamEvent, { type: 'status' }> | undefined {
    if (event.type === 'agent_updated_stream_event') {
      return {
        type: 'status',
        phase: 'handoff',
        message: `Working with ${event.agent.name}`,
        detail: event.agent.name,
      };
    }

    if (event.type !== 'run_item_stream_event') return undefined;

    if (event.name === 'tool_called' || event.name === 'tool_search_called') {
      const toolName =
        'toolName' in event.item && typeof event.item.toolName === 'string'
          ? event.item.toolName
          : 'tool';
      return {
        type: 'status',
        phase: 'tool',
        message: `Using ${this.readableName(toolName)}`,
        detail: toolName,
      };
    }

    if (
      event.name === 'tool_output' ||
      event.name === 'tool_search_output_created'
    ) {
      return {
        type: 'status',
        phase: 'thinking',
        message: 'Reviewing tool result',
      };
    }

    if (event.name === 'handoff_requested') {
      return {
        type: 'status',
        phase: 'handoff',
        message: 'Preparing handoff',
      };
    }

    if (event.name === 'handoff_occurred') {
      const agentName =
        'targetAgent' in event.item &&
        typeof event.item.targetAgent?.name === 'string'
          ? event.item.targetAgent.name
          : undefined;
      return {
        type: 'status',
        phase: 'handoff',
        message: agentName ? `Handed off to ${agentName}` : 'Handoff complete',
        ...(agentName ? { detail: agentName } : {}),
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

  private readableName(value: string): string {
    return value.replaceAll(/[_-]+/g, ' ').trim();
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
