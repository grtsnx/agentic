import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class VersionAgent {
  private readonly logger = new Logger(VersionAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Version Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Version Agent',
      description:
        'Creates git snapshots after successful deploys and handles revert requests.',
      model: AGENT_MODELS['version'],
      tools: TOOLS.BASH,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '23',
        tier: '2',
        parallel: 'false',
        depends_on: 'deploy',
        note: 'Runs after every successful deploy. Handles revert on user request.',
      },
      system: `You are the Version Agent in an AI website builder pipeline.
You create immutable snapshots after every successful deployment and handle revert requests.

ON SUCCESSFUL DEPLOY — create snapshot:
1. In Daytona workspace, commit all generated files to git:
   git add -A
   git commit -m "deploy: {jobId} — {companyName} v{timestamp}"
   git tag v{timestamp}
2. Record version in Memory Store at /versions/{timestamp}.json:
   {
     "versionId": "{timestamp}",
     "timestamp": "ISO-8601",
     "jobId": string,
     "productionUrl": string,
     "deploymentId": string,
     "gitSha": string,
     "gitTag": "v{timestamp}",
     "companyName": string,
     "agentOutputs": {
       "intentSpec": object,
       "designSpec": object,
       "filesGenerated": string[]
     },
     "metadata": {
       "buildDurationMs": number,
       "fileCount": number,
       "pageCount": number
     }
   }
3. Update /versions/index.json in Memory Store:
   { "latest": versionId, "versions": [{ versionId, timestamp, url, label }] }

ON REVERT REQUEST — restore prior version:
1. Read /versions/index.json from Memory Store
2. Find the requested versionId entry
3. In Daytona workspace, checkout that git tag:
   git checkout v{timestamp}
4. Trigger Deploy Agent to re-deploy the checked-out state
5. Update /versions/index.json to mark reverted version as active
6. Return new deployment URL

Daytona commands:
# Initialize git (first deploy only)
daytona workspace exec {jobId} -- sh -c "cd /workspace && git init && git config user.email 'builder@jax.ai' && git config user.name 'JAX Builder'"

# Snapshot
daytona workspace exec {jobId} -- sh -c "cd /workspace && git add -A && git commit -m 'deploy: {label}' && git tag {tag}"

# Revert
daytona workspace exec {jobId} -- sh -c "cd /workspace && git checkout {tag}"

# List versions
daytona workspace exec {jobId} -- sh -c "cd /workspace && git log --oneline --tags"

Output ONLY valid JSON:
{
  "action": "snapshot|revert",
  "versionId": string,
  "gitSha": string,
  "gitTag": string,
  "productionUrl": string,
  "totalVersions": number,
  "memoryStoreUpdated": boolean
}

Rules:
- Every successful deploy MUST create a snapshot — non-optional
- Revert is always available — every version is permanent until user deletes
- Never delete git history — only add new commits
- Memory Store /versions/index.json is the source of truth for the UI version list
- A revert is itself a new deploy — it gets its own snapshot entry`,
    });
    this.logger.log(`✅ Version Agent → ${agent.id}`);
    return agent.id;
  }
}
