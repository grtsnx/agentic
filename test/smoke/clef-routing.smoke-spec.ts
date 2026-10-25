import { mkdir, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { ClefService } from '@/lib';
import {
  validateEnvironment,
  routeOpenaiModel,
  CLEF_INPUT_USD_PER_MILLION,
} from '@/config';
import { clefCases } from '../fixtures/routing/clef-cases.js';

const benchmark = process.env.RUN_CLEF_BENCHMARK === 'true' ? it : it.skip;
describe('live Clef routing benchmark', () => {
  benchmark(
    'measures real decisions, usage and rollout gates without generating answers',
    async () => {
      if (
        !process.env.CLOUDFLARE_ACCOUNT_ID ||
        !process.env.CLOUDFLARE_API_TOKEN
      )
        throw new Error(
          'Add Cloudflare credentials to .env before running this paid benchmark.',
        );
      const config = validateEnvironment({
        ...process.env,
        CLEF_ROUTING_ENABLED: true,
      });
      const service = new ClefService(new ConfigService(config));
      const cases = [];
      // Repeated rounds expose provider variability; rotating order reduces cold-start bias.
      for (let round = 0; round < 3; round++)
        for (let index = 0; index < clefCases.length; index++) {
          const item = clefCases[(index + round * 7) % clefCases.length]!;
          const localStart = performance.now();
          const localModel = routeOpenaiModel(item.message, item.context);
          const localDurationMs = performance.now() - localStart;
          const result = await service.route(item.message, item.context);
          cases.push({
            id: item.id,
            round,
            expected: item.expected,
            localModel,
            localDurationMs,
            ...result,
          });
        }
      const percentile = (values: number[], p: number) =>
        [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]!;
      const classified = cases.filter((item) => item.source === 'clef');
      const accuracy = (rows: typeof cases, key: 'model' | 'localModel') =>
        rows.filter((item) => item[key] === item.expected).length / rows.length;
      const measuredUsage = cases.filter((item) => item.usage !== undefined);
      const metrics = {
        count: cases.length,
        uniqueCases: clefCases.length,
        rounds: 3,
        localAccuracy: accuracy(cases, 'localModel'),
        effectiveAccuracy: accuracy(cases, 'model'),
        classifierAccuracy: classified.length
          ? accuracy(classified, 'model')
          : null,
        fallbackRate: 1 - classified.length / cases.length,
        fallbackReasons: Object.fromEntries(
          [
            ...new Set(
              cases
                .filter((item) => item.source === 'local')
                .map((item) => item.reason),
            ),
          ].map((reason) => [
            reason,
            cases.filter((item) => item.reason === reason).length,
          ]),
        ),
        p50Ms: percentile(
          cases.map((item) => item.durationMs),
          0.5,
        ),
        p95Ms: percentile(
          cases.map((item) => item.durationMs),
          0.95,
        ),
        localP95Ms: percentile(
          cases.map((item) => item.localDurationMs),
          0.95,
        ),
        complexTaskDowngrades: cases.filter(
          (item) =>
            item.expected === 'gpt-6-luna' && item.model !== 'gpt-6-luna',
        ).length,
      };
      const cost = {
        inputTokens: measuredUsage.reduce(
          (sum, item) => sum + item.usage!.input_tokens,
          0,
        ),
        outputTokens: measuredUsage.reduce(
          (sum, item) => sum + item.usage!.output_tokens,
          0,
        ),
        measuredRequests: measuredUsage.length,
        unknownRequests: cases.length - measuredUsage.length,
        knownEstimatedUsd: measuredUsage.reduce(
          (sum, item) => sum + (item.estimatedCostUsd ?? 0),
          0,
        ),
        inputUsdPerMillion: CLEF_INPUT_USD_PER_MILLION,
        pricingSource:
          'https://developers.cloudflare.com/workers-ai/models/clef-flash/',
        billedCostUsd: null,
        billingVerified: false,
        caveat:
          'List-price estimate only. Missing or timed-out responses may still be charged. Free allocation and invoice charges require separate Cloudflare billing reconciliation.',
      };
      const gates = {
        accuracy: metrics.effectiveAccuracy >= 0.95,
        nonRegression: metrics.effectiveAccuracy >= metrics.localAccuracy,
        noComplexTaskDowngrades: metrics.complexTaskDowngrades === 0,
        fallback: metrics.fallbackRate <= 0.1,
        latency: metrics.p95Ms <= 1000,
        usage: cost.unknownRequests === 0,
        billing: cost.billingVerified,
      };
      const report = {
        timestamp: new Date().toISOString(),
        ...metrics,
        cost,
        gates,
        eligibleForDefault: Object.values(gates).every(Boolean),
        cases,
      };
      await mkdir('.tmp', { recursive: true });
      await writeFile(
        '.tmp/clef-routing-benchmark.json',
        JSON.stringify(report, null, 2) + '\n',
        { mode: 0o600 },
      );
      console.info(JSON.stringify({ ...report, cases: undefined }));
      expect(
        classified.length,
        'Fallback-only results cannot validate Clef.',
      ).toBeGreaterThan(0);
      expect(
        Object.values(gates).every(Boolean),
        'Keep Clef opt-in: rollout gates failed. See .tmp/clef-routing-benchmark.json.',
      ).toBe(true);
    },
    300000,
  );
});
