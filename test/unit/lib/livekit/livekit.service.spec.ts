import { ConfigService } from '@nestjs/config';
import { TokenVerifier } from 'livekit-server-sdk';
import { validateEnvironment, type Environment } from '@/config';
import { LiveKitService } from '@/lib';

describe('LiveKitService', () => {
  const environment = validateEnvironment({
    VOICE_ENABLED: 'true',
    LIVEKIT_URL: 'wss://agentic.livekit.cloud',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret-with-enough-entropy',
  });

  const config = {
    getOrThrow<T>(key: keyof Environment): T {
      return environment[key] as T;
    },
  } as ConfigService;

  it('issues a short-lived, microphone-only token with explicit agent dispatch', async () => {
    const credentials = await new LiveKitService(
      config,
    ).createVoiceCredentials();
    const claims = await new TokenVerifier(
      'test-key',
      'test-secret-with-enough-entropy',
    ).verify(credentials.participantToken);

    expect(credentials.serverUrl).toBe('wss://agentic.livekit.cloud');
    expect(claims.video).toMatchObject({
      room: expect.stringMatching(/^voice-/),
      roomJoin: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ['microphone'],
    });
    expect(claims.video?.roomAdmin).not.toBe(true);
    expect(claims.roomConfig?.agents[0]?.agentName).toBe('agentic-voice');
    expect(Number(claims.exp) - Number(claims.nbf)).toBeLessThanOrEqual(600);
  });

  it('uses unique room and participant identities for each session', async () => {
    const service = new LiveKitService(config);
    const first = await service.createVoiceCredentials();
    const second = await service.createVoiceCredentials();

    expect(first.participantToken).not.toBe(second.participantToken);
  });
});
