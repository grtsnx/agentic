import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CLEF_QUESTION,
  OPENAI_MODELS,
  clefResponseSchema,
  routeOpenaiModel,
  type ModelRoutingDecision,
  type OpenaiRoutingContext,
} from '@/config';

@Injectable()
export class ClefService {
  private active = 0;
  constructor(private readonly config: ConfigService) {}

  async route(
    message: string,
    context: OpenaiRoutingContext = {},
    signal?: AbortSignal,
  ): Promise<ModelRoutingDecision> {
    signal?.throwIfAborted();
    const started = performance.now();
    const local = routeOpenaiModel(message, context);
    const fallback = (
      reason: ModelRoutingDecision['reason'],
      probability?: number,
    ): ModelRoutingDecision => ({
      model: local,
      source: 'local',
      reason,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      estimatedCostUsd: null,
      ...(probability === undefined ? {} : { probability }),
    });
    if (!this.config.get<boolean>('CLEF_ROUTING_ENABLED', false))
      return fallback('disabled');
    const account = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.config.get<string>('CLOUDFLARE_API_TOKEN');
    if (!account || !token || !/^[a-f\d]{32}$/i.test(account))
      return fallback('credentials_missing');
    if (this.active >= 8) return fallback('busy');
    this.active++;
    const timeout = new AbortController();
    const timer = setTimeout(
      () => timeout.abort(),
      this.config.get<number>('CLEF_ROUTING_TIMEOUT_MS', 3000),
    );
    const combined = AbortSignal.any([
      timeout.signal,
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/accounts/' +
          account +
          '/ai/run/@cf/cloudflare/clef-flash',
        {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          signal: combined,
          body: JSON.stringify({
            model: 'clef-flash',
            state: {
              message: message.slice(0, 8000),
              recentUserMessages: (context.recentUserMessages ?? [])
                .slice(-6)
                .map((value) => value.slice(0, 1000)),
              hasAttachments: !!context.hasAttachments,
            },
            questions: { needs_complex: CLEF_QUESTION },
          }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        return fallback('provider_error');
      }
      let payload: unknown;
      try {
        payload = await this.readResponse(response);
      } catch {
        combined.throwIfAborted();
        return fallback('invalid_response');
      }
      const parsed = clefResponseSchema.safeParse(payload);
      if (!parsed.success) return fallback('invalid_response');
      const probability = parsed.data.result.answers.needs_complex.noul;
      const confidence = this.config.get<number>(
        'CLEF_ROUTING_CONFIDENCE',
        0.75,
      );
      if (probability > 1 - confidence && probability < confidence)
        return fallback('uncertain', probability);
      combined.throwIfAborted();
      return {
        model:
          probability >= confidence
            ? OPENAI_MODELS.complex
            : OPENAI_MODELS.economical,
        source: 'clef',
        reason: 'classified',
        probability,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        estimatedCostUsd: null,
      };
    } catch {
      // Cancellation stops the whole turn. Provider faults only disable this optional decision.
      signal?.throwIfAborted();
      return fallback(timeout.signal.aborted ? 'timeout' : 'provider_error');
    } finally {
      clearTimeout(timer);
      this.active--;
    }
  }

  private async readResponse(response: Response): Promise<unknown> {
    if (!response.body) throw new Error('Missing response');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 32768) throw new Error('Response too large');
        text += decoder.decode(part.value, { stream: true });
      }
      return JSON.parse(text + decoder.decode());
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
