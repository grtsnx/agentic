import { fileURLToPath } from 'node:url';
import {
  AgentServer,
  cli,
  initializeLogger,
  ServerOptions,
} from '@livekit/agents';

export async function runLiveKitVoiceWorker(
  mode = process.argv[2],
): Promise<void> {
  const agentPath = fileURLToPath(
    new URL('./livekit-voice-agent.js', import.meta.url),
  );

  if (mode !== 'local') {
    cli.runApp(
      new ServerOptions({
        agent: agentPath,
        agentName: process.env.LIVEKIT_AGENT_NAME ?? 'agentic-voice',
      }),
    );
    return;
  }

  // Nest already supervises reloads. Run the SDK server directly so development
  // logging, pooling and ports do not depend on the CLI's production/dev modes.
  process.env.LIVEKIT_DEV_MODE = '1';
  initializeLogger({ pretty: true, level: 'info' });
  const server = new AgentServer(
    new ServerOptions({
      agent: agentPath,
      agentName: process.env.LIVEKIT_AGENT_NAME ?? 'agentic-voice',
      wsURL: process.env.LIVEKIT_URL,
      production: false,
      host: '127.0.0.1',
      port: 0,
      numIdleProcesses: 0,
    }),
  );
  let closing: Promise<void> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (!closing) {
      // Also bound standalone voice:dev shutdown when no Nest supervisor exists.
      deadline = setTimeout(() => process.exit(1), 5000);
      closing = server.close();
    }
    return closing;
  };
  const interrupt = () => {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    await server.run();
  } finally {
    try {
      await stop();
    } finally {
      clearTimeout(deadline);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    }
  }
}
