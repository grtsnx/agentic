import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Valyu } from 'valyu-js';
import { valyuSearchSchema, type WebToolOptions, WebToolError } from '@/config';

@Injectable()
export class ValyuService {
  constructor(private readonly config: ConfigService) {}

  async search(query: string, options: WebToolOptions) {
    const client = new Valyu(
      this.config.getOrThrow<string>('VALYU_API_KEY'),
      undefined,
      {
        timeout: options.timeoutMs,
        maxRateLimitRetries: 0,
      },
    );
    const response = await client.search(query, {
      searchType: 'web',
      maxNumResults: options.maxResults,
      responseLength: 'short',
      isToolCall: true,
      ...(options.domains.length ? { includedSources: options.domains } : {}),
    });
    // Valyu returns failure envelopes instead of throwing HTTP errors.
    if (response?.success === false) {
      const error = response.error ?? '';
      if (response.rateLimit || /rate.?limit|\b429\b/i.test(error))
        throw new WebToolError('TOOL_RATE_LIMITED');
      if (
        /unauthori[sz]ed|invalid.*(?:key|token)|authentication|\b40[13]\b/i.test(
          error,
        )
      )
        throw new WebToolError('TOOL_AUTHENTICATION_FAILED');
      if (/timeout|timed out/i.test(error))
        throw new WebToolError('TOOL_TIMEOUT');
      throw new WebToolError('TOOL_UNAVAILABLE');
    }
    return valyuSearchSchema.parse(response).results;
  }
}
