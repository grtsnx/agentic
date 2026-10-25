import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Agent, MemorySession, run } from '@openai/agents';
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

const MODEL_NAME = 'gpt-6-astra';
const TOKENS_PER_MILLION = 1_000_000;

// GPT-6 Astra uses higher standard-tier rates when one request exceeds this input size.
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
  private readonly agent = new Agent({
    name: 'History tutor',
    instructions: 'You answer history questions clearly and concisely.',
    model: MODEL_NAME,
    outputType: openaiOutputSchema,
  });

  private readonly streamingAgent = new Agent({
    name: 'History tutor',
    instructions: 'You answer history questions clearly and concisely.',
    model: MODEL_NAME,
  });

  createSession(): MemorySession {
    return new MemorySession();
  }

  async generateReply(message: string): Promise<OpenaiResponse> {
    const result = await run(this.agent, message);
    if (!result.finalOutput) {
      throw new ServiceUnavailableException(
        'The AI provider returned no structured output',
      );
    }

    // Validate model-controlled data before attaching server-controlled runtime metadata.
    const output = openaiOutputSchema.parse(result.finalOutput);

    return openaiResponseSchema.parse({
      ...output,
      runtime: this.buildRuntime(result),
    });
  }

  async *streamReply(
    message: string,
    options: OpenaiStreamOptions = {},
  ): AsyncGenerator<OpenaiStreamEvent> {
    const stream = await run(this.streamingAgent, message, {
      stream: true,
      session: options.session,
      signal: options.signal,
    });

    for await (const event of stream) {
      if (
        event.type === 'raw_model_stream_event' &&
        event.data.type === 'output_text_delta'
      ) {
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
        runtime: this.buildRuntime(stream),
      }),
    };
  }

  private buildRuntime(result: RuntimeSource): OpenaiRuntime {
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
          : MODEL_NAME;
      }),
    );

    return {
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
        estimatedUsd: this.estimateModelCost(usage),
        currency: 'USD',
        exact: false,
        // Tool pricing varies by tool, so the model estimate covers the full run only without tools.
        includesToolCosts: tools.length === 0,
      },
      models:
        models.length > 0
          ? models
          : [{ name: MODEL_NAME, calls: usage.requests }],
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

  private estimateModelCost(usage: {
    inputTokens: number;
    outputTokens: number;
    inputTokensDetails: TokenDetails[];
  }): number {
    // Rates are USD per one million tokens for GPT-6 Astra's standard tier.
    // This is an estimate because the Agents SDK does not return the invoiced amount.
    const cachedInput = this.sumTokenDetail(
      usage.inputTokensDetails,
      'cached_tokens',
    );
    const uncachedInput = Math.max(0, usage.inputTokens - cachedInput);
    const longContext = usage.inputTokens > LONG_CONTEXT_THRESHOLD;
    const inputRate = longContext ? 20 : 10;
    const cachedInputRate = longContext ? 2 : 1;
    const outputRate = longContext ? 75 : 50;
    const estimate =
      (uncachedInput * inputRate +
        cachedInput * cachedInputRate +
        usage.outputTokens * outputRate) /
      TOKENS_PER_MILLION;

    return Number(estimate.toFixed(8));
  }
}
