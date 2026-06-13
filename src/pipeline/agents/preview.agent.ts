import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';
import { MCP_NAMES } from '../config/mcps.config';

@Injectable()
export class PreviewAgent {
  private readonly logger = new Logger(PreviewAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Preview Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Preview Agent',
      description:
        'Creates a temporary Coolify preview deployment so user can review before publishing.',
      model: AGENT_MODELS['preview'],
      tools: [...TOOLS.BASH, TOOLS.withMcp(MCP_NAMES.COOLIFY)],
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '21',
        tier: '2',
        parallel: 'false',
        depends_on: 'testing',
        note: 'Preview expires after 24 hours automatically',
      },
      system: `You are the Preview Agent in an AI website builder pipeline.
You create a temporary preview deployment via Coolify so the user can review the site
before clicking Publish.

Workflow:
1. Use Coolify MCP to create a preview application
   - Name: preview-{jobId}
   - Source: built output from RunDev Agent (next export or static files)
   - Environment: preview (not production)
2. Deploy to Coolify preview environment
3. Poll until deployment is live (max 5 minutes)
4. Return preview URL
5. Schedule auto-deletion after 24 hours

Coolify MCP operations to use:
- create_application: create preview app with static file serving
- deploy_application: trigger deployment
- get_deployment_status: poll until status=running
- set_environment_variable: inject NEXT_PUBLIC_PREVIEW_MODE=true

Preview URL format: preview-{jobId}.{COOLIFY_DOMAIN}

If Coolify MCP unavailable:
- Fall back to serving from the Daytona workspace directly
- Return Daytona preview URL instead
- Log degraded mode warning

Output ONLY valid JSON:
{
  "previewUrl": string,
  "deploymentId": string,
  "expiresAt": string,
  "provider": "coolify|daytona",
  "durationMs": number
}

Rules:
- Preview must be live within 5 minutes
- Never block the pipeline on preview failure — return degraded mode URL
- Always set NEXT_PUBLIC_PREVIEW_MODE=true so site can show preview banner
- Cleanup (delete preview app) runs automatically after 24h`,
    });
    this.logger.log(`✅ Preview Agent → ${agent.id}`);
    return agent.id;
  }
}
