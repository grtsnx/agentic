import { defineAgent, type JobContext, voice } from '@livekit/agents';
import { validateEnvironment } from '../environment.js';
import { createLiveKitVoiceModel } from '@/lib';
import {
  VOICE_AGENT_INSTRUCTIONS,
  VOICE_GREETING_INSTRUCTIONS,
} from '@/config/agent/agent-instructions.js';

// Export traces and redacted logs without retaining user audio or transcripts.
export const VOICE_RECORDING_OPTIONS = {
  audio: false,
  traces: true,
  logs: true,
  transcript: false,
  redaction: true,
  inputDelta: false,
} as const;

export function createLiveKitVoiceAssistant(): voice.Agent {
  return voice.Agent.create({ instructions: VOICE_AGENT_INSTRUCTIONS });
}

export default defineAgent({
  entry: async (context: JobContext) => {
    const environment = validateEnvironment(process.env);
    if (!environment.VOICE_ENABLED) {
      throw new Error('VOICE_ENABLED must be true to start the voice worker');
    }

    const session = new voice.AgentSession({
      llm: createLiveKitVoiceModel(environment),
    });

    await session.start({
      agent: createLiveKitVoiceAssistant(),
      room: context.room,
      record: VOICE_RECORDING_OPTIONS,
    });
    await context.connect();
    await session.generateReply({
      instructions: VOICE_GREETING_INSTRUCTIONS,
    });
  },
});
