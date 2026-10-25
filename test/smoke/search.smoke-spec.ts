import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

const runSmoke = process.env.RUN_SEARCH_SMOKE === 'true' ? it : it.skip;

describe('live hosted search progress', () => {
  runSmoke(
    'reports search before answer text and returns cited results without an introduction',
    async () => {
      const environment = validateEnvironment({
        ...process.env,
        WEB_SEARCH_ENABLED: true,
      });
      if (!environment.OPENAI_API_KEY)
        throw new Error('OPENAI_API_KEY is required');
      // Omit optional adapters to exercise the hosted search event stream directly.
      const service = new OpenaiService(new ConfigService(environment));
      const started = performance.now();
      const progress: Array<{ message: string; elapsedMs: number }> = [];
      let searching = false;
      let sawText = false;
      let completed = false;
      for await (const event of service.streamReply(
        'Search the web for the official NestJS documentation URL. Answer in one sentence with a citation.',
        { signal: AbortSignal.timeout(45_000) },
      )) {
        if (event.type === 'status') {
          progress.push({
            message: event.message,
            elapsedMs: Math.round(performance.now() - started),
          });
          if (event.message === 'Searching the web') searching = true;
        }
        if (event.type === 'delta' && event.delta.trim()) {
          expect(searching).toBe(true);
          sawText = true;
        }
        if (event.type === 'completed') {
          expect(sawText).toBe(true);
          expect(event.response.sources.length).toBeGreaterThan(0);
          expect(event.response.message).not.toMatch(
            /^(?:hi|hello|hey)\b|^(?:I['’]m|I am) Agentic|^Agentic:/i,
          );
          console.info(
            JSON.stringify({
              progress,
              durationMs: event.response.runtime.durationMs,
              tokens: event.response.runtime.tokens.total,
              sources: event.response.sources.length,
            }),
          );
          completed = true;
        }
      }
      expect(completed).toBe(true);
    },
    60_000,
  );
});
