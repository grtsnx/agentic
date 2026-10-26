import { createInterface } from 'node:readline';

// A deterministic, side-effect-free MCP server for transport and policy tests.
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize')
    result = {
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'test-mcp', version: '1' },
    };
  else if (request.method === 'tools/list')
    result = {
      tools: ['lookup', 'write_note'].map((name) => ({
        name,
        description: name,
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      })),
    };
  else if (request.method === 'tools/call') {
    if (request.params.arguments.text === 'hang') continue;
    result = {
      isError: request.params.arguments.text === 'fail',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            input: request.params.arguments,
            unrelatedSecretVisible: !!process.env.AGENTIC_TEST_SECRET,
          }),
        },
      ],
    };
  } else result = {};
  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n',
  );
}
