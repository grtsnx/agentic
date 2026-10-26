import 'reflect-metadata';
import assert from 'node:assert/strict';
import { AgentExtensionsService } from '../../dist/config/agent/tools/extensions.service.js';

// Explicit public-data smoke test. No model calls, private files, or credentials.
const extensions = AgentExtensionsService.fromEnvironment({
  AGENT_EXTENSIONS_ENABLED: true,
  AGENT_EXTENSIONS_FILE: 'agent-extensions.json',
});
const [tool] = extensions.createTools();
const signal = AbortSignal.timeout(45000);
const call = async (action) => {
  const result = await tool.execute({ action }, signal);
  assert.notEqual(result.ok, false, JSON.stringify(result));
  return result;
};
const catalog = await call({ kind: 'list_skills' });
assert(catalog.skills.some((skill) => skill.name === 'code-review'));
const skill = await call({
  kind: 'read_skill',
  name: 'code-review',
  file: 'SKILL.md',
});
assert(skill.text.includes('name: code-review'));
const listed = await call({ kind: 'list_mcp_tools', server: 'openai_docs' });
assert(listed.tools.some((tool) => tool.name === 'search_openai_docs'));
const searched = await call({
  kind: 'call_mcp_tool',
  server: 'openai_docs',
  name: 'search_openai_docs',
  argumentsJson: JSON.stringify({ query: 'Responses API streaming', limit: 1 }),
});
assert.equal(searched.contentTrust, 'untrusted');
assert.match(searched.text, /https:\/\//);
console.log(
  'PASS: real MCP HTTP discovery/search and bundled skill loading. No model usage.',
);

if (process.argv.includes('--model')) {
  // Opt-in provider check: sends only a synthetic snippet and uses normal model billing.
  const { ConfigService } = await import('@nestjs/config');
  const { validateEnvironment } =
    await import('../../dist/config/environment.js');
  const { OpenaiService } = await import('../../dist/lib/index.js');
  const environment = validateEnvironment({
    ...process.env,
    WEB_SEARCH_ENABLED: false,
    AGENT_EXTENSIONS_ENABLED: true,
  });
  assert(environment.OPENAI_API_KEY, 'OPENAI_API_KEY required for --model');
  const events = [];
  const service = new OpenaiService(
    new ConfigService(environment),
    undefined,
    undefined,
    extensions,
  );
  const response = await service.generateReply(
    'Use the configured code-review skill, reading its instructions first, to review this synthetic snippet: async function count() { return 2 + 2; }. Then use the configured documentation integration to find one official page about Responses API streaming. Give one brief review point and the source link.',
    {
      onToolAudit: (event) => events.push(event),
      signal: AbortSignal.timeout(120000),
    },
  );
  assert(
    events.some(
      (event) => event.tool === 'skill_read' && event.status === 'succeeded',
    ),
    'Model did not read the skill',
  );
  assert(
    events.some(
      (event) => event.tool === 'mcp_read_tool' && event.status === 'succeeded',
    ),
    'Model did not call MCP',
  );
  assert(response.message.length > 0);
  console.log(
    JSON.stringify({
      status: 'PASS',
      modelSelectedSkillAndMcp: true,
      tokens: response.runtime.tokens.total,
    }),
  );
}
