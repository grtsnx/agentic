import { tool } from '@openai/agents';
import { extensionInputSchema } from '@/config';

it('does not emit the URI format rejected by OpenAI function schemas', () => {
  const definition = tool({
    name: 'agent_extension',
    description: 'Extensions',
    parameters: extensionInputSchema,
    execute: async () => ({}),
  });
  expect(JSON.stringify(definition.parameters)).not.toContain('"format":"uri"');
});
