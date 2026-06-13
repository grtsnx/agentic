// Run with: bun run purge:all                 (dry run — shows what WOULD be purged)
//           bun run purge:all --yes           (actually purge: agents + vaults + sessions)
//           bun run purge:all --yes --with-environments   (also delete environments)
//           bun run purge:all --yes --with-memory         (also delete memory stores)
//
// Wipes the Anthropic Managed Agents workspace back to a clean slate so the next
// `bun run setup:pipeline` provisions everything fresh:
//   • Sessions     → deleted (permanent)
//   • Agents       → archived (the API has no hard-delete; archive removes them from list())
//   • Vaults       → deleted (permanent — credentials go with them)
//   • Environments → deleted ONLY with --with-environments (permanent)
//   • Memory stores→ deleted ONLY with --with-memory (permanent — user persona/preferences go with them)
// It also removes the local output/agents.config.json so no stale IDs are reused.
//
// THIS IS DESTRUCTIVE AND IRREVERSIBLE. It runs as a dry run unless you pass --yes.

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

interface Summary {
  id: string;
  name?: string;
}

async function collect(iterable: AsyncIterable<unknown>): Promise<Summary[]> {
  const out: Summary[] = [];
  for await (const item of iterable) {
    out.push(item as Summary);
  }
  return out;
}

function label(item: Summary): string {
  return item.name ? `${item.id}  (${item.name})` : item.id;
}

async function purge(
  kind: string,
  items: Summary[],
  remove: (id: string) => Promise<unknown>,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await remove(item.id);
      ok++;
      console.log(`   ✓ ${kind}: ${label(item)}`);
    } catch (err: any) {
      failed++;
      console.error(
        `   ✗ ${kind}: ${label(item)} — ${err?.status ?? ''} ${err?.message ?? err}`,
      );
    }
  }
  return { ok, failed };
}

function clearLocalConfig(): void {
  const configPath = path.join(__dirname, 'output', 'agents.config.json');
  if (fs.existsSync(configPath)) {
    fs.rmSync(configPath);
    console.log(`   ✓ removed local ${path.relative(process.cwd(), configPath)}`);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set. Add it to your .env first.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const execute = args.includes('--yes') || args.includes('-y');
  const withEnvironments = args.includes('--with-environments');
  const withMemory = args.includes('--with-memory');

  const client = new Anthropic({ apiKey });
  const agentsApi = client.beta.agents as any;
  const vaultsApi = client.beta.vaults as any;
  const sessionsApi = client.beta.sessions as any;
  const environmentsApi = client.beta.environments as any;
  const memoryStoresApi = (client.beta as any).memoryStores;

  console.log('🔎 Scanning the Managed Agents workspace...\n');

  const sessions = await collect(sessionsApi.list({ limit: 100 }));
  const agents = await collect(agentsApi.list({ limit: 100 }));
  const vaults = await collect(vaultsApi.list({ limit: 100 }));
  const environments = withEnvironments
    ? await collect(environmentsApi.list({ limit: 100 }))
    : [];
  const memoryStores =
    withMemory && memoryStoresApi
      ? await collect(memoryStoresApi.list({ limit: 100 }))
      : [];

  console.log('Found:');
  console.log(`   • ${sessions.length} session(s)`);
  console.log(`   • ${agents.length} agent(s)`);
  console.log(`   • ${vaults.length} vault(s)`);
  if (withEnvironments) {
    console.log(`   • ${environments.length} environment(s)`);
  } else {
    console.log('   • environments: left intact (pass --with-environments to wipe)');
  }
  if (withMemory) {
    console.log(`   • ${memoryStores.length} memory store(s)`);
  } else {
    console.log('   • memory stores: left intact (pass --with-memory to wipe)');
  }

  const total =
    sessions.length +
    agents.length +
    vaults.length +
    environments.length +
    memoryStores.length;

  if (total === 0) {
    console.log('\n✅ Nothing to purge — already a clean slate.');
    process.exit(0);
  }

  if (!execute) {
    console.log(
      '\n⚠️  DRY RUN — nothing was deleted. This will PERMANENTLY delete the items above.',
    );
    console.log('   Re-run with --yes to purge:');
    console.log('     bun run purge:all --yes');
    console.log('     bun run purge:all --yes --with-environments');
    process.exit(0);
  }

  console.log('\n🔥 Purging (this cannot be undone)...\n');

  // Order matters: sessions reference agents; agents reference vaults/environments.
  const results = {
    sessions: await purge('session', sessions, (id) => sessionsApi.delete(id)),
    agents: await purge('agent', agents, (id) => agentsApi.archive(id)),
    vaults: await purge('vault', vaults, (id) => vaultsApi.delete(id)),
    environments: withEnvironments
      ? await purge('environment', environments, (id) =>
          environmentsApi.delete(id),
        )
      : { ok: 0, failed: 0 },
    memoryStores: withMemory
      ? await purge('memory store', memoryStores, (id) =>
          memoryStoresApi.delete(id),
        )
      : { ok: 0, failed: 0 },
  };

  clearLocalConfig();

  const failed =
    results.sessions.failed +
    results.agents.failed +
    results.vaults.failed +
    results.environments.failed +
    results.memoryStores.failed;

  console.log(
    `\n✅ Purge complete — sessions:${results.sessions.ok} agents:${results.agents.ok} ` +
      `vaults:${results.vaults.ok}` +
      (withEnvironments ? ` environments:${results.environments.ok}` : '') +
      (withMemory ? ` memoryStores:${results.memoryStores.ok}` : ''),
  );
  if (failed > 0) {
    console.log(
      `⚠️  ${failed} item(s) could not be removed (often because they were still ` +
        'referenced). Re-run the command to retry.',
    );
  }
  console.log('\nNext: bun run setup:pipeline  → provisions everything fresh.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ purge:all failed:', err);
  process.exit(1);
});
