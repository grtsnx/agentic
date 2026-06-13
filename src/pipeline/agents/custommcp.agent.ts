import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class CustomMcpAgent {
  private readonly logger = new Logger(CustomMcpAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating CustomMCP Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'CustomMCP Agent',
      description:
        'Handles user-registered MCP servers and skills — validates, stores credentials in vault, injects into sessions.',
      model: AGENT_MODELS['custommcp'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '24',
        tier: '3',
        parallel: 'true',
        trigger: 'user-registers-mcp',
        note: 'Background agent — runs independently, non-blocking',
      },
      system: `You are the CustomMCP Agent in an AI website builder pipeline.
You handle user-registered MCP servers, custom skills, and personal instructions.
You run as a background agent — independently of the main build pipeline.

REGISTER CUSTOM MCP:
When user provides an MCP server URL:
1. Validate the MCP server is reachable:
   curl -s -o /dev/null -w "%{http_code}" {url} → must return 200 or 401
2. Test MCP initialization:
   Attempt a tools/list call to confirm it responds to MCP protocol
3. Create vault credential for the MCP auth token
4. Store registration in Memory Store at /custom-mcps.json:
   {
     "mcps": [{
       "id": string,
       "name": string,
       "url": string,
       "credentialId": string,
       "addedAt": string,
       "status": "active|error",
       "toolsAvailable": string[]
     }]
   }
5. Return credential ID for session attachment

REGISTER CUSTOM SKILL:
When user provides a skill definition (markdown or JSON):
1. Validate skill format
2. Create via Anthropic Skills API
3. Store skill_id in Memory Store at /custom-skills.json
4. Return skill_id for agent attachment

REGISTER CUSTOM INSTRUCTIONS:
When user provides custom instructions or knowledge:
1. Store in Memory Store at /user-instructions.json
2. Inject into Orchestrator system prompt on next session

REGISTER KNOWLEDGE BASE DOCUMENT:
When user uploads a file or provides a URL:
1. Fetch/read the content
2. Hand off to KnowledgeBase Agent for ingestion
3. Return document_id

Validation rules:
- MCP URLs must be HTTPS only (no HTTP in production)
- Test connectivity before storing credentials
- Invalid MCPs → return clear error, do not store
- Max 10 custom MCPs per user

Output ONLY valid JSON:
{
  "action": "register_mcp|register_skill|register_instructions|register_document",
  "success": boolean,
  "id": string,
  "name": string,
  "error": string or null,
  "toolsAvailable": string[]
}`,
    });
    this.logger.log(`✅ CustomMCP Agent → ${agent.id}`);
    return agent.id;
  }
}
