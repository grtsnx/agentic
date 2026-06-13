import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

const logger = new Logger('IdempotentAgents');

/**
 * Makes agent provisioning idempotent.
 *
 * The pipeline creates 26 agents by calling `client.beta.agents.create(...)`.
 * Run twice, that would stack duplicate agents on the Anthropic account because
 * the API has no native upsert. This wraps `create` once so that, when an agent
 * with the same `name` already exists, it is updated in place (full-config
 * replacement, guarded by the current version) instead of duplicated. Reruns of
 * `setup:pipeline` therefore converge on exactly one agent per name and pick up
 * any edits to that agent's config.
 *
 * Safe to call more than once — patching is guarded by a marker flag.
 */
export function enableIdempotentAgents(client: Anthropic): void {
  const agents = client.beta.agents as any;
  if (agents.__idempotentPatched) {
    return;
  }

  const originalCreate = agents.create.bind(agents);

  agents.create = async (params: any, options?: any) => {
    const existing = await findAgentByName(agents, params.name);
    if (existing) {
      logger.log(
        `Reusing "${params.name}" → ${existing.id} (updating to v${existing.version + 1})`,
      );
      return agents.update(
        existing.id,
        { version: existing.version, ...params },
        options,
      );
    }
    return originalCreate(params, options);
  };

  agents.__idempotentPatched = true;
}

/**
 * Scans all (non-archived) agents and returns the first whose name matches.
 * `list()` auto-paginates, so this covers any number of existing agents.
 */
async function findAgentByName(
  agents: any,
  name: string,
): Promise<{ id: string; version: number } | undefined> {
  for await (const agent of agents.list({ limit: 100 })) {
    if (agent.name === name) {
      return agent;
    }
  }
  return undefined;
}
