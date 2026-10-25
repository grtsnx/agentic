import { mkdir, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { ClefService } from '@/lib';
import { validateEnvironment, routeOpenaiModel } from '@/config';
import { clefCases } from '../fixtures/routing/clef-cases.js';

const benchmark = process.env.RUN_CLEF_BENCHMARK === 'true' ? it : it.skip;
describe('live Clef routing benchmark', () => {
  benchmark(
    'compares the classifier with local routing without generating answers or executing tools',
    async () => {
      if (
        !process.env.CLOUDFLARE_ACCOUNT_ID ||
        !process.env.CLOUDFLARE_API_TOKEN
      )
        throw new Error(
          'Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env before running the Clef benchmark.',
        );
      const config = validateEnvironment({
        ...process.env,
        CLEF_ROUTING_ENABLED: true,
      });
      const service = new ClefService(new ConfigService(config));
      const cases = [];
      for (const item of clefCases) {
        const result = await service.route(item.message, item.context);
        cases.push({
          id: item.id,
          expected: item.expected,
          localModel: routeOpenaiModel(item.message, item.context),
          ...result,
        });
      }
      const latency = cases
        .map((item) => item.durationMs)
        .sort((a, b) => a - b);
      const classified = cases.filter((item) => item.source === 'clef');
      const report = {
        timestamp: new Date().toISOString(),
        count: cases.length,
        localAccuracy:
          cases.filter((item) => item.localModel === item.expected).length /
          cases.length,
        effectiveAccuracy:
          cases.filter((item) => item.model === item.expected).length /
          cases.length,
        classifierAccuracy: classified.length
          ? classified.filter((item) => item.model === item.expected).length /
            classified.length
          : null,
        fallbackRate: 1 - classified.length / cases.length,
        p50Ms: latency[Math.ceil(latency.length * 0.5) - 1],
        p95Ms: latency[Math.ceil(latency.length * 0.95) - 1],
        classifierCost:
          'Not included in generation totals. Verify billed usage in Cloudflare.',
        cases,
      };
      await mkdir('.tmp', { recursive: true });
      await writeFile(
        '.tmp/clef-routing-benchmark.json',
        JSON.stringify(report, null, 2) + '\n',
        { mode: 0o600 },
      );
      console.info(
        JSON.stringify({
          ...report,
          cases: undefined,
          report: '.tmp/clef-routing-benchmark.json',
        }),
      );
      expect(
        classified.length,
        'No verified Clef decisions; fallback-only results are not a live benchmark.',
      ).toBeGreaterThan(0);
      expect(
        report.effectiveAccuracy,
        'Review the report before enabling Clef by default.',
      ).toBeGreaterThanOrEqual(0.85);
    },
    90000,
  );
});
