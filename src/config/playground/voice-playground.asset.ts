import { VOICE_AURA_FACTORY } from './voice-aura.asset.js';

export const LIVEKIT_BROWSER_APP = `(() => {
  ${VOICE_AURA_FACTORY}
  const elements = Object.fromEntries([
    'audio', 'aura', 'connect', 'elapsed', 'end', 'start', 'back', 'label',
    'mute', 'quality', 'session', 'session-hint', 'session-state', 'title',
    'status', 'status-label', 'transcript', 'transcript-empty', 'transcript-panel',
    'transcript-toggle', 'live-label', 'user', 'agent', 'user-state', 'agent-state',
    'user-meter', 'agent-meter', 'enable-audio', 'toast',
  ].map((name) => [name, document.querySelector('#voice-' + name)]));
  const appShell = document.querySelector('.app-shell');
  const rows = new Map();
  const pendingSegments = new Map();
  const committedSegments = new Set();
  let room;
  let attempt = 0;
  let tokenRequest;
  let connecting = false;
  let reconnecting = false;
  let microphoneReady = false;
  let transcriptFrame;
  let elapsedTimer;
  let toastTimer;
  let startedAt;
  let activeSpeakers = new Set();

  const copy = {
    idle: ['Ready when you are', "Let's talk.", 'A question, a big idea, or just a hello. Make yourself heard.'],
    connecting: ['Connecting', 'A moment, together.', 'Getting your conversation ready.'],
    initializing: ['Getting ready', 'Almost here.', 'Agentic is joining. Your conversation will begin shortly.'],
    listening: ['Listening to you', "I'm all ears.", 'Take your time. You can speak naturally.'],
    'user-speaking': ['Your turn', 'Keep going.', 'You have my attention.'],
    'agent-speaking': ['Agentic is speaking', 'A thought for you.', 'You can jump in whenever you like.'],
    thinking: ['Thinking it through', 'Let me think.', 'Making a little space for a good answer.'],
    muted: ['Microphone muted', 'Take a moment.', "Unmute whenever you're ready to continue."],
    disconnected: ['', 'Good talking with you.', 'Your conversation is still here. Start again whenever you like.'],
    error: ['Something interrupted us', "Let's try again.", 'Check your connection, then start a new conversation.'],
  };

  function renderLevels(levels, bands) {
    for (const role of ['user', 'agent']) {
      const level = levels[role];
      const active = level > 0.035;
      elements[role].dataset.active = String(active);
      const bars = elements[role + '-meter'].children;
      for (let i = 0; i < bars.length; i += 1) {
        const spectrum = bands[role]?.[i * 2] || 0;
        const scale = Math.min(1, 0.15 + level * (0.55 + spectrum * 0.65) * (i === 2 ? 1.4 : 1));
        bars[i].style.transform = 'scaleY(' + scale.toFixed(3) + ')';
      }
    }
  }

  const aura = createAudioReactiveAura(elements.aura, renderLevels);

  function clearToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = undefined;
    elements.toast.hidden = true;
    elements.toast.textContent = '';
  }

  function showToast(message) {
    if (!elements.toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(clearToast, 6500);
  }

  function isAgent(participant) {
    return participant?.isAgent === true;
  }

  function currentAgent() {
    return room ? Array.from(room.remoteParticipants.values()).find(isAgent) : undefined;
  }

  function renderState(state, detail) {
    const [label, title, hint] = copy[state] || copy.idle;
    elements.session.dataset.state = state;
    elements.status.hidden = !label;
    elements.status.dataset.state = state;
    elements['status-label'].textContent = label;
    elements['session-state'].textContent = label;
    elements['session-state'].hidden = !label;
    elements.title.textContent = title;
    elements['session-hint'].textContent = detail || hint;
    aura.setState(state);
  }

  function syncState() {
    const agent = currentAgent();
    const user = room?.localParticipant;
    aura.setParticipants(user, agent);
    const agentState = agent?.attributes?.['lk.agent.state'];
    const userSpeaking = user?.isMicrophoneEnabled &&
      (activeSpeakers.has(user.identity) || user.isSpeaking);
    const agentSpeaking = agent &&
      (activeSpeakers.has(agent.identity) || agent.isSpeaking || agentState === 'speaking');
    elements['user-state'].textContent = !microphoneReady ? 'Mic off' :
      !user?.isMicrophoneEnabled ? 'Muted' : userSpeaking ? 'Speaking' : 'Connected';
    elements['agent-state'].textContent = !agent ? (connecting ? 'Joining' : 'Ready') :
      agentSpeaking ? 'Speaking' : agentState === 'thinking' ? 'Thinking' : 'Listening';
    elements.session.dataset.connected = String(Boolean(room && !connecting));
    elements['live-label'].textContent = reconnecting ? 'Reconnecting' : room && !connecting ? 'Live' : 'Ready';

    // Derive one visual state from identified participants; late attributes cannot
    // overwrite local speech, and unrelated remote participants never become Agentic.
    const state = connecting || reconnecting ? 'connecting' :
      !room ? 'idle' : !microphoneReady || !agent ? 'initializing' :
      userSpeaking ? 'user-speaking' :
      agentSpeaking ? 'agent-speaking' :
      ['failed', 'disconnected'].includes(agentState) ? 'error' :
      !user?.isMicrophoneEnabled ? 'muted' :
      agentState === 'thinking' ? 'thinking' :
      ['initializing', 'connecting', 'pre-connect-buffering'].includes(agentState) ? 'initializing' :
      'listening';
    renderState(state);
  }

  function formatElapsed(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function openSession() {
    if (!elements.session.hidden) return;
    elements.session.hidden = false;
    appShell.inert = true;
    document.body.classList.add('voice-active');
    aura.start();
    renderState('connecting');
    // The microphone button is the conversation entry point. Start signaling
    // immediately so the user never lands in a second, inert screen.
    void connect();
  }

  function closeSession() {
    elements.session.hidden = true;
    appShell.inert = false;
    document.body.classList.remove('voice-active');
    aura.stop();
    elements.connect.focus();
  }

  function clearTranscript() {
    if (transcriptFrame) cancelAnimationFrame(transcriptFrame);
    transcriptFrame = undefined;
    rows.clear();
    pendingSegments.clear();
    committedSegments.clear();
    for (const row of elements.transcript.querySelectorAll('.voice-transcript-turn')) row.remove();
    elements['transcript-empty'].hidden = false;
  }

  function flushTranscript() {
    transcriptFrame = undefined;
    const follow = elements.transcript.scrollHeight - elements.transcript.scrollTop -
      elements.transcript.clientHeight < 80;
    for (const segment of pendingSegments.values()) {
      elements['transcript-empty'].hidden = true;
      let row = rows.get(segment.id);
      if (!row) {
        const article = document.createElement('article');
        article.className = 'voice-transcript-turn ' + segment.role;
        const speaker = document.createElement('div');
        speaker.className = 'speaker';
        speaker.textContent = segment.role === 'assistant' ? 'Agentic' : 'You';
        const time = document.createElement('time');
        time.textContent = startedAt ? formatElapsed(performance.now() - startedAt) : '00:00';
        speaker.append(time);
        const words = document.createElement('p');
        words.className = 'words';
        article.append(speaker, words);
        elements.transcript.append(article);
        row = { article, words };
        rows.set(segment.id, row);
      }
      row.words.textContent = segment.text;
      row.article.classList.toggle('interim', !segment.final);
      if (segment.final && !committedSegments.has(segment.id) && segment.text.trim()) {
        committedSegments.add(segment.id);
        document.dispatchEvent(new CustomEvent('agentic:voice-transcript', {
          detail: { id: segment.id, role: segment.role, text: segment.text },
        }));
      }
    }
    pendingSegments.clear();
    if (follow) elements.transcript.scrollTop = elements.transcript.scrollHeight;
  }

  function queueTranscript(segments, participant) {
    const role = participant?.identity === room?.localParticipant.identity ? 'user' :
      isAgent(participant) ? 'assistant' : undefined;
    if (!role) return;
    for (const segment of segments) {
      const id = participant.identity + ':' + segment.id;
      if (!committedSegments.has(id)) pendingSegments.set(id, { ...segment, id, role });
    }
    if (!transcriptFrame) transcriptFrame = requestAnimationFrame(flushTranscript);
  }

  function resetControls() {
    connecting = false;
    reconnecting = false;
    microphoneReady = false;
    activeSpeakers.clear();
    elements.connect.setAttribute('aria-pressed', 'false');
    elements.start.hidden = false;
    elements.start.disabled = false;
    elements.end.hidden = true;
    elements.mute.disabled = true;
    elements.mute.setAttribute('aria-pressed', 'false');
    elements.mute.setAttribute('aria-label', 'Mute microphone');
    elements['enable-audio'].hidden = true;
    elements.session.dataset.connected = 'false';
    elements['live-label'].textContent = 'Ended';
    elements['user-state'].textContent = 'Mic off';
    elements['agent-state'].textContent = 'Offline';
    clearInterval(elapsedTimer);
    elapsedTimer = undefined;
    aura.reset();
    elements.audio.replaceChildren();
  }

  async function disconnect(close = false) {
    attempt += 1;
    tokenRequest?.abort();
    tokenRequest = undefined;
    const previous = room;
    room = undefined;
    if (pendingSegments.size) flushTranscript();
    resetControls();
    renderState('disconnected');
    elements.quality.textContent = 'Microphone off';
    if (close) closeSession();
    if (previous) {
      try { await previous.disconnect(); } catch {
        // The UI is already detached; an unavailable signaling server cannot block exit.
      } finally { previous.removeAllListeners(); }
    }
  }

  function syncTracks(nextRoom) {
    const microphone = nextRoom.localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone)?.track;
    if (microphone) aura.addTrack(microphone, 'user', nextRoom.localParticipant);
    const agent = currentAgent();
    if (agent) {
      for (const publication of agent.audioTrackPublications.values()) {
        if (publication.track) aura.addTrack(publication.track, 'agent', agent);
      }
    }
    syncState();
  }

  function bindRoom(nextRoom) {
    const on = (event, handler) => nextRoom.on(event, (...args) => {
      if (room === nextRoom) handler(...args);
    });
    on(LivekitClient.RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind !== LivekitClient.Track.Kind.Audio || !isAgent(participant)) return;
      elements.audio.append(track.attach());
      aura.addTrack(track, 'agent', participant);
      syncState();
    });
    on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      aura.removeTrack(track);
      for (const element of track.detach()) element.remove();
    });
    on(LivekitClient.RoomEvent.LocalTrackPublished, () => syncTracks(nextRoom));
    on(LivekitClient.RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.track) aura.removeTrack(publication.track);
      syncState();
    });
    on(LivekitClient.RoomEvent.TranscriptionReceived, queueTranscript);
    on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
      activeSpeakers = new Set(speakers.map((participant) => participant.identity));
      syncState();
    });
    on(LivekitClient.RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      if (isAgent(participant)) syncTracks(nextRoom);
    });
    on(LivekitClient.RoomEvent.ParticipantConnected, () => syncTracks(nextRoom));
    on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
      if (!isAgent(participant)) { syncTracks(nextRoom); return; }
      // A departed worker cannot resume this call. Release the microphone and
      // offer a new connection instead of leaving the user waiting indefinitely.
      void disconnect();
      renderState('error', 'The conversation was interrupted. Your transcript is still here. Start again to reconnect.');
    });
    on(LivekitClient.RoomEvent.TrackMuted, syncState);
    on(LivekitClient.RoomEvent.TrackUnmuted, syncState);
    on(LivekitClient.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant?.identity !== nextRoom.localParticipant.identity) return;
      elements.quality.textContent = quality === 'poor' || quality === 'lost'
        ? 'Connection is unstable. Audio may take a moment.' : 'Connected · You can interrupt anytime';
    });
    on(LivekitClient.RoomEvent.Reconnecting, () => {
      reconnecting = true;
      syncState();
      elements.quality.textContent = 'Reconnecting your conversation…';
      showToast('Network issue. Reconnecting your voice conversation…');
    });
    on(LivekitClient.RoomEvent.Reconnected, () => {
      reconnecting = false;
      clearToast();
      syncTracks(nextRoom);
      elements.quality.textContent = 'Connected · You can interrupt anytime';
    });
    on(LivekitClient.RoomEvent.AudioPlaybackStatusChanged, () => {
      elements['enable-audio'].hidden = nextRoom.canPlaybackAudio;
    });
    on(LivekitClient.RoomEvent.Disconnected, () => {
      room = undefined;
      attempt += 1;
      resetControls();
      renderState('disconnected');
      elements.quality.textContent = 'Connection ended · Your transcript remains here';
      showToast('Network issue. Your voice conversation ended. Start again when ready.');
      nextRoom.removeAllListeners();
    });
  }

  async function connect() {
    if (room || connecting) return;
    const currentAttempt = ++attempt;
    connecting = true;
    clearTranscript();
    aura.prepareAudio();
    elements.start.hidden = true;
    elements.end.hidden = false;
    elements.mute.disabled = true;
    elements.elapsed.textContent = '00:00';
    elements.quality.textContent = 'Connecting your conversation…';
    renderState('connecting');
    const controller = new AbortController();
    tokenRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    let nextRoom;
    try {
      const response = await fetch('/v1/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error('Voice is unavailable. Check that the voice server is enabled.');
      const credentials = payload.data ?? payload;
      if (attempt !== currentAttempt) return;
      nextRoom = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      room = nextRoom;
      bindRoom(nextRoom);
      await nextRoom.connect(credentials.serverUrl, credentials.participantToken);
      if (attempt !== currentAttempt) { await nextRoom.disconnect(); return; }
      connecting = false;
      elements.connect.setAttribute('aria-pressed', 'true');
      startedAt = performance.now();
      elapsedTimer = setInterval(() => {
        elements.elapsed.textContent = formatElapsed(performance.now() - startedAt);
      }, 250);
      // Autoplay restrictions should not tear down a healthy voice connection.
      await nextRoom.startAudio().catch(() => {
        elements['enable-audio'].hidden = false;
      });
      if (room !== nextRoom || attempt !== currentAttempt) return;
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      if (room !== nextRoom || attempt !== currentAttempt) {
        // A microphone permission dialog may resolve after the user ends the call.
        await nextRoom.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        return;
      }
      microphoneReady = true;
      elements.mute.disabled = false;
      clearToast();
      elements.quality.textContent = 'Connected · You can interrupt anytime';
      syncTracks(nextRoom);
    } catch (error) {
      if (attempt !== currentAttempt) return;
      room = undefined;
      if (nextRoom) {
        await nextRoom.disconnect().catch(() => {});
        nextRoom.removeAllListeners();
      }
      resetControls();
      const name = error?.name || '';
      const message = error instanceof Error ? error.message : '';
      const detail = name === 'NotAllowedError' || /permission|notallowed/i.test(message)
        ? 'Allow microphone access in your browser, then try again.'
        : name === 'NotFoundError' ? 'Connect a microphone and try again.'
        : name === 'AbortError' ? 'The connection took too long. Try again.'
        : 'We could not connect to voice. Check your connection and that the voice worker is running.';
      const networkFailure = name === 'AbortError' || /network|fetch|failed|unavailable|signal|timeout|websocket/i.test(message);
      if (networkFailure) showToast('Network issue. Check your connection and try again.');
      renderState('error', detail);
      elements.quality.textContent = 'Microphone off';
    } finally {
      clearTimeout(timeout);
      if (tokenRequest === controller) tokenRequest = undefined;
    }
  }

  async function toggleMute() {
    const activeRoom = room;
    if (!activeRoom || !microphoneReady) return;
    elements.mute.disabled = true;
    try {
      const wasEnabled = activeRoom.localParticipant.isMicrophoneEnabled;
      await activeRoom.localParticipant.setMicrophoneEnabled(!wasEnabled);
      if (room !== activeRoom) return;
      elements.mute.setAttribute('aria-pressed', String(wasEnabled));
      elements.mute.setAttribute('aria-label', wasEnabled ? 'Unmute microphone' : 'Mute microphone');
      syncTracks(activeRoom);
    } catch {
      elements.quality.textContent = 'Microphone could not be changed. Try again.';
    } finally {
      elements.mute.disabled = !microphoneReady;
    }
  }

  elements.connect.addEventListener('click', openSession);
  elements.start.addEventListener('click', connect);
  elements.end.addEventListener('click', () => void disconnect());
  elements.back.addEventListener('click', () => void disconnect(true));
  elements.mute.addEventListener('click', toggleMute);
  elements['enable-audio'].addEventListener('click', () => {
    aura.prepareAudio();
    void room?.startAudio().catch(() => {
      elements.quality.textContent = 'Audio is blocked. Check your browser sound permission.';
    });
  });
  elements['transcript-toggle'].addEventListener('click', () => {
    const hidden = !elements['transcript-panel'].hidden;
    elements['transcript-panel'].hidden = hidden;
    elements.session.dataset.transcript = hidden ? 'hidden' : 'visible';
    elements['transcript-toggle'].setAttribute('aria-pressed', String(!hidden));
  });
  elements.session.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') void disconnect(true);
    if (event.key !== 'Tab') return;
    const controls = Array.from(elements.session.querySelectorAll('button')).filter(
      (button) => !button.disabled && button.getClientRects().length,
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  window.addEventListener('pagehide', () => {
    tokenRequest?.abort();
    void room?.disconnect();
    aura.stop();
  });
})();`;
