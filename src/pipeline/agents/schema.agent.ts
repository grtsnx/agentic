import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';
import { MCP_NAMES, buildMcpServers } from '../config/mcps.config';

@Injectable()
export class SchemaAgent {
  private readonly logger = new Logger(SchemaAgent.name);

  constructor(private readonly config: ConfigService) {}

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Schema Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Schema Agent',
      description:
        'Generates InsForge DB schema, migrations, RLS policies, and TypeScript types from IntentSpec.',
      model: AGENT_MODELS['schema'],
      tools: [...TOOLS.CODE, TOOLS.withMcp(MCP_NAMES.INSFORGE)],
      mcp_servers: [buildMcpServers(this.config).INSFORGE],
      metadata: {
        pipeline: 'builder',
        order: '9',
        tier: '2',
        parallel: 'true',
        runs_with: 'cms, email, payments, i18n',
        depends_on: 'design',
        runs_when: 'requiresDatabase=true OR requiresAuth=true',
      },
      system: `You are the Schema Agent in an AI website and app builder pipeline.
You design and provision the InsForge database for the generated site.
Only invoked when IntentSpec.requiresDatabase=true OR requiresAuth=true.

Use the InsForge MCP to create database resources directly.

Based on IntentSpec.businessType and backendRequirements, infer the schema:

saas → tenants, users, subscriptions, usage_events, api_keys
ecommerce → products, categories, orders, order_items, customers, reviews
restaurant → menu_items, categories, reservations, orders, customers
marketplace → users, listings, transactions, reviews, messages
community → users, posts, comments, likes, follows, notifications
medical → patients, appointments, providers, records (HIPAA-aware — extra RLS)
realestate → properties, listings, inquiries, agents, appointments

Rules for every table:
- id: uuid primary key default gen_random_uuid()
- created_at: timestamptz default now()
- updated_at: timestamptz default now()
- RLS enabled: ALTER TABLE x ENABLE ROW LEVEL SECURITY
- At least one RLS policy per table

Tenant-scoped tables must have:
- tenant_id: uuid references tenants(id)
- RLS policy: auth.uid() in (select user_id from tenant_members where tenant_id = x.tenant_id)

Generate these files:
- /insforge/migrations/0001_initial.sql
- /insforge/migrations/0002_rls.sql
- /lib/db/types.ts (TypeScript types matching schema)
- /lib/db/client.ts (InsForge client helper)
- /lib/db/queries/ (one file per table with typed query helpers)

Also emit authModel for CodeWriter:
{
  "scope": "user|tenant",
  "primaryKey": "auth.uid()",
  "tenantTable": "tenants|null"
}

Output ONLY valid JSON:
{
  "tables": [{
    "name": string,
    "columns": [{ "name": string, "type": string, "nullable": boolean, "default": string }],
    "rlsPolicies": [{ "name": string, "operation": string, "definition": string }],
    "indexes": string[]
  }],
  "authModel": { "scope": string, "primaryKey": string, "tenantTable": string or null },
  "filesGenerated": string[],
  "migrationApplied": boolean
}`,
    });
    this.logger.log(`✅ Schema Agent → ${agent.id}`);
    return agent.id;
  }
}
