import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Firecrawl } from 'firecrawl';
import { firecrawlPageSchema, type WebToolOptions } from '@/config';

@Injectable()
export class FirecrawlService {
  constructor(private readonly config: ConfigService) {}

  async read(url: string, options: WebToolOptions) {
    const client = new Firecrawl({
      apiKey: this.config.getOrThrow<string>('FIRECRAWL_API_KEY'),
      timeoutMs: options.timeoutMs,
      // In Firecrawl 4.51, this counts total attempts; 1 sends once without retrying.
      maxRetries: 1,
    });
    const page = firecrawlPageSchema.parse(
      await client.scrape(url, {
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: options.timeoutMs,
        // Do not poll a billable scrape after the configured request deadline.
        autoResume: false,
      }),
    );
    return [
      {
        title: page.metadata?.title ?? new URL(url).hostname,
        url: page.metadata?.sourceURL ?? url,
        content: page.markdown,
      },
    ];
  }
}
