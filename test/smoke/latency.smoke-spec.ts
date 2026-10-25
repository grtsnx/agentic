import { Agent, Runner } from '@openai/agents';
import { mkdir, writeFile } from 'node:fs/promises';
import { AGENT_INSTRUCTIONS, AGENT_NAME, OPENAI_MODELS } from '@/config';

const benchmark = process.env.RUN_LATENCY_BENCHMARK === 'true' ? it : it.skip;
const cases = [
  {
    id: 'fact',
    prompt: 'Who was the first Roman emperor? Reply with just his name.',
    check: /Augustus/i,
  },
  {
    id: 'arithmetic',
    prompt: 'What is 17 times 23? Reply with just the number.',
    check: /391/,
  },
  {
    id: 'rewrite',
    prompt:
      'Convert "tangerine seven" to uppercase. Return only those two words.',
    check: /^TANGERINE SEVEN[.!]?$/,
  },
  {
    id: 'extraction',
    prompt:
      'Extract the invoice total as just a number: subtotal 80, tax 8, total 88.',
    check: /^88[.!]?$/,
  },
];

describe('live economical model latency', () => {
  benchmark(
    'compares low and minimal reasoning with the shared Agentic instructions',
    async () => {
      const runner = new Runner({
        tracingDisabled: true,
        modelSettings: { maxTokens: 2048 },
      });
      const samples = [];
      // Alternate effort order to avoid attributing a warmed provider connection to one setting.
      for (let round = 0; round < 2; round++)
        for (const item of cases)
          for (const effort of (round
            ? ['minimal', 'low']
            : ['low', 'minimal']) as Array<'low' | 'minimal'>) {
            const agent = new Agent({
              name: AGENT_NAME,
              instructions: AGENT_INSTRUCTIONS,
              model: OPENAI_MODELS.economical,
              modelSettings: { reasoning: { effort } },
            });
            const start = performance.now();
            let firstTokenMs: number | undefined;
            let text = '';
            const result = await runner.run(agent, item.prompt, {
              stream: true,
              maxTurns: 1,
              signal: AbortSignal.timeout(30000),
            });
            for await (const event of result)
              if (
                event.type === 'raw_model_stream_event' &&
                event.data.type === 'output_text_delta'
              ) {
                firstTokenMs ??= Math.round(performance.now() - start);
                text += event.data.delta;
              }
            await result.completed;
            samples.push({
              id: item.id,
              round,
              effort,
              firstTokenMs,
              totalMs: Math.round(performance.now() - start),
              correct: item.check.test(text.trim()),
              tokens: result.state.usage.totalTokens,
            });
          }
      const summary = Object.fromEntries(
        ['low', 'minimal'].map((effort) => {
          const rows = samples.filter((row) => row.effort === effort);
          const first = rows
            .map((row) => row.firstTokenMs ?? row.totalMs)
            .sort((a, b) => a - b);
          return [
            effort,
            {
              samples: rows.length,
              correct: rows.filter((row) => row.correct).length,
              p50FirstTokenMs: first[Math.ceil(first.length * 0.5) - 1],
              p95FirstTokenMs: first[Math.ceil(first.length * 0.95) - 1],
            },
          ];
        }),
      );
      await mkdir('.tmp', { recursive: true });
      await writeFile(
        '.tmp/response-latency-benchmark.json',
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            model: OPENAI_MODELS.economical,
            summary,
            samples,
          },
          null,
          2,
        ) + '\n',
        { mode: 0o600 },
      );
      expect(samples.every((row) => row.correct)).toBe(true);
    },
    240000,
  );
});
