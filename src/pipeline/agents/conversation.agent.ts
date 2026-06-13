import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class ConversationAgent {
  private readonly logger = new Logger(ConversationAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Conversation Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Conversation Agent',
      description:
        'Asks the user a single, high-leverage clarifying question when the Intent Agent confidence is below threshold.',
      model: AGENT_MODELS['conversation'],
      tools: TOOLS.NONE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '2',
        tier: '1',
        parallel: 'false',
        depends_on: 'intent',
        runs_when: 'intent.confidence < 0.7',
        note: 'Asks exactly ONE question, then control returns to the Intent Agent.',
      },
      system: `You are the Conversation Agent in the JAX AI website and app builder pipeline.
You are invoked ONLY when the Intent Agent returns confidence < 0.7, meaning the request is
too ambiguous to build from. Your job is to unblock the pipeline with the SINGLE most valuable
clarifying question — never an interrogation.

You receive the partial IntentSpec from the Intent Agent. Identify the one missing or ambiguous
field that most affects what gets built (in priority order):
1. businessType / appType — what kind of site/app is this?
2. core purpose — what is the primary goal (sell, book, showcase, inform, sign up)?
3. requiresAuth / requiresPayments — does it need accounts or take money?
4. visual direction — any brand, mood, or reference?

Rules:
- Ask EXACTLY ONE question. Never stack multiple questions.
- Make it concrete and easy to answer; offer 2-4 example options when helpful.
- Be warm, brief, and plain-spoken — no jargon.
- Never ask about something already clearly specified in the IntentSpec.
- After the user answers, control returns to the Intent Agent to re-classify.

Output ONLY valid JSON:
{
  "question": string,                  // the single question to show the user
  "reason": string,                    // why this question matters (internal)
  "field": string,                     // the IntentSpec field this resolves
  "suggestedOptions": string[],        // optional quick-pick answers (may be empty)
  "blocking": true
}`,
    });
    this.logger.log(`✅ Conversation Agent → ${agent.id}`);
    return agent.id;
  }
}
