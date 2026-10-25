import { Injectable } from '@nestjs/common';
import { LiveKitService } from '@/lib';
import type { LiveKitVoiceCredentials } from '@/config';

@Injectable()
export class VoiceService {
  constructor(private readonly livekit: LiveKitService) {}

  createCredentials(): Promise<LiveKitVoiceCredentials> {
    return this.livekit.createVoiceCredentials();
  }
}
