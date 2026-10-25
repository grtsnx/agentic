import type { OpenaiModel, OpenaiRoutingContext } from '@/config';
// Frozen task-policy labels: repeat these plus new regressions; do not relabel to fit provider output.
export const clefCases: Array<{
  id: string;
  message: string;
  context?: OpenaiRoutingContext;
  expected: OpenaiModel;
}> = [
  { id: 'greeting', message: 'Hello!', expected: 'gpt-5-nano' },
  {
    id: 'simple-fact',
    message: 'Who was the first Roman emperor?',
    expected: 'gpt-5-nano',
  },
  {
    id: 'technical-definition',
    message: 'What is API security?',
    expected: 'gpt-5-nano',
  },
  {
    id: 'short-rewrite',
    message: 'Make this polite: Send the report now.',
    expected: 'gpt-5-nano',
  },
  {
    id: 'acknowledgement',
    message: 'Thanks!',
    context: { recentUserMessages: ['Debug this TypeScript API.'] },
    expected: 'gpt-5-nano',
  },
  { id: 'debug-short', message: 'Debug this', expected: 'gpt-6-luna' },
  {
    id: 'architecture',
    message:
      'Design a secure multi-tenant architecture and explain the tradeoffs.',
    expected: 'gpt-6-luna',
  },
  {
    id: 'research',
    message:
      'Compare three database options for a payments service and justify the tradeoffs.',
    expected: 'gpt-6-luna',
  },
  {
    id: 'code-approval',
    message:
      'Propose running console.log(2 + 2) for approval. Do not run it yet.',
    expected: 'gpt-6-luna',
  },
  {
    id: 'complex-followup',
    message: 'continue',
    context: {
      recentUserMessages: ['Design a secure payments API with tests.', 'yes'],
    },
    expected: 'gpt-6-luna',
  },
  {
    id: 'simple-followup',
    message: 'tell me more',
    context: { recentUserMessages: ['Who was the first Roman emperor?'] },
    expected: 'gpt-5-nano',
  },
  {
    id: 'attachment-analysis',
    message: 'Explain what is wrong in this screenshot.',
    context: { hasAttachments: true },
    expected: 'gpt-6-luna',
  },
  {
    id: 'unrelated-attachments',
    message: 'Hello',
    context: { hasAttachments: true },
    expected: 'gpt-5-nano',
  },
  {
    id: 'typo-repair',
    message: 'fix th enative participant aware issue in the voice worker',
    expected: 'gpt-6-luna',
  },
  {
    id: 'simple-transform-after-code',
    message: 'Repeat that code in uppercase.',
    context: {
      recentUserMessages: ['Debug this TypeScript API.'],
      hasAttachments: true,
    },
    expected: 'gpt-5-nano',
  },
  { id: 'arithmetic', message: 'What is 17 times 23?', expected: 'gpt-5-nano' },
  {
    id: 'quoted-transform',
    message: 'Convert "tangerine seven" to uppercase.',
    expected: 'gpt-5-nano',
  },
  {
    id: 'software-repair',
    message: 'fix the reconnect bug in my websocket service',
    expected: 'gpt-6-luna',
  },
  {
    id: 'new-topic',
    message: 'Who wrote Pride and Prejudice?',
    context: { recentUserMessages: ['Design a secure API.'] },
    expected: 'gpt-5-nano',
  },
  {
    id: 'workflow',
    message:
      'Research competing products, compare prices, and recommend an architecture.',
    expected: 'gpt-6-luna',
  },
  {
    id: 'definition-after-code',
    message: 'What is a database?',
    context: { recentUserMessages: ['Debug this API.'] },
    expected: 'gpt-5-nano',
  },
  {
    id: 'approval-variation',
    message: 'Run JavaScript that prints hello, but ask me to approve first.',
    expected: 'gpt-6-luna',
  },
];
