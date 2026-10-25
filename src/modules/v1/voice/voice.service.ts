import { Injectable } from '@nestjs/common';
import { LiveKitService, type LiveKitVoiceCredentials } from '@/lib';

@Injectable()
export class VoiceService {
  constructor(private readonly livekit: LiveKitService) {}

  createCredentials(): Promise<LiveKitVoiceCredentials> {
    return this.livekit.createVoiceCredentials();
  }
}
