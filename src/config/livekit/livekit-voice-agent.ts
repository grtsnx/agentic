import { defineAgent, type JobContext, voice } from '@livekit/agents';
import { validateEnvironment } from '../environment.js';
import { createLiveKitVoiceModel } from '@/lib';

const VOICE_INSTRUCTIONS = `You are Agentic, a helpful general-purpose AI assistant.
Keep answers concise and natural for spoken conversation.
Ask a short clarifying question when the user's intent is unclear.
Do not read Markdown syntax, URLs, or long lists aloud unless the user asks.`;

export function createLiveKitVoiceAssistant(): voice.Agent {
  return voice.Agent.create({ instructions: VOICE_INSTRUCTIONS });
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
    });
    await context.connect();
    await session.generateReply({
      instructions: 'Greet the user briefly and ask how you can help.',
    });
  },
});
