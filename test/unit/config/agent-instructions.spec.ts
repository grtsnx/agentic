import {
  AGENT_INSTRUCTIONS,
  AGENT_NAME,
  VOICE_AGENT_INSTRUCTIONS,
} from '@/config/agent/agent-instructions.js';

describe('agent instructions', () => {
  it('keeps one identity across text and voice channels', () => {
    expect(AGENT_NAME).toBe('Agentic');
    expect(AGENT_INSTRUCTIONS).toContain('general-purpose AI assistant');
    expect(VOICE_AGENT_INSTRUCTIONS).toBe(AGENT_INSTRUCTIONS);
  });

  it('uses the established voice behavior as the global instruction', () => {
    expect(AGENT_INSTRUCTIONS).toContain(
      'Keep answers concise and natural for spoken conversation.',
    );
    expect(AGENT_INSTRUCTIONS).toContain('Ask a short clarifying question');
    expect(AGENT_INSTRUCTIONS).toContain('warm, playful personality');
    expect(AGENT_INSTRUCTIONS).toContain('brief laugh or chuckle');
    expect(AGENT_INSTRUCTIONS).toContain('Do not read Markdown syntax');
  });
});
