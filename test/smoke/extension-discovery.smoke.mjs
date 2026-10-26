import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../../dist/lib/index.js';
import {
  AgentExtensionsService,
  validateEnvironment,
} from '../../dist/config/index.js';

// Opt-in, paid regression for the actual user question. No private files are sent.
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
  !/go[- ]ahead|shall I|want me to|would you like me|permission to|approval to|can check|could check/i.test(
    response.message,
  ),
  'Must not ask again for permission to discover integrations',
);
assert(
  !/search_openai_docs|fetch_openai_doc|argumentsJson|inputSchema|"query"|"anchor"/.test(
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
