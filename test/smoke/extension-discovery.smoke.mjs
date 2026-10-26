import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../../dist/lib/index.js';
import {
  AgentExtensionsService,
  validateEnvironment,
} from '../../dist/config/index.js';

// Availability uses local configuration. --install-proposal adds an opt-in paid model check; no private files are sent.
const environment = validateEnvironment({
  ...process.env,
  WEB_SEARCH_ENABLED: false,
  AGENT_EXTENSIONS_ENABLED: true,
});
const extensions = AgentExtensionsService.fromEnvironment(environment);
const events = [];
const service = new OpenaiService(
  new ConfigService(environment),
  undefined,
  undefined,
  extensions,
);
const response = await service.generateReply(
  'which mcp do you have access to right now?',
  {
    signal: AbortSignal.timeout(90000),
    onToolAudit: (event) => events.push(event),
  },
);
console.log(
  JSON.stringify({
    reply: response.message,
    discoveryCalls: events.filter((event) => event.tool === 'mcp_list_tools')
      .length,
  }),
);
assert(
  events.some(
    (event) => event.tool === 'mcp_list_tools' && event.status === 'succeeded',
  ),
  'Must discover configured integrations before answering',
);
assert(
  !/go[- ]ahead|shall I|want me to|would you like me|permission to|approval to|can check|could check|if you want|I can list/i.test(
    response.message,
  ),
  'Must not ask again for permission to discover integrations',
);
assert(
  !/openai_docs|search_openai_docs|fetch_openai_doc|argumentsJson|inputSchema|"query"|"anchor"/.test(
    response.message,
  ),
  'Do not dump internal identifiers or schemas',
);
assert(
  response.message.split(/\s+/).length <= 120,
  'Keep an availability answer concise',
);
console.log(
  'PASS: evidence-based MCP discovery without redundant permission or internal schema dumps.',
);

if (process.argv.includes('--install-proposal')) {
  const { tool } = await import('@openai/agents');
  const { WorkspaceStore } =
    await import('../../dist/modules/v1/workspaces/workspace-store.service.js');
  const store = new WorkspaceStore(),
    issued = store.create(),
    scope = store.authorize(issued.id, issued.token);
  try {
    const installEvents = [];
    const definitions = extensions.createTools({
      audit: (event) =>
        installEvents.push({
          tool: event.tool,
          status: event.status,
          output: event.output,
        }),
      scopeId: scope.id,
      propose: (action) => store.propose(scope, action),
    });
    const tools = definitions.map((definition) =>
      tool({
        name: definition.name,
        description: definition.description,
        parameters: definition.parameters,
        execute: (input) => definition.execute(input, scope.abort.signal),
      }),
    );
    const installationReply = await service.generateReply(
      'Install this skill: https://skills.sh/vercel-labs/agent-skills/web-design-guidelines',
      { scopedToolsOnly: true, tools, signal: AbortSignal.timeout(90000) },
    );
    console.log(
      JSON.stringify({
        installationReply: installationReply.message,
        events: installEvents.map((event) => ({
          tool: event.tool,
          status: event.status,
          error: event.output?.error,
        })),
      }),
    );
    assert(
      store
        .approvals(scope)
        .some(
          (approval) =>
            approval.action.tool === 'install_skill' &&
            approval.status === 'pending',
        ),
      'Model must create an install approval card',
    );
    console.log(
      'PASS: real model proposed a commit-pinned skill installation. No installation was approved or performed.',
    );
  } finally {
    store.onModuleDestroy();
  }
}
