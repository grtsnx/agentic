import { fileURLToPath } from 'node:url';
import { cli, ServerOptions } from '@livekit/agents';

export function runLiveKitVoiceWorker(): void {
  const agentPath = fileURLToPath(
    new URL('./livekit-voice-agent.js', import.meta.url),
  );

  cli.runApp(
    new ServerOptions({
      agent: agentPath,
      agentName: process.env.LIVEKIT_AGENT_NAME ?? 'agentic-voice',
    }),
  );
}
