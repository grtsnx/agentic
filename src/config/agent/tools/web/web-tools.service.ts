import type { WebSource, WebToolOptions, ToolAudit } from '@/config';
import { auditedTool } from '../tool-policy.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// These leaf imports prevent config → lib → OpenAI → config initialization cycles.
import { ContextDevService } from '../../../../lib/context-dev/context-dev.service.js';
import { FirecrawlService } from '../../../../lib/firecrawl/firecrawl.service.js';
import { ValyuService } from '../../../../lib/valyu/valyu.service.js';

import { WEB_TOOL_DESCRIPTIONS } from './web-tool.instructions.js';
import {
  webPagesSchema,
  webToolInputSchema,
} from '../../../schema/web-tools/web-tool.schema.js';
import {
  publicPageUrl,
  WebToolError,
  webToolFailure,
  withinToolDeadline,
} from './web-tool.policy.js';

@Injectable()
export class WebToolsService {
  constructor(
    private readonly config: ConfigService,
    private readonly context: ContextDevService,
    private readonly firecrawl: FirecrawlService,
    private readonly valyu: ValyuService,
  ) {}

  // The standalone LiveKit worker shares the Nest adapters without starting an HTTP app.
  static fromEnvironment(environment: Record<string, unknown>) {
    const config = new ConfigService(environment);
    return new WebToolsService(
      config,
      new ContextDevService(config),
      new FirecrawlService(config),
      new ValyuService(config),
    );
  }

  createTools(onSources: (sources: WebSource[]) => void = () => {}, onAudit?: (event: ToolAudit) => void, scopeId = 'transient', traceId = 'transient') {
    let calls = 0;
    const definitions = [
      {
        name: 'context_dev_search',
        provider: 'context.dev',
        flag: 'CONTEXT_DEV',
        description: WEB_TOOL_DESCRIPTIONS.context_dev_search,
        read: false,
        execute: (input: string, options: WebToolOptions) =>
          this.context.search(input, options),
      },
      {
        name: 'firecrawl_read_page',
        provider: 'firecrawl',
        flag: 'FIRECRAWL',
        description: WEB_TOOL_DESCRIPTIONS.firecrawl_read_page,
        read: true,
        execute: (input: string, options: WebToolOptions) =>
          this.firecrawl.read(input, options),
      },
      {
        name: 'valyu_search',
        provider: 'valyu',
        flag: 'VALYU',
        description: WEB_TOOL_DESCRIPTIONS.valyu_search,
        read: false,
        execute: (input: string, options: WebToolOptions) =>
          this.valyu.search(input, options),
      },
    ];
    const enabled = definitions.filter(
      ({ flag }) =>
        this.config.get<boolean>(`${flag}_ENABLED`) === true &&
        Boolean(this.config.get<string>(`${flag}_API_KEY`)),
    );
    const hasContext = enabled.some(
      (tool) => tool.name === 'context_dev_search',
    );
    const hasValyu = enabled.some((tool) => tool.name === 'valyu_search');
    return enabled.map((definition) => ({
      name: definition.name,
      description:
        definition.description +
        (definition.name === 'valyu_search' && !hasContext
          ? ' Context.dev is currently disabled: this is the active search provider for general lookups, current news, and discovering documentation URLs.'
          : definition.name === 'context_dev_search' && !hasValyu
            ? ' Valyu is currently disabled: this is the active search provider for research and evidence comparisons as well as ordinary lookups.'
            : ''),
      parameters: webToolInputSchema,
      execute: async (args: unknown, external?: AbortSignal) => auditedTool(scopeId, traceId, definition.name, args, onAudit ?? (() => {}), async () => {
        try {
          const parsed = webToolInputSchema.safeParse(args);
          if (!parsed.success) throw new WebToolError('TOOL_INPUT_INVALID');
          const domains =
            this.config.get<string[]>('WEB_SEARCH_ALLOWED_DOMAINS') ?? [];
          const url = definition.read
            ? publicPageUrl(parsed.data.input, domains)
            : undefined;
          if (definition.read && !url)
            throw new WebToolError('TOOL_INPUT_INVALID');
          external?.throwIfAborted();
          if (
            calls >= (this.config.get<number>('EXTERNAL_TOOLS_MAX_CALLS') ?? 5)
          )
            throw new WebToolError('TOOL_LIMIT_REACHED');
          // Reserve synchronously before awaiting so parallel calls share one budget.
          calls++;
          const timeoutMs =
            this.config.get<number>('EXTERNAL_TOOLS_TIMEOUT_MS') ?? 15_000;
          const timeout = AbortSignal.timeout(timeoutMs);
          const signal = external
            ? AbortSignal.any([external, timeout])
            : timeout;
          const maxResults =
            this.config.get<number>('EXTERNAL_TOOLS_MAX_RESULTS') ?? 5;
          const raw = await withinToolDeadline(signal, () =>
            definition.execute(url?.href ?? parsed.data.input, {
              timeoutMs,
              maxResults,
              domains,
              signal,
            }),
          );
          const pages = webPagesSchema.parse(raw);
          let remaining =
            this.config.get<number>('EXTERNAL_TOOLS_MAX_CHARS') ?? 12_000;
          const results = [];
          const seen = new Set<string>();
          for (const page of pages) {
            const sourceUrl = publicPageUrl(page.url, domains);
            if (
              !sourceUrl ||
              seen.has(sourceUrl.href) ||
              !remaining ||
              results.length >= maxResults
            )
              continue;
            seen.add(sourceUrl.href);
            const content = page.content.slice(0, remaining);
            remaining -= content.length;
            results.push({
              title: page.title.slice(0, 300),
              url: sourceUrl.href,
              domain: sourceUrl.hostname,
              content,
              truncated: content.length < page.content.length,
            });
          }
          onSources(
            results.map(({ title, url, domain }) => ({ title, url, domain })),
          );
          return {
            ok: true as const,
            provider: definition.provider,
            contentTrust: 'untrusted' as const,
            results,
          };
        } catch (error) {
          return webToolFailure(error);
        }
      }),
    }));
  }
}
