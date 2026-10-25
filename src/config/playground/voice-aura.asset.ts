// Kept separate from room lifecycle so the renderer can be tested with audio fixtures.
export const VOICE_AURA_FACTORY = `
  function createAudioReactiveAura(canvas, onLevels) {
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
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.15;
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
      let peak = Math.min(1, Math.max(0, participant.audioLevel || 0) * 3);
      for (const entry of sources.values()) {
        if (entry.role !== role || entry.participant !== participant || entry.track.isMuted) continue;
        entry.analyser.getFloatTimeDomainData(entry.samples);
        entry.analyser.getByteFrequencyData(entry.frequencies);
        let sum = 0;
        for (const sample of entry.samples) sum += sample * sample;
        const rms = Math.sqrt(sum / entry.samples.length);
        // Fast, perceptual gain makes soft speech visible without amplifying silence.
        peak = Math.max(peak, Math.pow(Math.max(0, rms - 0.003) * 9, 0.72));
        for (let i = 0; i < bands.length; i += 1) {
          const bin = Math.min(entry.frequencies.length - 1, 2 + Math.round(Math.pow(i / 11, 1.6) * 100));
          bands[i] = Math.max(bands[i], entry.frequencies[bin] / 255);
        }
      }
      return { level: Math.min(1, peak), bands };
    }

    function trace(radius, amplitude, offset, bands, squash = 1) {
      context.beginPath();
      for (let i = 0; i <= 160; i += 1) {
        const angle = i / 160 * Math.PI * 2;
        const wave = Math.sin(angle * 3 + phase + offset) * 0.48 +
          Math.cos(angle * 5 - phase * 0.75 + offset) * 0.32 +
          Math.sin(angle * 7 + phase * 1.4) * 0.2;
        const spectrum = bands[Math.floor(i / 160 * 12) % 12] || 0;
        const r = radius + amplitude * wave + spectrum * amplitude * 0.5;
        const x = width / 2 + Math.cos(angle) * r;
        const y = height / 2 + Math.sin(angle) * r * squash;
        if (!i) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
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
        const timeConstant = target > levels[role] ? 0.025 : 0.12;
        levels[role] += (target - levels[role]) * (1 - Math.exp(-dt / timeConstant));
      }
      if (now - lastMeterAt >= 32) {
        onLevels({ ...levels }, { user: user.bands, agent: agent.bands });
        lastMeterAt = now;
      }
      const isUser = state === 'user-speaking';
      const volume = isUser ? levels.user : Math.max(levels.agent, levels.user * 0.35);
      const bands = isUser ? user.bands : agent.bands;
      const thinking = state === 'thinking';
      const reduced = motionPreference.matches;
      const targetHue = isUser ? 166 : thinking ? 254 : state === 'error' ? 12 : state === 'muted' ? 217 : 211;
      hue += (targetHue - hue) * (1 - Math.exp(-dt / 0.18));
      phase += dt * (reduced ? 0 : 0.45 + volume * 3 + (thinking ? 1.2 : 0));
      const radius = Math.min(width, height) * (0.247 + volume * (reduced ? 0.012 : 0.055));
      const amplitude = radius * (reduced ? 0.022 : 0.05 + volume * 0.22 + (thinking ? 0.035 : 0));
      context.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      context.save();

      const halo = context.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 1.8);
      halo.addColorStop(0, 'hsla(' + hue + ', 80%, 75%, .11)');
      halo.addColorStop(0.65, 'hsla(' + hue + ', 80%, 81%, .08)');
      halo.addColorStop(1, 'hsla(' + hue + ', 85%, 85%, 0)');
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      // Translucent, offset membranes give the Aura depth; audio deforms every layer.
      for (let layer = 0; layer < 7; layer += 1) {
        const color = hue + layer * 7 - 18;
        const gradient = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        gradient.addColorStop(0, 'hsla(' + (color - 38) + ', 80%, 69%, .28)');
        gradient.addColorStop(0.36, 'hsla(' + color + ', 84%, 67%, .08)');
        gradient.addColorStop(0.68, 'hsla(' + (color + 22) + ', 74%, 62%, .13)');
        gradient.addColorStop(1, 'hsla(' + (color + 40) + ', 79%, 63%, .32)');
        trace(radius * (1 - layer * 0.035), amplitude * (1 + layer * 0.09), layer * 0.8, bands, 0.98 + layer * 0.006);
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = 'hsla(' + (color - 10) + ', 76%, ' + (64 + layer * 2) + '%, ' + (0.28 - layer * 0.025) + ')';
        context.lineWidth = 1.3 + volume * 1.8;
        context.stroke();
      }
      const rim = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      rim.addColorStop(0, 'hsla(' + (hue - 45) + ', 85%, 68%, .9)');
      rim.addColorStop(0.48, 'hsla(' + hue + ', 86%, 80%, .15)');
      rim.addColorStop(1, 'hsla(' + (hue + 36) + ', 82%, 69%, .85)');
      context.strokeStyle = rim;
      context.shadowColor = 'hsla(' + hue + ', 80%, 66%, .5)';
      context.shadowBlur = 9 + volume * 19;
      context.lineWidth = 2.4 + volume * 4;
      trace(radius, amplitude, 0, bands);
      context.stroke();
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
