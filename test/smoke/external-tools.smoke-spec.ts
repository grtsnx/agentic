import { validateEnvironment } from '@/config';
import { WebToolsService } from '@/config/web-tools';

const runSmoke = process.env.RUN_EXTERNAL_TOOLS_SMOKE === 'true' ? it : it.skip;

describe('optional external provider smoke test', () => {
  runSmoke(
    'reads real sources with every enabled provider',
    async () => {
      const environment = validateEnvironment({
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
      for (const tool of tools) {
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
        console.info(
          JSON.stringify({
            tool: tool.name,
            sources: result.results.length,
            status: 'passed',
          }),
        );
      }
    },
    180_000,
  );
});
