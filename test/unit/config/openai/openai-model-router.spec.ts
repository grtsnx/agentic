import { routeOpenaiModel } from '@/config';

describe('routeOpenaiModel', () => {
  it.each([
    'Hello',
    'Summarize this paragraph in one sentence.',
    'Who was the first Roman emperor?',
  ])('routes a lightweight request to GPT-5 Nano: %s', (message) => {
    expect(routeOpenaiModel(message)).toBe('gpt-5-nano');
  });

  it.each([
    'Design a secure multi-tenant architecture and explain the tradeoffs.',
    'Debug and refactor this TypeScript service:\n```ts\nconst value = await load();\n```',
    'Implement this feature with tests, validation, error handling, and deployment safeguards.',
  ])('routes a complex request to GPT-6 Luna: %s', (message) => {
    expect(routeOpenaiModel(message)).toBe('gpt-6-luna');
  });

  it('promotes a large request to GPT-6 Luna', () => {
    expect(routeOpenaiModel('Explain this carefully. '.repeat(80))).toBe(
      'gpt-6-luna',
    );
  });
});
