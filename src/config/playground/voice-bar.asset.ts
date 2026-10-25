// Kept separate from room lifecycle so the renderer can be tested with audio fixtures.
export const VOICE_BAR_FACTORY = `
  function createAudioReactiveBars(canvas, onLevels) {
    const context = canvas.getContext('2d');
    const sources = new Map();
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const participants = { user: undefined, agent: undefined };
    const levels = { user: 0, agent: 0 };
    let audioContext;
    let animationFrame;
    let state = 'idle';
    let width = 0;
    let height = 0;
    let phase = 0;
    let lastFrameAt = 0;
    let lastMeterAt = 0;
    let hue = 214;

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !context) return;
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function prepareAudio() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ??= new AudioContextClass({ latencyHint: 'interactive' });
      // Resume in the click gesture, before token/signaling requests yield control.
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    }

    function addTrack(track, role, participant) {
      const mediaTrack = track?.mediaStreamTrack;
      if (!mediaTrack || sources.has(mediaTrack.id) || !['user', 'agent'].includes(role)) return;
      prepareAudio();
      if (!audioContext) return;
      try {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.05;
        const source = audioContext.createMediaStreamSource(new MediaStream([mediaTrack]));
        source.connect(analyser);
        sources.set(mediaTrack.id, {
          analyser, source, role, participant, track,
          samples: new Float32Array(analyser.fftSize),
          frequencies: new Uint8Array(analyser.frequencyBinCount),
        });
      } catch {
        // SDK audioLevel remains available when Web Audio cannot inspect a track.
      }
    }

    function removeTrack(track) {
      const key = track?.mediaStreamTrack?.id;
      const entry = sources.get(key);
      if (!entry) return;
      entry.source.disconnect();
      entry.analyser.disconnect();
      sources.delete(key);
    }

    function readAudio(role) {
      const participant = participants[role];
      const bands = new Array(12).fill(0);
      if (!participant || (role === 'user' && !participant.isMicrophoneEnabled)) return { level: 0, bands };
      let peak = Math.min(1, Math.max(0, participant.audioLevel || 0) * 7);
      for (const entry of sources.values()) {
        if (entry.role !== role || entry.participant !== participant || entry.track.isMuted) continue;
        entry.analyser.getFloatTimeDomainData(entry.samples);
        entry.analyser.getByteFrequencyData(entry.frequencies);
        let sum = 0;
        for (const sample of entry.samples) sum += sample * sample;
        const rms = Math.sqrt(sum / entry.samples.length);
        // Fast, perceptual gain makes soft speech visible without amplifying silence.
        peak = Math.max(peak, Math.pow(Math.max(0, rms - 0.002) * 15, 0.64));
        for (let i = 0; i < bands.length; i += 1) {
          const bin = Math.min(entry.frequencies.length - 1, 2 + Math.round(Math.pow(i / 11, 1.6) * 100));
          bands[i] = Math.max(bands[i], entry.frequencies[bin] / 255);
        }
      }
      return { level: Math.min(1, peak), bands };
    }

    function draw(now) {
      animationFrame = requestAnimationFrame(draw);
      if (!context || !width || !height || document.hidden) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - (lastFrameAt || now - 16)) / 1000));
      lastFrameAt = now;
      const user = readAudio('user');
      const agent = readAudio('agent');
      for (const role of ['user', 'agent']) {
        const target = role === 'user' ? user.level : agent.level;
        const timeConstant = target > levels[role] ? 0.008 : 0.065;
        levels[role] += (target - levels[role]) * (1 - Math.exp(-dt / timeConstant));
      }
      if (now - lastMeterAt >= 16) {
        onLevels({ ...levels }, { user: user.bands, agent: agent.bands });
        lastMeterAt = now;
      }
      // Follow live levels immediately, even before a speaker-change event arrives.
      const isUser = state === 'user-speaking' || levels.user > levels.agent;
      const volume = isUser ? levels.user : levels.agent;
      const bands = isUser ? user.bands : agent.bands;
      const thinking = state === 'thinking';
      const reduced = motionPreference.matches;
      const connecting = ['connecting', 'initializing'].includes(state);
      const quiet = ['muted', 'disconnected', 'error'].includes(state);
      const targetHue = state === 'error' ? 12 : isUser ? 166 : thinking ? 254 : 211;
      hue += (targetHue - hue) * (1 - Math.exp(-dt / 0.18));
      phase += reduced ? 0 : dt * (thinking ? 4 : 2.5);
      context.clearRect(0, 0, width, height);
      context.save();
      const barWidth = Math.min(width * 0.09, 34);
      const gap = barWidth * 0.45;
      const groupWidth = barWidth * 5 + gap * 4;
      const maxHeight = Math.min(height * 0.74, 240);
      // Five rounded bars mirror LiveKit Agents UI's Bar design. Speech height
      // uses PCM/frequency bands; only processing states use a decorative wave.
      for (let i = 0; i < 5; i += 1) {
        const envelope = [0.55, 0.82, 1, 0.82, 0.55][i];
        const spectrum = bands[i * 2] || 0;
        const ripple = reduced ? 0.35 : (Math.sin(phase - i * 0.9) + 1) / 2;
        const energy = quiet ? 0 : connecting ? 0.09 + ripple * 0.18
          : volume > 0.015 ? Math.min(1, volume * (0.35 + spectrum * 0.65)) * envelope
          : thinking ? 0.12 + ripple * 0.3 : 0;
        const barHeight = Math.min(maxHeight, barWidth + energy * (maxHeight - barWidth));
        const x = (width - groupWidth) / 2 + i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        const gradient = context.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, 'hsl(' + (hue - 12) + ', ' + (quiet ? 15 : 78) + '%, 64%)');
        gradient.addColorStop(1, 'hsl(' + (hue + 12) + ', ' + (quiet ? 15 : 72) + '%, 46%)');
        context.globalAlpha = quiet ? 0.4 : connecting ? 0.35 + ripple * 0.65 : 1;
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        context.fillStyle = gradient;
        context.fill();
      }
      context.restore();
    }

    function start() {
      resize();
      lastFrameAt = 0;
      if (!animationFrame) animationFrame = requestAnimationFrame(draw);
    }

    function reset() {
      for (const entry of sources.values()) {
        entry.source.disconnect();
        entry.analyser.disconnect();
      }
      sources.clear();
      participants.user = participants.agent = undefined;
      levels.user = levels.agent = 0;
      onLevels({ ...levels }, { user: [], agent: [] });
      if (audioContext) void audioContext.close().catch(() => {});
      audioContext = undefined;
    }

    function stop() {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      reset();
    }

    new ResizeObserver(resize).observe(canvas);
    return {
      addTrack, removeTrack, prepareAudio, start, stop, reset,
      setState(next) { state = next; canvas.dataset.state = state; },
      setParticipants(user, agent) { participants.user = user; participants.agent = agent; },
    };
  }
`;
