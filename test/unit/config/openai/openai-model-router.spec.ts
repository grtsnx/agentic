import {
  routeOpenaiModel,
  isDirectTextRequest,
  openaiModelSettings,
} from '@/config';

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

describe('routing regressions', () => {
  it.each([
    'Debug this',
    'Refactor this',
    'Research the competitors',
    'Propose running console.log(2 + 2) for approval',
  ])('promotes task intent even in a short prompt: %s', (message) => {
    expect(routeOpenaiModel(message)).toBe('gpt-6-luna');
  });
  it.each([
    'What is API security?',
    'What does code refactoring mean?',
    'Define distributed architecture.',
  ])('keeps simple definitions economical: %s', (message) => {
    expect(routeOpenaiModel(message)).toBe('gpt-5-nano');
  });
  it('retains complex context for a continuation', () => {
    expect(
      routeOpenaiModel('continue', {
        recentUserMessages: ['Design a secure payments API with tests.', 'yes'],
      }),
    ).toBe('gpt-6-luna');
  });
  it('does not inherit complexity for a new simple topic or acknowledgement', () => {
    const context = { recentUserMessages: ['Debug this TypeScript API.'] };
    expect(routeOpenaiModel('Who was the first Roman emperor?', context)).toBe(
      'gpt-5-nano',
    );
    expect(routeOpenaiModel('Thanks!', context)).toBe('gpt-5-nano');
    expect(
      routeOpenaiModel('continue', {
        recentUserMessages: ['Who was the first Roman emperor?'],
      }),
    ).toBe('gpt-5-nano');
  });
  it('accounts for a request about attachments without promoting greetings', () => {
    expect(routeOpenaiModel('What is this?', { hasAttachments: true })).toBe(
      'gpt-6-luna',
    );
    expect(routeOpenaiModel('Hello', { hasAttachments: true })).toBe(
      'gpt-5-nano',
    );
  });
});

describe('fast direct responses', () => {
  it.each([
    'Hello!',
    'What is 17 times 23? Reply with just the number.',
    'Convert "tangerine seven" to uppercase. Return only those two words.',
    'Repeat that code in uppercase.',
  ])('recognizes a bounded direct text task: %s', (message) => {
    expect(isDirectTextRequest(message)).toBe(true);
    expect(
      routeOpenaiModel(message, {
        hasAttachments: true,
        recentUserMessages: ['Debug my API.'],
      }),
    ).toBe('gpt-5-nano');
  });
  it.each([
    'Hello, search the web for current news.',
    'Calculate my tax bill.',
    'Convert this file and send it to Jane.',
    'What is 17 times 23? Then run the code.',
    'Summarize the attached PDF.',
  ])('preserves tool availability for other requests: %s', (message) =>
    expect(isDirectTextRequest(message)).toBe(false),
  );
  it('retains compatible reasoning for tool calls', () => {
    expect(openaiModelSettings('gpt-5-nano', true)).toEqual({
      reasoning: { effort: 'low' },
    });
    expect(openaiModelSettings('gpt-5-nano', false)).toEqual({
      reasoning: { effort: 'minimal' },
    });
    expect(openaiModelSettings('gpt-6-luna', true)).toEqual({});
  });
  it('recognizes software fixes without exact engineering keywords', () => {
    expect(
      routeOpenaiModel(
        'fix th enative participant aware issue in the voice worker',
      ),
    ).toBe('gpt-6-luna');
  });
});
