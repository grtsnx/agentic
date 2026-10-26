const staticGlyphs = {
  approval:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 8v8M15 8v8"/></svg>',
  stopping:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>',
};

export const ACTIVITY_INDICATOR_VIEW =
  '<span class="activity-orb" aria-hidden="true"><canvas class="activity-canvas" width="20" height="20"></canvas><span class="activity-symbol"><i class="orb-fallback"></i></span></span>';

export const ACTIVITY_INDICATOR_APP = `
  const staticOrbGlyphs = ${JSON.stringify(staticGlyphs)};
  const activityStates = { thinking: 'working', reconnecting: 'connecting', searching: 'searching', reading: 'composing', reviewing: 'solving', organizing: 'weaving', tool: 'shaping', handoff: 'connecting', responding: 'composing', approval: 'breathing', stopping: 'breathing' };
  const activityLabels = { Reconnecting: 'reconnecting', 'Searching the web': 'searching', 'Reading a page': 'reading', 'Reading the screen': 'reading', 'Preparing an action for approval': 'approval', 'Reviewing sources': 'reviewing', 'Reviewing information': 'reviewing', 'Organizing context': 'organizing', 'Stopping': 'stopping' };
  let orbEnginePromise;
  function loadOrbEngine() {
    return orbEnginePromise ??= import('/playground/orb-engine.js');
  }

  function createActivityOrb(canvas, loadEngine = loadOrbEngine) {
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return { setState() {}, setVisible() {}, dispose() {} };
    const size = 20;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = canvas.height = size * dpr;
    const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    let engine, preset, state = 'working', active = false, visible = true, disposed = false, raf = 0;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function draw() {
      if (!engine || !active || !visible || document.hidden || disposed) return;
      const time = motion?.matches ? 0.6 : performance.now() / 1000 * preset.speed;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      engine.paintFrame(ctx, engine.MODE_FRAMES[preset.mode](size, time, preset.opts), document.documentElement?.dataset.theme === 'dark');
      canvas.dataset.ready = 'true';
      if (!motion?.matches) raf = requestAnimationFrame(draw);
    }
    function refresh() { stop(); draw(); }
    const intersection = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); });
    intersection?.observe(canvas);
    const theme = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(refresh);
    theme?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', refresh);
    motion?.addEventListener?.('change', refresh);
    loadEngine().then((module) => {
      if (disposed) return;
      engine = module;
      preset = engine.resolvePreset(state, size);
      refresh();
    }).catch(() => {
      // A blocked canvas/module must never block chat. Keep the static fallback
      // and the accessible live status label if the decorative engine fails.
      canvas.dataset.ready = 'false';
    });
    return {
      setState(next) {
        if (disposed || state === next) return;
        state = next;
        if (engine) preset = engine.resolvePreset(state, size);
        refresh();
      },
      setVisible(next) { if (active === next || disposed) return; active = next; refresh(); },
      dispose() {
        disposed = true;
        stop();
        intersection?.disconnect();
        theme?.disconnect();
        document.removeEventListener('visibilitychange', refresh);
        motion?.removeEventListener?.('change', refresh);
      },
    };
  }

  function updateActivityIndicator(message, data) {
    // Match real provider activity to the library's visual states, never a timer.
    const activity = Object.hasOwn(activityLabels, data.message) ? activityLabels[data.message]
      : Object.hasOwn(activityStates, data.phase) ? data.phase : 'thinking';
    if (message.status.dataset.activity !== activity) {
      message.status.dataset.activity = activity;
      message.activitySymbol.innerHTML = staticOrbGlyphs[activity] ?? '<i class="orb-fallback"></i>';
    }
    message.orb.setState(activityStates[activity]);
    message.orb.setVisible(!Object.hasOwn(staticOrbGlyphs, activity));
  }
`;

export const ACTIVITY_INDICATOR_STYLES = `
.activity-orb { position: relative; display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 28px; color: var(--muted); }
.activity-canvas { display: block; width: 20px; height: 20px; }
.activity-symbol { position: absolute; display: grid; place-items: center; width: 20px; height: 20px; }
.activity-symbol svg { width: 19px; height: 19px; }
.activity-canvas[data-ready='true'] + .activity-symbol { display: none; }
.orb-fallback { width: 17px; height: 17px; border: 2px dotted currentColor; border-radius: 50%; opacity: .6; }
.agent-status[data-activity='approval'] .activity-canvas, .agent-status[data-activity='stopping'] .activity-canvas { display: none; }
.agent-status[data-activity='approval'] .activity-symbol, .agent-status[data-activity='stopping'] .activity-symbol { display: grid; }
.agent-status[data-activity='approval'] .status-label, .agent-status[data-activity='stopping'] .status-label { animation: none; background: none; color: var(--muted); }
`;
