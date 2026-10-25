import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Agent, run } from '@openai/agents';
import {
  openaiOutputSchema,
  openaiResponseSchema,
  type OpenaiResponse,
} from './schema/openai-output.schema.js';

const MODEL_NAME = 'gpt-6-astra';
const TOKENS_PER_MILLION = 1_000_000;
const LONG_CONTEXT_THRESHOLD = 272_000;

interface TokenDetails {
  [key: string]: number | TokenDetails;
}

@Injectable()
export class OpenaiService {
  private readonly agent = new Agent({
    name: 'History tutor',
    instructions: 'You answer history questions clearly and concisely.',
    model: MODEL_NAME,
    outputType: openaiOutputSchema,
  });

  async generateReply(message: string): Promise<OpenaiResponse> {
    const result = await run(this.agent, message);
    if (!result.finalOutput) {
      throw new ServiceUnavailableException(
        'The AI provider returned no structured output',
      );
    }

    const output = openaiOutputSchema.parse(result.finalOutput);
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

    return openaiResponseSchema.parse({
      ...output,
      runtime: {
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
          includesToolCosts: tools.length === 0,
        },
        models:
          models.length > 0
            ? models
            : [{ name: MODEL_NAME, calls: usage.requests }],
        tools,
      },
    });
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
