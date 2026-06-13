import * as fs from 'fs';
import * as path from 'path';

/**
 * Shape of src/pipeline/output/agents.config.json — produced by `bun run setup:pipeline`.
 * The runtime layer reads this to know which Orchestrator agent + resources to attach
 * to each build session.
 */
export interface AgentsConfig {
  vaultId: string;
  environmentId: string;
  memoryStoreId: string;
  agentIds: Record<string, string>;
}

const DEFAULT_CONFIG_PATH = path.resolve(
  process.cwd(),
  'src/pipeline/output/agents.config.json',
);

/**
 * Loads the provisioned agent config. Throws a clear, actionable error if setup
 * hasn't been run yet so the API fails loudly instead of with a cryptic null.
 */
export function loadAgentsConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
): AgentsConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `agents.config.json not found at ${configPath}. ` +
        'Run `bun run setup:pipeline` to provision the agents first.',
    );
  }

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as AgentsConfig;

  if (!cfg.agentIds?.orchestrator) {
    throw new Error(
      'agents.config.json is missing the orchestrator agent id. ' +
        'Re-run `bun run setup:pipeline`.',
    );
  }

  return cfg;
}
