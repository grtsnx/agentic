import liveKitVoiceAgent, {
  createLiveKitVoiceAssistant,
  VOICE_RECORDING_OPTIONS,
} from '@/config/livekit/livekit-voice-agent.js';
import { AGENT_INSTRUCTIONS } from '@/config/agent/agent-instructions.js';
import { validateEnvironment } from '@/config/environment.js';

describe('voice agent', () => {
  it('registers only enabled optional tools with the real LiveKit SDK', () => {
    const assistant = createLiveKitVoiceAssistant(
      validateEnvironment({
        FIRECRAWL_ENABLED: true,
        FIRECRAWL_API_KEY: 'test-key',
      }),
    );
    expect(Object.keys(assistant.toolCtx.functionTools)).toEqual([
      'firecrawl_read_page',
    ]);
    expect(
      Object.keys(
        createLiveKitVoiceAssistant(validateEnvironment({})).toolCtx
          .functionTools,
      ),
    ).toEqual([]);
  });
  it('exports a LiveKit worker entrypoint', () => {
    expect(liveKitVoiceAgent.entry).toBeTypeOf('function');
  });

  it('uses voice-friendly instructions', () => {
    const assistant = createLiveKitVoiceAssistant();

    expect(String(assistant.instructions).startsWith(AGENT_INSTRUCTIONS)).toBe(
      true,
    );
    expect(assistant.instructions).toContain('concise');
    expect(assistant.instructions).toContain('spoken conversation');
    expect(assistant.instructions).toContain('playful');
    expect(assistant.instructions).toContain('serious');
    expect(assistant.instructions).toContain('laugh');
  });

  it('exports privacy-safe observability settings', () => {
    expect(VOICE_RECORDING_OPTIONS).toEqual({
      audio: false,
      traces: true,
      logs: true,
      transcript: false,
      redaction: true,
      inputDelta: false,
    });
  });
});
