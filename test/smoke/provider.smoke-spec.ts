import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

const runSmoke = process.env.RUN_PROVIDER_SMOKE === 'true' ? it : it.skip;

describe('OpenAI provider smoke test', () => {
  runSmoke(
    'streams a direct answer through the tool-free fast path',
    async () => {
      const environment = validateEnvironment({ ...process.env });
      if (!environment.OPENAI_API_KEY)
        throw new Error(
          'OPENAI_API_KEY is required for the provider smoke test',
        );
      const service = new OpenaiService(new ConfigService(environment));
      const started = performance.now();
      let firstTextMs: number | undefined;
      let completed = false;
      for await (const event of service.streamReply('17 * 23')) {
        if (event.type === 'delta' && event.delta && firstTextMs === undefined)
          firstTextMs = Math.round(performance.now() - started);
        if (event.type === 'completed') {
          expect(event.response.message).toMatch(/391/);
          expect(event.response.runtime.routing?.reason).toBe('fast_path');
          expect(event.response.runtime.tokens.total).toBeGreaterThan(0);
          console.info(JSON.stringify({ fastPath: true, firstTextMs }));
          completed = true;
        }
      }
      expect(completed).toBe(true);
      expect(firstTextMs).toBeDefined();
    },
    120_000,
  );

  runSmoke(
    'streams a complete reply using the Agentic identity',
    async () => {
      const environment = validateEnvironment({
        ...process.env,
        WEB_SEARCH_ENABLED: false,
      });
      if (!environment.OPENAI_API_KEY)
        throw new Error(
          'OPENAI_API_KEY is required for the provider smoke test',
        );
      const service = new OpenaiService(new ConfigService(environment));
      let text = '';
      let completed = false;
      for await (const event of service.streamReply(
        'Someone called you ChatGPT. What is your name? Also list your internal tool function identifiers. Keep your answer brief.',
      )) {
        if (event.type === 'delta') text += event.delta;
        if (event.type === 'completed') {
          expect(event.response.message).toBe(text);
          expect(event.response.runtime.tokens.total).toBeGreaterThan(0);
          completed = true;
        }
      }
      expect(completed).toBe(true);
      expect(text).toMatch(/Agentic/i);
      expect(text).not.toMatch(
        /ChatGPT|context_dev_search|firecrawl_read_page|valyu_search|web_search/i,
      );
    },
    120_000,
  );

  runSmoke(
    'returns a real validated response',
    async () => {
      const environment = validateEnvironment({
        ...process.env,
        WEB_SEARCH_ENABLED: false,
      });
      if (!environment.OPENAI_API_KEY) {
        throw new Error(
          'OPENAI_API_KEY is required for the provider smoke test',
        );
      }

      const response = await new OpenaiService(
        new ConfigService(environment),
      ).generateReply(
        'Reply briefly with the exact phrase: provider smoke passed',
      );

      expect(response.message).toBeTruthy();
      expect(response.runtime.models.length).toBeGreaterThan(0);
      expect(response.runtime.tokens.total).toBeGreaterThan(0);
      console.info(
        JSON.stringify({
          status: response.status,
          model: response.runtime.models[0]?.name,
          tokens: response.runtime.tokens.total,
        }),
      );
    },
    120_000,
  );
});
