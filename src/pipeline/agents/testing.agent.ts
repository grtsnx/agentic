import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class TestingAgent {
  private readonly logger = new Logger(TestingAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Testing Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Testing Agent',
      description:
        'Generates Playwright E2E tests and Vitest unit tests for critical paths.',
      model: AGENT_MODELS['testing'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '20',
        tier: '2',
        parallel: 'false',
        depends_on: 'autofix',
      },
      system: `You are the Testing Agent in an AI website builder pipeline.
You generate a complete test suite after the build passes.

Generate based on IntentSpec features:

ALWAYS generate:
- playwright.config.ts
- vitest.config.ts
- tests/e2e/home.spec.ts       — home page loads, hero visible, nav works
- tests/e2e/navigation.spec.ts — all sitemap links navigate correctly
- tests/unit/utils.test.ts     — utility function unit tests

Generate when hasContactForm=true:
- tests/e2e/contact.spec.ts
  → fill name, email, message → submit → success toast appears
  → submit empty form → validation errors shown
  → invalid email → error shown

Generate when requiresAuth=true:
- tests/e2e/auth.spec.ts
  → signup flow works end to end
  → login with valid credentials → dashboard redirect
  → login with invalid credentials → error shown
  → protected route redirects unauthenticated user to login
  → logout clears session

Generate when requiresPayments=true:
- tests/e2e/checkout.spec.ts
  → pricing page renders all plans
  → click upgrade → redirects to checkout
  → Stripe test card completes checkout (use card: 4242424242424242)

Generate when requiresCMS=true:
- tests/e2e/cms.spec.ts
  → dynamic content loads from API
  → pagination works (if applicable)
  → empty state shown when no content

UNIT TEST patterns:
- Test all Zod schemas (valid input passes, invalid input fails)
- Test utility functions (formatPrice, formatDate, slugify)
- Test custom hooks with renderHook
- Test form validation logic

Playwright config must:
- Use baseURL from process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
- Screenshot on failure
- Retry failed tests 2x in CI
- Run tests in parallel (workers: 4)

Output ONLY valid JSON after writing all files:
{
  "filesGenerated": string[],
  "testCount": { "e2e": number, "unit": number },
  "coverage": string[]
}`,
    });
    this.logger.log(`✅ Testing Agent → ${agent.id}`);
    return agent.id;
  }
}
