import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inference, type llm } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import {
  RoomAgentDispatch,
  RoomConfiguration,
  TrackSource,
} from '@livekit/protocol';
import { AccessToken } from 'livekit-server-sdk';
import type { Environment } from '@/config';

const require = createRequire(import.meta.url);
let clientScript: string | undefined;

type VoiceEnvironment = Pick<
  Environment,
  | 'VOICE_PROVIDER'
  | 'VOICE_MODEL'
  | 'VOICE_NAME'
  | 'LIVEKIT_API_KEY'
  | 'LIVEKIT_API_SECRET'
  | 'OPENAI_API_KEY'
>;

export interface LiveKitVoiceCredentials {
  serverUrl: string;
  participantToken: string;
}

export function createLiveKitVoiceModel(
  environment: VoiceEnvironment,
): llm.RealtimeModel {
  // Filter room noise before speech detection so laptop/speakerphone input is
  // less likely to trigger an accidental interruption. Keep real barge-in enabled.
  const audioOptions = {
    inputAudioNoiseReduction: { type: 'far_field' as const },
  };
  if (environment.VOICE_PROVIDER === 'openai') {
    return new openai.realtime.RealtimeModel({
      ...audioOptions,
      model: environment.VOICE_MODEL,
      voice: environment.VOICE_NAME,
      apiKey: environment.OPENAI_API_KEY,
    });
  }

  return new inference.RealtimeModel({
    ...audioOptions,
    model: `openai/${environment.VOICE_MODEL}`,
    voice: environment.VOICE_NAME,
    apiKey: environment.LIVEKIT_API_KEY ?? '',
    apiSecret: environment.LIVEKIT_API_SECRET ?? '',
  });
}

export function getLiveKitClientScript(): string {
  clientScript ??= readFileSync(require.resolve('livekit-client'), 'utf8');
  return clientScript;
}

@Injectable()
export class LiveKitService {
  constructor(private readonly config: ConfigService) {}

  async createVoiceCredentials(): Promise<LiveKitVoiceCredentials> {
    if (!this.config.getOrThrow<boolean>('VOICE_ENABLED')) {
      throw new ServiceUnavailableException('Voice chat is not enabled');
    }

    const serverUrl = this.config.getOrThrow<string>('LIVEKIT_URL');
    const apiKey = this.config.getOrThrow<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('LIVEKIT_API_SECRET');
    const agentName = this.config.getOrThrow<string>('LIVEKIT_AGENT_NAME');
    const room = `voice-${randomUUID()}`;
    const identity = `user-${randomUUID()}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      name: 'User',
      ttl: '10m',
    });

    accessToken.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: [TrackSource.MICROPHONE],
    });
    accessToken.roomConfig = new RoomConfiguration({
      maxParticipants: 2,
      agents: [new RoomAgentDispatch({ agentName })],
    });

    return {
      serverUrl,
      participantToken: await accessToken.toJwt(),
    };
  }
}
