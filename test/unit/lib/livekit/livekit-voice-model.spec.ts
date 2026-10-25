import { validateEnvironment } from '@/config';
import { createLiveKitVoiceModel } from '@/lib';

describe('createLiveKitVoiceModel', () => {
  const base = {
    VOICE_ENABLED: 'true',
    LIVEKIT_URL: 'wss://agentic.livekit.cloud',
    LIVEKIT_API_KEY: 'livekit-key',
    LIVEKIT_API_SECRET: 'livekit-secret',
  };

  it('uses LiveKit Inference by default', () => {
    const model = createLiveKitVoiceModel(validateEnvironment(base));

    expect(model.model).toBe('openai/gpt-realtime-2.1');
    expect(model.provider).toBe('livekit');
    expect(model).toMatchObject({
      _options: { inputAudioNoiseReduction: { type: 'far_field' } },
    });
  });

  it('switches to the direct OpenAI provider from the environment', () => {
    const model = createLiveKitVoiceModel(
      validateEnvironment({
        ...base,
        VOICE_PROVIDER: 'openai',
        OPENAI_API_KEY: 'openai-key',
      }),
    );

    expect(model.model).toBe('gpt-realtime-2.1');
    expect(model.provider).toBe('api.openai.com');
    expect(model).toMatchObject({
      _options: { inputAudioNoiseReduction: { type: 'far_field' } },
    });
  });
});
