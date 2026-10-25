import liveKitVoiceAgent, {
  createLiveKitVoiceAssistant,
  VOICE_RECORDING_OPTIONS,
} from '@/config/livekit/livekit-voice-agent.js';
import { AGENT_INSTRUCTIONS } from '@/config/agent/agent-instructions.js';

describe('voice agent', () => {
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
