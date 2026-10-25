import { setTimeout as delay } from 'node:timers/promises';
import {
  AudioStream,
  Room,
  RoomEvent,
  TrackKind,
  dispose,
} from '@livekit/rtc-node';

// Opt-in provider check. No microphone is opened and no credentials/transcripts
// are printed. This verifies dispatch, inference, and received PCM, not speakers.
if (process.env.RUN_VOICE_SMOKE !== 'true') {
  throw new Error('Set RUN_VOICE_SMOKE=true to run the live voice check.');
}

const room = new Room();
const readers = new Set();
let requested = false;
let matchingReply = false;
let audibleFrames = 0;
let failed = false;
const deadline = Date.now() + 60_000;
async function until(check, stage) {
  while (!check()) {
    if (Date.now() > deadline || failed) throw new Error(stage);
    await delay(100);
  }
}

room.registerTextStreamHandler(
  'lk.transcription',
  async (reader, participant) => {
    try {
      const text = await reader.readAll();
      if (
        requested &&
        room.remoteParticipants.get(participant.identity)?.attributes[
          'lk.agent.state'
        ]
      ) {
        matchingReply ||= /voice check (seven|7)/i.test(text);
      }
    } catch {
      failed = true;
    }
  },
);
room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind !== TrackKind.KIND_AUDIO) return;
  const reader = new AudioStream(track).getReader();
  readers.add(reader);
  void (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (requested && value.data.some((sample) => Math.abs(sample) > 100))
          audibleFrames += 1;
      }
    } catch {
      failed = true;
    }
  })();
});

try {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || 3001}/v1/voice/token`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error('Voice credential endpoint failed');
  const payload = await response.json();
  const credentials = payload.data ?? payload;
  await room.connect(credentials.serverUrl, credentials.participantToken);
  console.log('PASS: API credentials and LiveKit room connection');
  await until(
    () =>
      Array.from(room.remoteParticipants.values()).some(
        (p) => p.attributes['lk.agent.state'] === 'listening',
      ),
    'Agent did not become ready',
  );
  console.log('PASS: dispatched voice agent is ready');
  requested = true;
  await room.localParticipant.sendText('Say exactly: Voice check seven.', {
    topic: 'lk.chat',
  });
  await until(
    () => matchingReply && audibleFrames > 5,
    'Expected transcript and audible reply were not received',
  );
  console.log(
    'PASS: requested reply transcript and non-silent audio frames received',
  );
} catch (error) {
  // Stage labels contain no provider secrets; omit raw network error objects.
  console.error(
    'FAIL:',
    error.message.startsWith('Agent ') || error.message.startsWith('Expected ')
      ? error.message
      : 'Voice connection or provider check failed',
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled(Array.from(readers, (reader) => reader.cancel()));
  await room.disconnect();
  await dispose();
}
