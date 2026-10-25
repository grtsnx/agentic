import type { Environment } from '../environment.types.js';

export type VoiceEnvironment = Pick<
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
