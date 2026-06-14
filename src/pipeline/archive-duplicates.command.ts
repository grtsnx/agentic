// Run with: bun run archive:duplicates
//
// Cleans up duplicate Managed Agents created by earlier (pre-idempotency) runs.
// For every agent name that appears more than once, it keeps a single agent and
// archives the rest. The keeper is, in order of preference:
//   1. The agent whose ID is recorded in output/agents.config.json (the canonical
//      set from the last successful pipeline run), otherwise
//   2. The most recently created agent with that name.
// Agents with a unique name are never touched, so this only ever removes true
// duplicates.

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

interface AgentSummary {
  id: string;
  name: string;
  created_at: string;
}

function loadCanonicalIds(): Set<string> {
  const ids = new Set<string>();
  const configPath = path.join(__dirname, 'output', 'agents.config.json');
  if (!fs.existsSync(configPath)) {
    return ids;
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    for (const id of Object.values(cfg.agentIds ?? {})) {
      if (typeof id === 'string') ids.add(id);
    }
  } catch {
    // Malformed config — fall back to "newest wins" with no canonical hints.
  }
  return ids;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      '❌ ANTHROPIC_API_KEY is not set. Add it to your .env first.',
    );
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const agentsApi = client.beta.agents as any;
  const canonicalIds = loadCanonicalIds();

  // Collect every non-archived agent (list() auto-paginates).
  const all: AgentSummary[] = [];
  for await (const agent of agentsApi.list({ limit: 100 })) {
    all.push(agent as AgentSummary);
  }

  // Group by name.
  const byName = new Map<string, AgentSummary[]>();
  for (const agent of all) {
    const group = byName.get(agent.name) ?? [];
    group.push(agent);
    byName.set(agent.name, group);
  }

  let archived = 0;
  for (const [name, group] of byName) {
    if (group.length < 2) {
      continue; // unique name → not a duplicate
    }

    const keeper =
      group.find((a) => canonicalIds.has(a.id)) ??
      [...group].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      )[0];

    const duplicates = group.filter((a) => a.id !== keeper.id);
    console.log(
      `"${name}": keeping ${keeper.id}, archiving ${duplicates.length} duplicate(s)`,
    );

    for (const dupe of duplicates) {
      await agentsApi.archive(dupe.id);
      archived++;
    }
  }

  console.log(
    archived === 0
      ? '✅ No duplicate agents found.'
      : `✅ Archived ${archived} duplicate agent(s).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ archive:duplicates failed:', err);
  process.exit(1);
});
