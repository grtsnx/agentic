import { LiveKitService } from '@/lib';
import { VoiceService } from '@/modules';

describe('VoiceService', () => {
  it('exposes LiveKit credentials through the voice module boundary', async () => {
    const credentials = {
      serverUrl: 'wss://agentic.livekit.cloud',
      participantToken: 'short-lived-token',
    };
    const livekit = {
      createVoiceCredentials: vi.fn().mockResolvedValue(credentials),
    } as unknown as LiveKitService;

    await expect(
      new VoiceService(livekit).createCredentials(),
    ).resolves.toEqual(credentials);
    expect(livekit.createVoiceCredentials).toHaveBeenCalledOnce();
  });
});
