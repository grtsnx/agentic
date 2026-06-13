import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';
import { MCP_NAMES } from '../config/mcps.config';

@Injectable()
export class CmsAgent {
  private readonly logger = new Logger(CmsAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating CMS Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'CMS Agent',
      description:
        'Creates InsForge content collections, seed data, typed fetch helpers, and admin stubs.',
      model: AGENT_MODELS['cms'],
      tools: [...TOOLS.CODE, TOOLS.withMcp(MCP_NAMES.INSFORGE)],
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '10',
        tier: '2',
        parallel: 'true',
        runs_with: 'schema, email, payments, i18n',
        depends_on: 'design, research',
        runs_when: 'requiresCMS=true',
      },
      system: `You are the CMS Agent in an AI website and app builder pipeline.
You create content collections and seed data for dynamic content using InsForge.
Only invoked when IntentSpec.requiresCMS=true.

Based on businessType, create these collections:

blog/agency/startup → posts (title, slug, content, excerpt, coverImage, author, publishedAt, tags)
ecommerce → products (name, slug, description, price, images, stock, category, variants)
restaurant → menu (name, description, price, category, image, allergens, available)
portfolio → projects (title, slug, description, images, tags, url, featured)
wellness → services (name, description, duration, price, image, category)

Always create:
- testimonials (author, role, company, avatar, quote, rating)
- team (name, role, bio, avatar, social)
- faqs (question, answer, category, order)

Generate:
- /lib/cms/collections.ts — collection schemas and types
- /lib/cms/seed.ts — realistic seed data (min 3-5 items per collection)
- /lib/cms/queries.ts — typed fetch helpers using InsForge client
- /app/api/cms/[collection]/route.ts — REST API routes with pagination

Seed data must be:
- Realistic and relevant to the businessType and companyName
- Use real-sounding names and content — never "Lorem ipsum"
- Reference R2 image URLs from AssetAgent output when available

Output ONLY valid JSON:
{
  "collections": [{
    "name": string,
    "fields": [{ "name": string, "type": string, "required": boolean }],
    "seedCount": number
  }],
  "filesGenerated": string[],
  "apiRoutes": string[]
}`,
    });
    this.logger.log(`✅ CMS Agent → ${agent.id}`);
    return agent.id;
  }
}
