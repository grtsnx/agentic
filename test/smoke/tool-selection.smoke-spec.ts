import { Agent, Runner, tool } from '@openai/agents';
import {
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
} from '@/config/agent/agent-instructions.js';
import { validateEnvironment } from '@/config/environment.js';
import { WebToolsService } from '@/config/web-tools';
import { OPENAI_MODELS } from '@/lib/openai/openai-model-router.js';
import { mapProviderError } from '@/lib/openai/provider-error.js';

const runSmoke = process.env.RUN_TOOL_SELECTION_SMOKE === 'true' ? it : it.skip;
interface SelectionCase {
  name: string;
  prompt: string;
  expected: string[];
  preferred?: string;
  disabled: string;
  expectedReadUrl?: string;
}
const cases: SelectionCase[] = [
  {
    name: 'greeting needs no web tool',
    prompt: 'Hello! How are you?',
    expected: [],
    disabled: '',
  },
  {
    name: 'general lookup uses a suitable search provider',
    prompt:
      "Find today's top technology news headline online and give me its source link.",
    expected: ['context_dev_search', 'valyu_search'],
    preferred: 'context_dev_search',
    disabled: '',
  },
  {
    name: 'specific page uses Firecrawl',
    prompt: 'Read https://example.com and summarize the page in one sentence.',
    expected: ['firecrawl_read_page'],
    expectedReadUrl: 'https://example.com/',
    disabled: '',
  },
  {
    name: 'research uses a suitable search provider',
    prompt:
      'Research and compare evidence from multiple sources about retrieval-augmented generation versus fine-tuning. Start by finding relevant sources.',
    expected: ['valyu_search', 'context_dev_search'],
    preferred: 'valyu_search',
    disabled: '',
  },
  {
    name: 'general lookup falls back when Context.dev is disabled',
    prompt:
      "Find today's top technology news headline online and give me its source link.",
    expected: ['valyu_search'],
    disabled: 'CONTEXT_DEV',
  },
  {
    name: 'research falls back when Valyu is disabled',
    prompt:
      'Research and compare evidence from multiple sources about retrieval-augmented generation versus fine-tuning. Start by finding relevant sources.',
    expected: ['context_dev_search'],
    disabled: 'VALYU',
  },
  {
    name: 'known official documentation can be searched or read directly',
    prompt:
      'Find the official Node.js URL parsing documentation online and give me its link.',
    expected: ['valyu_search', 'firecrawl_read_page'],
    expectedReadUrl: 'https://nodejs.org/api/url.html',
    disabled: 'CONTEXT_DEV',
  },
];

describe('live model tool selection', () => {
  runSmoke.for(cases)(
    '$name',
    { timeout: 45_000 },
    async ({
      name,
      prompt,
      expected,
      preferred,
      disabled,
      expectedReadUrl,
    }) => {
      if (!process.env.OPENAI_API_KEY?.trim())
        throw new Error(
          'OPENAI_API_KEY is required for tool-selection smoke tests.',
        );
      const environment = validateEnvironment({
        CONTEXT_DEV_ENABLED: disabled !== 'CONTEXT_DEV',
        CONTEXT_DEV_API_KEY: 'selection-fixture',
        FIRECRAWL_ENABLED: true,
        FIRECRAWL_API_KEY: 'selection-fixture',
        VALYU_ENABLED: disabled !== 'VALYU',
        VALYU_API_KEY: 'selection-fixture',
      });
      const calls: string[] = [];
      const inputs: string[] = [];
      const definitions = WebToolsService.fromEnvironment({
        ...environment,
      }).createTools();
      const agent = new Agent({
        name: AGENT_NAME,
        instructions: AGENT_INSTRUCTIONS,
        model: OPENAI_MODELS.economical,
        modelSettings: {
          // Match the application's default reasoning instead of weakening the eval.
          maxTokens: 1_500,
          parallelToolCalls: false,
        },
        toolUseBehavior: 'stop_on_first_tool',
        tools: definitions.map((definition) =>
          tool({
            name: definition.name,
            description: definition.description,
            parameters: definition.parameters,
            // Real model, fixture tool outputs: evaluate selection without paying search providers.
            execute: (input) => {
              calls.push(definition.name);
              inputs.push(input.input);
              return { ok: true, results: [] };
            },
          }),
        ),
      });
      const runner = new Runner({ tracingDisabled: true });
      try {
        await runner.run(agent, prompt, {
          maxTurns: 2,
          signal: AbortSignal.timeout(40_000),
        });
      } catch (error) {
        // Never print an SDK request object, which can contain headers or account data.
        const diagnostic = error as {
          name?: unknown;
          status?: unknown;
          code?: unknown;
        };
        console.error(
          JSON.stringify({
            scenario: name,
            errorType:
              typeof diagnostic?.name === 'string'
                ? diagnostic.name
                : 'unknown',
            httpStatus:
              typeof diagnostic?.status === 'number'
                ? diagnostic.status
                : undefined,
          }),
        );
        throw mapProviderError(error);
      }
      if (expected.length) {
        expect(calls).toHaveLength(1);
        expect(expected).toContain(calls[0]);
      } else {
        expect(calls).toEqual([]);
      }
      if (calls[0] === 'firecrawl_read_page' && expectedReadUrl) {
        const url = new URL(inputs[0]!);
        url.hash = '';
        expect(url.href).toBe(expectedReadUrl);
      }
      console.info(
        JSON.stringify({
          scenario: name,
          selectedTool: calls[0] ?? 'none',
          ...(preferred
            ? {
                preferredTool: preferred,
                matchedPreference: calls[0] === preferred,
              }
            : {}),
          model: OPENAI_MODELS.economical,
          status: 'passed',
        }),
      );
    },
  );
});
