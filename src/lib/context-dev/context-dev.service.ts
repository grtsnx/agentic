import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ContextDev from 'context.dev';
import { contextSearchSchema, type WebToolOptions } from '@/config/schema';

@Injectable()
export class ContextDevService {
  constructor(private readonly config: ConfigService) {}

  async search(query: string, options: WebToolOptions) {
    const client = new ContextDev({
      apiKey: this.config.getOrThrow<string>('CONTEXT_DEV_API_KEY'),
      timeout: options.timeoutMs,
      maxRetries: 0,
    });
    const response = contextSearchSchema.parse(
      await client.web.search(
        {
          query,
          numResults: options.maxResults,
          descriptionMaxCharacters: 2_000,
          ...(options.domains.length
            ? { includeDomains: options.domains }
            : {}),
        },
        { signal: options.signal },
      ),
    );
    return response.results.map(({ title, url, description }) => ({
      title,
      url,
      content: description,
    }));
  }
}
