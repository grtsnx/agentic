import { runLiveKitVoiceWorker } from '@/config';

try {
  await runLiveKitVoiceWorker();
} catch {
  console.error(
    '[Voice] Worker stopped unexpectedly. Check the preceding LiveKit logs and .env.',
  );
  process.exitCode = 1;
}
