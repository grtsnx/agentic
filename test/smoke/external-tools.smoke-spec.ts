import { validateEnvironment } from '@/config';
import { WebToolsService } from '@/config/web-tools';
import type { Environment, WebSource } from '@/config/schema';

const runSmoke = process.env.RUN_EXTERNAL_TOOLS_SMOKE === 'true' ? it : it.skip;

describe('optional external provider smoke test', () => {
  let environment: Environment;

  beforeAll(() => {
    if (process.env.RUN_EXTERNAL_TOOLS_SMOKE !== 'true') return;
    environment = validateEnvironment({
      ...process.env,
      WEB_SEARCH_ALLOWED_DOMAINS: 'example.com',
    });
    const tools = WebToolsService.fromEnvironment({
      ...environment,
    }).createTools();
    if (!tools.length)
      throw new Error(
        'Enable at least one external provider and configure its API key in .env.',
      );
  });

  // Separate cases ensure a failing provider cannot hide results from the others.
  runSmoke.for(['context_dev_search', 'firecrawl_read_page', 'valyu_search'])(
    '%s returns real content and source metadata',
    { timeout: 70_000 },
    async (name, context) => {
      const sources: WebSource[] = [];
      const tool = WebToolsService.fromEnvironment({ ...environment })
        .createTools((found) => sources.push(...found))
        .find((tool) => tool.name === name);
      if (!tool) {
        context.skip();
        return;
      }
      const startedAt = performance.now();
      const result = await tool.execute({
        input:
          tool.name === 'firecrawl_read_page'
            ? 'https://example.com'
            : 'Example Domain site:example.com',
      });
      if (!result.ok) throw new Error(`${tool.name}: ${result.error.code}`);
      expect(
        result.results.length,
        `${tool.name} returned no public sources`,
      ).toBeGreaterThan(0);
      expect(
        result.results.some((source) => source.content.trim().length > 0),
      ).toBe(true);
      expect(sources).toEqual(
        result.results.map(({ title, url, domain }) => ({
          title,
          url,
          domain,
        })),
      );
      for (const source of sources) {
        expect(source.title.trim()).not.toBe('');
        expect(new URL(source.url).hostname).toBe(source.domain);
        expect(
          source.domain === 'example.com' ||
            source.domain.endsWith('.example.com'),
        ).toBe(true);
      }
      console.info(
        JSON.stringify({
          tool: tool.name,
          sources: result.results.length,
          durationMs: Math.round(performance.now() - startedAt),
          status: 'passed',
        }),
      );
    },
  );
});
