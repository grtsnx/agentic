export const LIVEKIT_BROWSER_APP = `(() => {
  const elements = {
    audio: document.querySelector('#voice-audio'),
    connect: document.querySelector('#voice-connect'),
    label: document.querySelector('#voice-label'),
    mute: document.querySelector('#voice-mute'),
    status: document.querySelector('#voice-status'),
  };
  let room;
  let connecting = false;

  function setStatus(label, state = 'idle') {
    elements.status.hidden = false;
    elements.status.textContent = label;
    elements.status.dataset.state = state;
  }

  function reset() {
    room = undefined;
    connecting = false;
    elements.connect.disabled = false;
    elements.connect.setAttribute('aria-pressed', 'false');
    elements.connect.setAttribute('aria-label', 'Start voice chat');
    elements.label.textContent = 'Start voice chat';
    elements.mute.hidden = true;
    elements.mute.textContent = 'Mute';
    setStatus('Voice offline');
  }

  async function disconnect() {
    const activeRoom = room;
    reset();
    if (activeRoom) await activeRoom.disconnect();
  }

  async function connect() {
    if (room) {
      await disconnect();
      return;
    }
    if (connecting) return;

    connecting = true;
    elements.connect.disabled = true;
    setStatus('Connecting voice…', 'connecting');

    try {
      const response = await fetch('/v1/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Voice is unavailable');

      const credentials = payload.data ?? payload;
      const nextRoom = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });
      nextRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === LivekitClient.Track.Kind.Audio) {
          elements.audio.append(track.attach());
        }
      });
      nextRoom.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localIsSpeaking = speakers.some(
          (participant) => participant.identity === nextRoom.localParticipant.identity,
        );
        const agentIsSpeaking = speakers.some(
          (participant) => participant.identity !== nextRoom.localParticipant.identity,
        );
        setStatus(
          localIsSpeaking ? 'You are speaking' : agentIsSpeaking ? 'Agent speaking' : 'Listening',
          localIsSpeaking || agentIsSpeaking ? 'speaking' : 'listening',
        );
      });
      nextRoom.on(LivekitClient.RoomEvent.Disconnected, reset);

      await nextRoom.connect(credentials.serverUrl, credentials.participantToken);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      room = nextRoom;
      connecting = false;
      elements.connect.disabled = false;
      elements.connect.setAttribute('aria-pressed', 'true');
      elements.connect.setAttribute('aria-label', 'End voice chat');
      elements.label.textContent = 'End voice chat';
      elements.mute.hidden = false;
      setStatus('Listening', 'listening');
    } catch (error) {
      reset();
      setStatus(error instanceof Error ? error.message : 'Voice connection failed', 'error');
    }
  }

  async function toggleMute() {
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    elements.mute.textContent = enabled ? 'Unmute' : 'Mute';
    setStatus(enabled ? 'Muted' : 'Listening', enabled ? 'muted' : 'listening');
  }

  elements.connect.addEventListener('click', connect);
  elements.mute.addEventListener('click', toggleMute);
  window.addEventListener('beforeunload', () => room?.disconnect());
})();`;
