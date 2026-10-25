import { defineAgent, type JobContext, voice, llm } from '@livekit/agents';
import { validateEnvironment } from '../environment.js';
import type { Environment } from '@/config';
import { createLiveKitVoiceModel } from '@/lib';
import { WebToolsService } from '../agent/tools/web/web-tools.service.js';
import {
  VOICE_AGENT_INSTRUCTIONS,
  VOICE_GREETING_INSTRUCTIONS,
} from '../agent/instruction.js';

// Export traces and redacted logs without retaining user audio or transcripts.
export const VOICE_RECORDING_OPTIONS = {
  audio: false,
  traces: true,
  logs: true,
  transcript: false,
  redaction: true,
  inputDelta: false,
} as const;

export function createLiveKitVoiceAssistant(
  environment?: Environment,
): voice.Agent {
  const definitions = environment
    ? WebToolsService.fromEnvironment({ ...environment }).createTools()
    : [];
  const tools = Object.fromEntries(
    definitions.map((definition) => [
      definition.name,
      llm.tool({
        description: definition.description,
        parameters: definition.parameters,
        execute: (input, { abortSignal }) =>
          definition.execute(input, abortSignal),
      }),
    ]),
  );
  return voice.Agent.create({ instructions: VOICE_AGENT_INSTRUCTIONS, tools });
}

export default defineAgent({
  entry: async (context: JobContext) => {
    const environment = validateEnvironment(process.env);
    if (!environment.VOICE_ENABLED) {
      throw new Error('VOICE_ENABLED must be true to start the voice worker');
    }

    // SessionHost subscribes to state events during start(), before the SDK's
    // parallel auto-connect finishes. Connect first so those events have a transport.
    await context.connect();

    const session = new voice.AgentSession({
      llm: createLiveKitVoiceModel(environment),
      // Both providers use a realtime model with its own server-side detection.
      // Opt out of the SDK's default local VAD/TurnDetector pipeline explicitly.
      vad: null,
      turnHandling: { turnDetection: 'realtime_llm' },
    });
    context.addShutdownCallback(() => session.close());

    await session.start({
      agent: createLiveKitVoiceAssistant(environment),
      room: context.room,
      record: VOICE_RECORDING_OPTIONS,
    });
    await session.generateReply({
      instructions: VOICE_GREETING_INSTRUCTIONS,
    });
  },
});
