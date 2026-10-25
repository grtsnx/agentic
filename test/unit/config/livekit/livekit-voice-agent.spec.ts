import liveKitVoiceAgent, {
  createLiveKitVoiceAssistant,
} from '@/config/livekit/livekit-voice-agent.js';

describe('voice agent', () => {
  it('exports a LiveKit worker entrypoint', () => {
    expect(liveKitVoiceAgent.entry).toBeTypeOf('function');
  });

  it('uses voice-friendly instructions', () => {
    const assistant = createLiveKitVoiceAssistant();

    expect(assistant.instructions).toContain('concise');
    expect(assistant.instructions).toContain('spoken conversation');
  });
});
