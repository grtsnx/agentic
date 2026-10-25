export const LIVEKIT_BROWSER_APP = `(() => {
  const elements = {
    audio: document.querySelector('#voice-audio'),
    aura: document.querySelector('#voice-aura'),
    connect: document.querySelector('#voice-connect'),
    elapsed: document.querySelector('#voice-elapsed'),
    end: document.querySelector('#voice-end'),
    label: document.querySelector('#voice-label'),
    mute: document.querySelector('#voice-mute'),
    quality: document.querySelector('#voice-quality'),
    session: document.querySelector('#voice-session'),
    sessionHint: document.querySelector('#voice-session-hint'),
    sessionState: document.querySelector('#voice-session-state'),
    status: document.querySelector('#voice-status'),
    statusLabel: document.querySelector('#voice-status-label'),
    transcript: document.querySelector('#voice-transcript'),
    transcriptEmpty: document.querySelector('#voice-transcript-empty'),
  };

  const agentStateLabels = {
    connecting: 'Connecting agent…',
    'pre-connect-buffering': 'Preparing audio…',
    initializing: 'Initializing agent…',
    idle: 'Agent ready',
    listening: 'Listening',
    thinking: 'Agentic is thinking…',
    speaking: 'Agentic is speaking',
    disconnected: 'Voice ended',
    failed: 'Agent unavailable',
  };
  const agentStateHints = {
    connecting: 'Securing a realtime session.',
    'pre-connect-buffering': 'Preparing clear, low-latency audio.',
    initializing: 'Agentic is joining the conversation.',
    idle: 'Say something whenever you are ready.',
    listening: 'Go ahead—Agentic is listening.',
    thinking: 'Working through what you said.',
    speaking: 'Interrupt anytime. Agentic will listen.',
    'agent-speaking': 'Interrupt anytime. Agentic will listen.',
    'user-speaking': 'Agentic is listening to you.',
    muted: 'Unmute when you are ready to continue.',
    disconnected: 'Your completed transcript remains in the chat.',
    error: 'Return to chat or try the microphone again.',
    failed: 'Return to chat or try the microphone again.',
  };
  const transcriptRows = new Map();
  const pendingSegments = new Map();
  const committedSegments = new Set();
  let connecting = false;
  let elapsedTimer;
  let ending = false;
  let room;
  let transcriptFrame;
  let voiceStartedAt;

  function createAudioReactiveAura(canvas) {
    const context = canvas.getContext('2d');
    const audioSources = [];
    const connectedTracks = new WeakSet();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame;
    let audioContext;
    let lastFrameAt = performance.now();
    let phase = 0;
    let smoothedVolume = 0;
    let state = 'connecting';

    const stateProfiles = {
      connecting: { hue: 200, energy: 0.3, speed: 1.5 },
      initializing: { hue: 190, energy: 0.36, speed: 1.8 },
      idle: { hue: 185, energy: 0.25, speed: 0.65 },
      listening: { hue: 166, energy: 0.38, speed: 1 },
      thinking: { hue: 266, energy: 0.52, speed: 2.3 },
      'agent-speaking': { hue: 196, energy: 0.48, speed: 1.7 },
      'user-speaking': { hue: 152, energy: 0.42, speed: 1.35 },
      muted: { hue: 220, energy: 0.18, speed: 0.45 },
      disconnected: { hue: 220, energy: 0.12, speed: 0.3 },
      error: { hue: 4, energy: 0.28, speed: 0.8 },
      failed: { hue: 4, energy: 0.28, speed: 0.8 },
    };

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function readVolume() {
      let peak = 0;
      const activeRole = state === 'agent-speaking' ? 'agent' : state === 'user-speaking' ? 'user' : undefined;
      for (const source of audioSources) {
        if (activeRole && source.role !== activeRole) continue;
        source.analyser.getByteTimeDomainData(source.data);
        let squareTotal = 0;
        for (const sample of source.data) {
          const centeredSample = (sample - 128) / 128;
          squareTotal += centeredSample * centeredSample;
        }
        const rms = Math.sqrt(squareTotal / source.data.length);
        peak = Math.max(peak, Math.max(0, rms - 0.012) * 8.5);
      }
      return Math.min(1, peak);
    }

    function traceAura(centerX, centerY, radius, amplitude, time, offset = 0) {
      context.beginPath();
      const points = reducedMotion ? 72 : 128;
      for (let index = 0; index <= points; index += 1) {
        const angle = (index / points) * Math.PI * 2;
        const wave =
          Math.sin(angle * 3 + time * 1.1 + offset) * 0.55 +
          Math.sin(angle * 5 - time * 0.8 + offset * 2) * 0.3 +
          Math.sin(angle * 9 + time * 0.45) * 0.15;
        const pointRadius = radius + wave * amplitude;
        const x = centerX + Math.cos(angle) * pointRadius;
        const y = centerY + Math.sin(angle) * pointRadius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
    }

    function draw(now) {
      animationFrame = requestAnimationFrame(draw);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const elapsed = Math.min(40, now - lastFrameAt) / 1000;
      const profile = stateProfiles[state] ?? stateProfiles.idle;
      const rawVolume = readVolume();
      smoothedVolume += (rawVolume - smoothedVolume) * (rawVolume > smoothedVolume ? 0.32 : 0.09);
      phase += elapsed * profile.speed * (reducedMotion ? 0.2 : 1);
      lastFrameAt = now;

      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * (0.265 + smoothedVolume * 0.018);
      const isSpeaking = state === 'agent-speaking' || state === 'user-speaking';
      const energy = profile.energy + (isSpeaking ? smoothedVolume * 1.15 : smoothedVolume * 0.32);
      const amplitude = radius * (0.045 + energy * 0.12);
      const gradient = context.createLinearGradient(
        centerX - radius,
        centerY - radius,
        centerX + radius,
        centerY + radius,
      );
      gradient.addColorStop(0, 'hsla(' + (profile.hue + 34) + ', 96%, 68%, .95)');
      gradient.addColorStop(0.46, 'hsla(' + profile.hue + ', 96%, 54%, 1)');
      gradient.addColorStop(1, 'hsla(' + (profile.hue - 38) + ', 90%, 52%, .88)');

      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = gradient;
      context.shadowColor = 'hsla(' + profile.hue + ', 95%, 55%, .72)';
      context.shadowBlur = 22 + energy * 34;
      context.globalAlpha = 0.18;
      context.lineWidth = 14 + energy * 10;
      traceAura(centerX, centerY, radius, amplitude * 1.25, phase, 0.9);
      context.stroke();
      context.globalAlpha = 0.88;
      context.lineWidth = 3.5 + energy * 4.5;
      traceAura(centerX, centerY, radius, amplitude, phase, 0);
      context.stroke();
      context.globalAlpha = 0.52;
      context.lineWidth = 1.4;
      traceAura(centerX, centerY, radius * 0.92, amplitude * 0.55, -phase * 0.72, 1.7);
      context.stroke();
      context.restore();
    }

    function addTrack(track, role) {
      if (!track?.mediaStreamTrack || connectedTracks.has(track)) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ??= new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      const source = audioContext.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
      source.connect(analyser);
      connectedTracks.add(track);
      audioSources.push({
        analyser,
        data: new Uint8Array(analyser.fftSize),
        role,
        source,
      });
      if (audioContext.state === 'suspended') void audioContext.resume();
    }

    function reset() {
      for (const source of audioSources) source.source.disconnect();
      audioSources.length = 0;
    }

    function setState(nextState) {
      state = nextState;
      canvas.dataset.state = nextState;
    }

    function start() {
      resize();
      if (!animationFrame) animationFrame = requestAnimationFrame(draw);
    }

    function stop() {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      reset();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    return { addTrack, reset, setState, start, stop };
  }

  const aura = createAudioReactiveAura(elements.aura);

  function openSession() {
    document.body.classList.add('voice-active');
    elements.session.hidden = false;
    aura.start();
  }

  function closeSession() {
    document.body.classList.remove('voice-active');
    elements.session.hidden = true;
    aura.stop();
  }

  function setStatus(label, state = 'idle', hint = agentStateHints[state]) {
    elements.status.hidden = false;
    elements.statusLabel.textContent = label;
    elements.status.dataset.state = state;
    elements.session.dataset.state = state;
    elements.sessionState.textContent = label;
    aura.setState(state);
    elements.sessionHint.textContent = hint ?? agentStateHints.idle;
  }

  function showAgentState(participant) {
    if (!participant || participant.identity === room?.localParticipant.identity) return false;
    const state = participant.attributes?.['lk.agent.state'];
    if (!state) return false;
    const visualState = state === 'speaking' ? 'agent-speaking' : state;
    setStatus(agentStateLabels[state] ?? 'Agent connected', visualState, agentStateHints[state]);
    return true;
  }

  function formatElapsed(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
      String(seconds % 60).padStart(2, '0');
  }

  function startElapsed() {
    voiceStartedAt = performance.now();
    clearInterval(elapsedTimer);
    elapsedTimer = setInterval(() => {
      elements.elapsed.textContent = formatElapsed(performance.now() - voiceStartedAt);
    }, 250);
  }

  function stopElapsed() {
    clearInterval(elapsedTimer);
    elapsedTimer = undefined;
  }

  function clearTranscript() {
    transcriptRows.clear();
    pendingSegments.clear();
    committedSegments.clear();
    for (const turn of elements.transcript.querySelectorAll('.voice-transcript-turn')) turn.remove();
    elements.transcriptEmpty.hidden = false;
  }

  function createTranscriptTurn(segment) {
    const article = document.createElement('article');
    article.className = 'voice-transcript-turn ' + segment.role;
    article.dataset.segmentId = segment.id;
    const speaker = document.createElement('div');
    speaker.className = 'speaker';
    speaker.textContent = segment.role === 'assistant' ? 'Agentic' : 'You';
    const words = document.createElement('p');
    words.className = 'words';
    article.append(speaker, words);
    elements.transcript.append(article);
    transcriptRows.set(segment.id, { article, words });
    return { article, words };
  }

  function flushTranscript() {
    transcriptFrame = undefined;
    for (const segment of pendingSegments.values()) {
      elements.transcriptEmpty.hidden = true;
      const turn = transcriptRows.get(segment.id) ?? createTranscriptTurn(segment);
      turn.words.textContent = segment.text;
      turn.article.classList.toggle('interim', !segment.final);
      if (segment.final && !committedSegments.has(segment.id) && segment.text.trim()) {
        committedSegments.add(segment.id);
        document.dispatchEvent(new CustomEvent('agentic:voice-transcript', {
          detail: { id: segment.id, role: segment.role, text: segment.text },
        }));
      }
    }
    pendingSegments.clear();
    elements.transcript.scrollTop = elements.transcript.scrollHeight;
  }

  function queueTranscript(segments, participant) {
    const role = participant?.isAgent ? 'assistant' : 'user';
    for (const segment of segments) pendingSegments.set(segment.id, { ...segment, role });
    if (!transcriptFrame) transcriptFrame = requestAnimationFrame(flushTranscript);
  }

  function updateQuality(quality, participant) {
    if (!participant || participant.identity !== room?.localParticipant.identity) return;
    elements.quality.textContent = 'Connection ' + String(quality).replaceAll('_', ' ').toLowerCase();
  }

  function resetControls() {
    connecting = false;
    elements.connect.disabled = false;
    elements.connect.setAttribute('aria-pressed', 'false');
    elements.connect.setAttribute('aria-label', 'Start voice chat');
    elements.label.textContent = 'Start voice chat';
    elements.mute.disabled = true;
    elements.mute.setAttribute('aria-pressed', 'false');
    elements.mute.querySelector('small').textContent = 'Mute';
    stopElapsed();
  }

  async function disconnect({ close = true } = {}) {
    ending = true;
    const activeRoom = room;
    room = undefined;
    resetControls();
    if (activeRoom) await activeRoom.disconnect();
    ending = false;
    setStatus('Voice ended', 'disconnected');
    if (close) closeSession();
  }

  function bindRoom(nextRoom) {
    nextRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === LivekitClient.Track.Kind.Audio) {
        elements.audio.append(track.attach());
        const role = participant?.isAgent ? 'agent' : 'user';
        aura.addTrack(track, role);
      }
    });
    nextRoom.on(LivekitClient.RoomEvent.TranscriptionReceived, queueTranscript);
    nextRoom.on(LivekitClient.RoomEvent.ConnectionQualityChanged, updateQuality);
    nextRoom.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const localIsSpeaking = speakers.some(
        (participant) => participant.identity === nextRoom.localParticipant.identity,
      );
      const agentIsSpeaking = speakers.some(
        (participant) => participant.identity !== nextRoom.localParticipant.identity,
      );
      if (localIsSpeaking) setStatus('You are speaking', 'user-speaking');
      else if (agentIsSpeaking) setStatus('Agentic is speaking', 'agent-speaking');
      else {
        const agent = Array.from(nextRoom.remoteParticipants.values()).find(showAgentState);
        if (!agent) setStatus('Listening', 'listening');
      }
    });
    nextRoom.on(
      LivekitClient.RoomEvent.ParticipantAttributesChanged,
      (_changedAttributes, participant) => showAgentState(participant),
    );
    nextRoom.on(LivekitClient.RoomEvent.ParticipantConnected, showAgentState);
    nextRoom.on(LivekitClient.RoomEvent.Disconnected, () => {
      if (ending) return;
      room = undefined;
      resetControls();
      setStatus('Connection ended', 'disconnected', 'Your transcript is safe in the chat.');
    });
  }

  async function connect() {
    if (room) return disconnect();
    if (connecting) return;

    connecting = true;
    openSession();
    clearTranscript();
    elements.connect.disabled = true;
    elements.mute.disabled = true;
    elements.quality.textContent = 'Checking connection…';
    elements.elapsed.textContent = '00:00';
    setStatus('Connecting voice…', 'connecting', 'Securing a realtime session.');

    let nextRoom;
    try {
      const response = await fetch('/v1/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Voice is unavailable');

      const credentials = payload.data ?? payload;
      nextRoom = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });
      bindRoom(nextRoom);
      await nextRoom.connect(credentials.serverUrl, credentials.participantToken);
      room = nextRoom;
      connecting = false;
      elements.connect.disabled = false;
      elements.connect.setAttribute('aria-pressed', 'true');
      elements.connect.setAttribute('aria-label', 'End voice chat');
      elements.label.textContent = 'End voice chat';
      elements.mute.disabled = false;
      startElapsed();
      setStatus('Enable microphone access…', 'initializing', 'Allow microphone access, then speak naturally.');

      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      if (room !== nextRoom) return;
      const microphone = nextRoom.localParticipant.getTrackPublication(
        LivekitClient.Track.Source.Microphone,
      )?.track;
      if (microphone) aura.addTrack(microphone, 'user');
      setStatus('Waiting for agent…', 'initializing', 'The agent is joining your session.');
    } catch (error) {
      if (nextRoom) await nextRoom.disconnect();
      room = undefined;
      resetControls();
      const message = error instanceof Error ? error.message : 'Voice connection failed';
      const safeMessage = message.includes('Failed to fetch')
        ? 'Cannot reach LiveKit Cloud. Check VPN or firewall access.'
        : message.includes('Permission') || message.includes('NotAllowed')
          ? 'Microphone access is required for voice chat.'
          : message;
      setStatus(safeMessage, 'error', 'Return to chat or try the microphone again.');
    }
  }

  async function toggleMute() {
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    elements.mute.setAttribute('aria-pressed', String(enabled));
    elements.mute.querySelector('small').textContent = enabled ? 'Unmute' : 'Mute';
    setStatus(enabled ? 'Microphone muted' : 'Listening', enabled ? 'muted' : 'listening');
  }

  elements.connect.addEventListener('click', connect);
  elements.end.addEventListener('click', () => disconnect());
  elements.mute.addEventListener('click', toggleMute);
  window.addEventListener('beforeunload', () => room?.disconnect());
})();`;
