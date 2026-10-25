import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

const runSmoke = process.env.RUN_PROVIDER_SMOKE === 'true' ? it : it.skip;

describe('OpenAI provider smoke test', () => {
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
