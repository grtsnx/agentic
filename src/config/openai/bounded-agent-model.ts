import type {
  Model,
  ModelRequest,
  ModelResponse,
  StreamEvent,
} from '@openai/agents';

// One wrapper is shared by the manager and every nested specialist. Reservations
// include the serialized prompt/tools and capped output before each remote call.
export class BoundedAgentModel implements Model {
  private calls = 0;
  private reservedTokens = 0;
  private reservedUsd = 0;
  private active = false;
  readonly usage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedUsd: 0,
  };
  constructor(
    private readonly delegate: Model,
    private readonly signal: AbortSignal,
  ) {}
  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    this.signal.throwIfAborted();
    if (this.active) throw new Error('DELEGATION_PARALLEL_LIMIT');
    // No remote conversation IDs: all context must be visible to the budget check.
    if (request.previousResponseId || request.conversationId)
      throw new Error('DELEGATION_HIDDEN_CONTEXT');
    const input =
      Buffer.byteLength(
        JSON.stringify({
          input: request.input,
          instructions: request.systemInstructions,
          tools: request.tools,
          handoffs: request.handoffs,
          output: request.outputType,
        }),
      ) + 512;
    const output = 1_200;
    const usd = (input * 0.05 + output * 0.4) / 1_000_000;
    if (
      this.calls >= 8 ||
      this.reservedTokens + input + output > 40_000 ||
      this.reservedUsd + usd > 0.02
    )
      throw new Error('DELEGATION_BUDGET_EXCEEDED');
    this.calls++;
    this.reservedTokens += input + output;
    this.reservedUsd += usd;
    this.active = true;
    try {
      const response = await this.delegate.getResponse({
        ...request,
        signal: request.signal
          ? AbortSignal.any([request.signal, this.signal])
          : this.signal,
        modelSettings: {
          ...request.modelSettings,
          maxTokens: output,
          parallelToolCalls: false,
          reasoning: { effort: 'low' },
        },
      });
      const usage = response.usage;
      this.usage.inputTokens += usage.inputTokens;
      this.usage.outputTokens += usage.outputTokens;
      this.usage.totalTokens += usage.totalTokens;
      this.usage.estimatedUsd +=
        (usage.inputTokens * 0.05 + usage.outputTokens * 0.4) / 1_000_000;
      return response;
    } finally {
      this.active = false;
    }
  }
  getStreamedResponse(_request: ModelRequest): AsyncIterable<StreamEvent> {
    throw new Error('DELEGATION_STREAMING_UNSUPPORTED');
  }
}
