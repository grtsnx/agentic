export const PLAYGROUND_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agentic</title>
    <link rel="stylesheet" href="/playground/styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/playground" aria-label="Agentic home">
          <span class="brand-mark" aria-hidden="true">A</span>
          <span>Agentic</span>
        </a>
        <div class="topbar-actions">
          <span id="connection" class="connection" role="status">
            <span class="connection-dot" aria-hidden="true"></span>
            Connecting
          </span>
          <button id="new-chat" class="quiet-button" type="button">New chat</button>
        </div>
      </header>

      <main id="conversation" class="conversation">
        <section id="empty-state" class="empty-state">
          <span class="agent-orb" aria-hidden="true">✦</span>
          <h1>How can I help you today?</h1>
          <p>Ask a question and watch the agent work in real time.</p>
        </section>
        <div id="messages" class="messages" aria-live="polite"></div>
      </main>

      <footer class="composer-wrap">
        <div class="composer">
          <label class="sr-only" for="message">Message Agentic</label>
          <textarea id="message" rows="1" maxlength="8000" placeholder="Message Agentic"></textarea>
          <div class="composer-actions">
            <div class="composer-status">
              <span class="composer-hint">Enter to send · Shift + Enter for a new line</span>
              <span id="voice-status" class="voice-status" role="status" hidden>
                <span class="voice-visualizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                <span id="voice-status-label">Voice offline</span>
              </span>
            </div>
            <div class="composer-buttons">
              <button id="voice-connect" class="voice-button" type="button" aria-pressed="false" aria-label="Start voice chat">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M18 11v1a6 6 0 0 1-12 0v-1M12 18v3M9 21h6"/></svg>
                <span id="voice-label" class="sr-only">Start voice chat</span>
              </button>
              <button id="stop" class="stop-button" type="button" aria-label="Stop response" hidden>■</button>
              <button id="send" class="send-button" type="button" aria-label="Send message">↑</button>
            </div>
          </div>
        </div>
        <p class="disclaimer">Agentic can make mistakes. Check important information.</p>
      </footer>
    </div>

    <section id="voice-session" class="voice-session" data-state="connecting" hidden>
      <header class="voice-session-header">
        <div class="voice-session-brand">
          <span class="brand-mark" aria-hidden="true">A</span>
          <div><strong>Agentic Voice</strong><span>Realtime conversation</span></div>
        </div>
        <div class="voice-session-meta">
          <span id="voice-quality">Checking connection…</span>
          <span id="voice-elapsed">00:00</span>
        </div>
      </header>
      <div class="voice-session-layout">
        <main class="voice-stage">
          <div class="voice-agent-visual" aria-hidden="true">
            <canvas id="voice-aura" class="voice-aura-canvas"></canvas>
            <span class="voice-core">✦</span>
          </div>
          <div class="voice-stage-copy">
            <span class="voice-eyebrow">Live session</span>
            <h1 id="voice-session-state">Connecting agent…</h1>
            <p id="voice-session-hint">You can speak naturally. Interrupt whenever you need to.</p>
          </div>
          <div class="voice-control-bar">
            <button id="voice-mute" class="voice-control" type="button" aria-pressed="false">
              <span aria-hidden="true">⌁</span><small>Mute</small>
            </button>
            <button id="voice-end" class="voice-control voice-end" type="button">
              <span aria-hidden="true">×</span><small>End</small>
            </button>
          </div>
        </main>
        <aside class="voice-transcript-panel" aria-label="Live voice transcript">
          <header><div><span class="voice-eyebrow">Conversation</span><h2>Live transcript</h2></div><span class="live-pill"><i></i> Live</span></header>
          <div id="voice-transcript" class="voice-transcript" aria-live="polite">
            <p id="voice-transcript-empty" class="voice-transcript-empty">Your conversation will appear here in real time.</p>
          </div>
        </aside>
      </div>
    </section>

    <div id="voice-audio" aria-hidden="true"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/playground/livekit-client.js"></script>
    <script src="/playground/app.js"></script>
    <script src="/playground/livekit-app.js"></script>
  </body>
</html>`;

export const PLAYGROUND_APP = `(() => {
  const socket = io('/v1/chat', { transports: ['websocket'] });
  const elements = {
    connection: document.querySelector('#connection'),
    conversation: document.querySelector('#conversation'),
    empty: document.querySelector('#empty-state'),
    message: document.querySelector('#message'),
    messages: document.querySelector('#messages'),
    newChat: document.querySelector('#new-chat'),
    send: document.querySelector('#send'),
    stop: document.querySelector('#stop'),
  };

  let active = false;
  let assistantMessage;
  let elapsedTimer;
  let responseStarted = false;
  let startedAt;

  function scrollToLatest() {
    requestAnimationFrame(() => {
      elements.conversation.scrollTop = elements.conversation.scrollHeight;
    });
  }

  function formatDuration(durationMs) {
    if (!Number.isFinite(durationMs)) return undefined;
    if (durationMs < 1000) return Math.max(0, Math.round(durationMs)) + 'ms';
    const seconds = durationMs / 1000;
    return seconds.toFixed(seconds < 10 ? 1 : 0) + 's';
  }

  function updateElapsed() {
    if (!assistantMessage?.elapsed || startedAt === undefined) return;
    assistantMessage.elapsed.textContent = formatDuration(performance.now() - startedAt);
  }

  function startElapsed() {
    if (elapsedTimer) clearInterval(elapsedTimer);
    startedAt = performance.now();
    updateElapsed();
    elapsedTimer = setInterval(updateElapsed, 100);
  }

  function stopElapsed() {
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = undefined;
  }

  function setActive(value) {
    active = value;
    elements.send.disabled = value || !socket.connected;
    elements.stop.hidden = !value;
    elements.send.hidden = value;
    elements.newChat.disabled = value;
  }

  function createMessage(role, text = '') {
    elements.empty.hidden = true;
    const article = document.createElement('article');
    article.className = 'message ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'Y' : '✦';
    avatar.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    body.className = 'message-body';
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'Agentic';
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    body.append(label, content);
    article.append(avatar, body);
    elements.messages.append(article);
    scrollToLatest();
    return { article, body, content };
  }

  document.addEventListener('agentic:voice-transcript', (event) => {
    const detail = event.detail;
    if (!detail || !['user', 'assistant'].includes(detail.role) || !detail.text?.trim()) return;
    createMessage(detail.role, detail.text.trim());
  });

  function createAssistant() {
    const message = createMessage('assistant');
    const status = document.createElement('div');
    status.className = 'agent-status';
    status.innerHTML = '<span class="thinking-orb" aria-hidden="true"><i></i><i></i><i></i></span><span class="status-label">Thinking</span><span class="status-elapsed">0ms</span>';
    message.body.insertBefore(status, message.content);
    assistantMessage = {
      ...message,
      status,
      statusLabel: status.querySelector('.status-label'),
      elapsed: status.querySelector('.status-elapsed'),
    };
    return assistantMessage;
  }

  function ensureAssistant() {
    return assistantMessage ?? createAssistant();
  }

  function updateStatus(data) {
    if (responseStarted) return;
    const message = ensureAssistant();
    message.status.hidden = false;
    message.status.dataset.phase = data.phase ?? 'thinking';
    message.statusLabel.textContent = data.message ?? 'Thinking';
    scrollToLatest();
  }

  function addRuntime(runtime = {}) {
    const message = ensureAssistant();
    const metadata = document.createElement('div');
    metadata.className = 'runtime-chips';
    const values = [
      formatDuration(runtime.durationMs),
      runtime.tokens ? runtime.tokens.total + ' tokens' : undefined,
      runtime.cost ? '$' + Number(runtime.cost.estimatedUsd ?? 0).toFixed(6) : undefined,
      runtime.models?.[0]?.name,
      runtime.tools?.length ? runtime.tools.map((tool) => tool.name).join(', ') : undefined,
    ].filter(Boolean);
    for (const value of values) {
      const chip = document.createElement('span');
      chip.textContent = value;
      metadata.append(chip);
    }
    message.body.append(metadata);
  }

  function send() {
    const message = elements.message.value.trim();
    if (!message || active || !socket.connected) return;
    createMessage('user', message);
    assistantMessage = undefined;
    createAssistant();
    responseStarted = false;
    startElapsed();
    elements.message.value = '';
    elements.message.style.height = 'auto';
    setActive(true);
    socket.emit('chat.send', { message });
  }

  function resetConversation() {
    stopElapsed();
    elements.messages.replaceChildren();
    elements.empty.hidden = false;
    elements.message.value = '';
    assistantMessage = undefined;
    responseStarted = false;
    startedAt = undefined;
    socket.disconnect();
    socket.connect();
  }

  socket.on('connect', () => {
    elements.connection.lastChild.textContent = ' Online';
    elements.connection.dataset.state = 'online';
    setActive(false);
  });

  socket.on('disconnect', () => {
    stopElapsed();
    elements.connection.lastChild.textContent = ' Offline';
    elements.connection.dataset.state = 'offline';
    setActive(false);
  });

  socket.on('connect_error', () => {
    stopElapsed();
    elements.connection.lastChild.textContent = ' Connection failed';
    elements.connection.dataset.state = 'offline';
    setActive(false);
  });

  socket.on('chat.started', () => {
    setActive(true);
    if (startedAt === undefined) startElapsed();
    updateStatus({ phase: 'thinking', message: 'Thinking' });
  });

  socket.on('chat.status', (data) => {
    updateStatus(data);
  });

  socket.on('chat.delta', (data) => {
    const message = ensureAssistant();
    responseStarted = true;
    message.status.hidden = true;
    message.content.textContent += data.delta;
    scrollToLatest();
  });

  socket.on('chat.completed', (data) => {
    const message = ensureAssistant();
    stopElapsed();
    setActive(false);
    message.status.hidden = true;
    message.content.textContent = data.response?.message ?? message.content.textContent;
    addRuntime(data.response?.runtime);
    assistantMessage = undefined;
    startedAt = undefined;
    scrollToLatest();
  });

  socket.on('chat.cancelling', () => {
    updateStatus({ phase: 'thinking', message: 'Stopping' });
  });

  socket.on('chat.cancelled', () => {
    const message = ensureAssistant();
    stopElapsed();
    setActive(false);
    message.status.hidden = true;
    if (!message.content.textContent) message.content.textContent = 'Response stopped.';
    assistantMessage = undefined;
    startedAt = undefined;
  });

  socket.on('chat.error', (data) => {
    const message = ensureAssistant();
    stopElapsed();
    setActive(false);
    message.status.hidden = true;
    message.content.textContent = data.message ?? 'The response could not be completed.';
    message.article.classList.add('error');
    assistantMessage = undefined;
    startedAt = undefined;
  });

  elements.send.addEventListener('click', send);
  elements.stop.addEventListener('click', () => socket.emit('chat.cancel', {}));
  elements.newChat.addEventListener('click', resetConversation);
  elements.message.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
  elements.message.addEventListener('input', () => {
    elements.message.style.height = 'auto';
    elements.message.style.height = Math.min(elements.message.scrollHeight, 180) + 'px';
  });
})();`;

export const PLAYGROUND_STYLES = `:root {
  color-scheme: light;
  --background: #ffffff;
  --surface: #ffffff;
  --surface-subtle: #f7f7f8;
  --text: #18181b;
  --muted: #71717a;
  --border: #e4e4e7;
  --accent: #18181b;
  --success: #16a34a;
  --danger: #dc2626;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: var(--background); color: var(--text); }
button, textarea { font: inherit; }
button { color: inherit; }
.app-shell { display: grid; grid-template-rows: 64px minmax(0, 1fr) auto; height: 100%; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, .92); }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font-weight: 700; letter-spacing: -.02em; }
.brand-mark, .agent-orb { display: grid; place-items: center; color: #fff; background: var(--accent); }
.brand-mark { width: 30px; height: 30px; border-radius: 9px; font-size: .85rem; }
.topbar-actions { display: flex; align-items: center; gap: 14px; }
.voice-status { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: .7rem; }
.voice-status[hidden] { display: none; }
.voice-status[data-state='agent-speaking'] { color: #0284c7; }
.voice-status[data-state='user-speaking'] { color: #059669; }
.voice-status[data-state='thinking'] { color: #7c3aed; }
.voice-status[data-state='error'] { color: var(--danger); }
.voice-visualizer { display: inline-flex; height: 14px; align-items: center; gap: 2px; }
.voice-visualizer i { width: 2px; height: 4px; border-radius: 999px; background: currentColor; transform-origin: center; }
.voice-status[data-state='connecting'] .voice-visualizer i,
.voice-status[data-state='initializing'] .voice-visualizer i { animation: voice-pulse 1.2s ease-in-out infinite; }
.voice-status[data-state='thinking'] .voice-visualizer i { animation: voice-think .9s ease-in-out infinite; }
.voice-status[data-state='agent-speaking'] .voice-visualizer i,
.voice-status[data-state='user-speaking'] .voice-visualizer i { animation: voice-wave .65s ease-in-out infinite; }
.voice-visualizer i:nth-child(2) { animation-delay: .12s !important; }
.voice-visualizer i:nth-child(3) { animation-delay: .24s !important; }
.voice-visualizer i:nth-child(4) { animation-delay: .36s !important; }
.voice-button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 10px; color: var(--muted); background: transparent; cursor: pointer; }
.voice-button:hover { color: var(--text); background: var(--surface-subtle); }
.voice-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.voice-button[aria-pressed='true'] { color: #fff; background: var(--danger); animation: orb-breathe 1.4s ease-in-out infinite; }
.voice-button:disabled { cursor: wait; opacity: .55; }
.voice-session { position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: 76px minmax(0, 1fr); background: #fff; }
.voice-session[hidden] { display: none; }
.voice-session:not([hidden]) { animation: voice-session-enter .28s ease-out; }
.voice-session-header { display: flex; align-items: center; justify-content: space-between; padding: 0 30px; border-bottom: 1px solid rgba(228, 228, 231, .82); background: rgba(255, 255, 255, .84); box-shadow: 0 1px 20px rgba(24, 24, 27, .025); backdrop-filter: blur(24px); }
.voice-session-brand { display: flex; align-items: center; gap: 12px; }
.voice-session-brand div { display: grid; gap: 2px; }
.voice-session-brand strong { font-size: .88rem; }
.voice-session-brand span:not(.brand-mark) { color: var(--muted); font-size: .68rem; }
.voice-session-meta { display: flex; align-items: center; gap: 8px; color: var(--muted); font: .68rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.voice-session-meta span { padding: 7px 10px; border: 1px solid rgba(228, 228, 231, .9); border-radius: 999px; background: rgba(250, 250, 250, .8); }
.voice-session-layout { display: grid; min-height: 0; grid-template-columns: minmax(0, 1.5fr) minmax(360px, .78fr); }
.voice-stage { position: relative; display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; padding: 42px 48px; background: radial-gradient(circle at 50% 38%, rgba(186, 230, 253, .2), transparent 31%), radial-gradient(circle at 32% 72%, rgba(216, 180, 254, .12), transparent 28%), linear-gradient(145deg, #fff 0%, #fafafa 100%); text-align: center; }
.voice-stage::after { position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(rgba(24, 24, 27, .055) .6px, transparent .6px); background-size: 18px 18px; mask-image: radial-gradient(circle at center, black, transparent 72%); content: ''; }
.voice-agent-visual { position: relative; z-index: 1; display: grid; width: clamp(240px, 29vw, 350px); aspect-ratio: 1; place-items: center; margin-bottom: 14px; isolation: isolate; }
.voice-agent-visual::before { position: absolute; z-index: -1; width: 72%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(14, 165, 233, .12), transparent 68%); filter: blur(18px); content: ''; }
.voice-aura-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.voice-core { position: relative; display: grid; width: 19%; aspect-ratio: 1; place-items: center; border: 1px solid rgba(255, 255, 255, .85); border-radius: 50%; color: #fff; background: rgba(9, 9, 11, .88); box-shadow: 0 12px 38px rgba(2, 132, 199, .22); backdrop-filter: blur(12px); font-size: 1rem; }
.voice-session[data-state='thinking'] .voice-core { animation: voice-core-think 1.2s ease-in-out infinite; }
.voice-session[data-state='agent-speaking'] .voice-core { background: #0369a1; box-shadow: 0 12px 44px rgba(14, 165, 233, .34); }
.voice-session[data-state='user-speaking'] .voice-core { background: #047857; box-shadow: 0 12px 44px rgba(16, 185, 129, .3); }
.voice-session[data-state='error'] .voice-core,
.voice-session[data-state='failed'] .voice-core { background: var(--danger); }
.voice-stage-copy { position: relative; z-index: 1; min-height: 108px; }
.voice-eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .64rem; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
.voice-stage .voice-eyebrow { padding: 6px 9px; border: 1px solid rgba(228, 228, 231, .9); border-radius: 999px; background: rgba(255, 255, 255, .72); backdrop-filter: blur(10px); }
.voice-stage h1 { margin: 9px 0 8px; font-size: clamp(1.55rem, 3vw, 2.45rem); letter-spacing: -.045em; }
.voice-stage p { max-width: 460px; margin: 0; color: var(--muted); font-size: .87rem; line-height: 1.6; }
.voice-control-bar { position: relative; z-index: 1; display: flex; gap: 12px; margin-top: 20px; padding: 7px; border: 1px solid rgba(228, 228, 231, .88); border-radius: 24px; background: rgba(255, 255, 255, .72); box-shadow: 0 16px 46px rgba(24, 24, 27, .08); backdrop-filter: blur(16px); }
.voice-control { display: grid; width: 58px; height: 58px; place-items: center; padding: 7px; border: 1px solid var(--border); border-radius: 17px; background: #fff; cursor: pointer; box-shadow: 0 5px 16px rgba(0, 0, 0, .04); transition: transform .18s ease, box-shadow .18s ease; }
.voice-control:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0, 0, 0, .08); }
.voice-control span { font-size: 1.2rem; line-height: 1; }
.voice-control small { color: var(--muted); font-size: .62rem; font-weight: 700; }
.voice-control[aria-pressed='true'] { color: #fff; border-color: var(--accent); background: var(--accent); }
.voice-control[aria-pressed='true'] small { color: #fff; }
.voice-end { color: #fff; border-color: var(--danger); background: var(--danger); }
.voice-end small { color: #fff; }
.voice-transcript-panel { display: grid; min-width: 0; grid-template-rows: auto minmax(0, 1fr); border-left: 1px solid var(--border); background: linear-gradient(180deg, #fafafa, #f7f7f8); }
.voice-transcript-panel > header { display: flex; align-items: center; justify-content: space-between; padding: 25px 26px 20px; border-bottom: 1px solid var(--border); }
.voice-transcript-panel h2 { margin: 5px 0 0; font-size: 1.05rem; letter-spacing: -.025em; }
.live-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid #bbf7d0; border-radius: 999px; color: #15803d; background: #f0fdf4; font-size: .64rem; font-weight: 700; }
.live-pill i { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: voice-pulse 1.1s ease-in-out infinite; }
.voice-transcript { overflow-y: auto; padding: 24px 26px 80px; scroll-behavior: smooth; }
.voice-transcript-empty { margin: 20vh auto 0; max-width: 240px; color: #a1a1aa; text-align: center; font-size: .8rem; line-height: 1.6; }
.voice-transcript-turn { margin-bottom: 20px; padding: 14px 15px; border: 1px solid rgba(228, 228, 231, .82); border-radius: 16px; background: rgba(255, 255, 255, .82); box-shadow: 0 5px 18px rgba(24, 24, 27, .035); }
.voice-transcript-turn .speaker { margin-bottom: 7px; color: var(--muted); font-size: .68rem; font-weight: 700; }
.voice-transcript-turn .words { margin: 0; color: var(--text); font-size: .9rem; line-height: 1.65; }
.voice-transcript-turn.user { margin-left: 15%; border-color: #dbeafe; background: #eff6ff; text-align: right; }
.voice-transcript-turn.user .words { display: inline-block; text-align: left; }
.voice-transcript-turn.interim .words { color: var(--muted); }
.connection { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: .78rem; }
.connection-dot { width: 7px; height: 7px; border-radius: 999px; background: #a1a1aa; }
.connection[data-state='online'] .connection-dot { background: var(--success); box-shadow: 0 0 0 3px #dcfce7; }
.connection[data-state='offline'] .connection-dot { background: var(--danger); }
.quiet-button { padding: 8px 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); cursor: pointer; font-size: .82rem; font-weight: 600; }
.quiet-button:hover { background: var(--surface-subtle); }
.quiet-button:disabled { cursor: not-allowed; opacity: .5; }
.conversation { overflow-y: auto; scroll-behavior: smooth; }
.empty-state { display: flex; min-height: 100%; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px 100px; text-align: center; }
.empty-state[hidden] { display: none; }
.agent-orb { width: 52px; height: 52px; margin-bottom: 22px; border-radius: 16px; font-size: 1.3rem; box-shadow: 0 10px 30px rgba(0, 0, 0, .12); }
.empty-state h1 { margin: 0 0 10px; font-size: clamp(1.7rem, 4vw, 2.25rem); letter-spacing: -.045em; }
.empty-state p { margin: 0; color: var(--muted); }
.messages { width: min(780px, calc(100% - 32px)); margin: 0 auto; padding: 46px 0 160px; }
.message { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 14px; margin-bottom: 34px; }
.avatar { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); font-size: .75rem; font-weight: 700; }
.assistant .avatar { color: #fff; border-color: var(--accent); background: var(--accent); }
.message-body { min-width: 0; padding-top: 4px; }
.message-label { margin-bottom: 8px; font-size: .82rem; font-weight: 700; }
.message-content { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .98rem; line-height: 1.72; }
.user { grid-template-columns: minmax(0, 1fr); }
.user .avatar, .user .message-label { display: none; }
.user .message-body { display: flex; width: min(78%, 620px); flex-direction: column; align-items: flex-end; justify-self: end; }
.user .message-content { display: inline-block; padding: 11px 15px; border-radius: 18px 18px 4px 18px; background: var(--surface-subtle); }
.message.error .message-content { color: var(--danger); }
.agent-status { display: flex; align-items: center; gap: 8px; min-height: 28px; color: var(--muted); font-size: .9rem; }
.agent-status[hidden] { display: none; }
.thinking-orb { position: relative; width: 20px; height: 20px; flex: 0 0 20px; animation: orb-spin 2.2s linear infinite; }
.thinking-orb i { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--text); box-shadow: 0 0 8px rgba(24, 24, 27, .18); }
.thinking-orb i:nth-child(1) { top: 1px; left: 8px; }
.thinking-orb i:nth-child(2) { right: 1px; bottom: 3px; animation: orb-breathe 1.1s ease-in-out infinite .15s; }
.thinking-orb i:nth-child(3) { left: 1px; bottom: 3px; animation: orb-breathe 1.1s ease-in-out infinite .3s; }
.status-label { color: transparent; background: linear-gradient(100deg, #71717a 20%, #18181b 45%, #a1a1aa 70%); background-size: 220% 100%; background-clip: text; -webkit-background-clip: text; animation: shimmer 1.8s linear infinite; }
.status-elapsed { min-width: 34px; color: #a1a1aa; font: .72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.runtime-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.runtime-chips span { padding: 4px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); background: var(--surface); font: 600 .7rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.composer-wrap { position: relative; width: min(780px, calc(100% - 32px)); margin: 0 auto; padding: 0 0 14px; background: linear-gradient(to top, #fff 78%, rgba(255, 255, 255, 0)); }
.composer { padding: 13px 14px 10px; border: 1px solid #d4d4d8; border-radius: 18px; background: #fff; box-shadow: 0 10px 34px rgba(0, 0, 0, .08); }
textarea { display: block; width: 100%; max-height: 180px; resize: none; padding: 3px 4px 12px; border: 0; outline: 0; background: transparent; color: var(--text); line-height: 1.5; }
textarea::placeholder { color: #a1a1aa; }
.composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.composer-status { display: flex; min-width: 0; align-items: center; gap: 10px; }
.composer-hint { color: #a1a1aa; font-size: .7rem; }
.composer-buttons { display: flex; gap: 8px; }
.voice-mute-button { padding: 0 9px; border: 1px solid var(--border); border-radius: 9px; color: var(--muted); background: var(--surface); cursor: pointer; font-size: .7rem; font-weight: 600; }
.send-button, .stop-button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 10px; cursor: pointer; }
.send-button[hidden], .stop-button[hidden] { display: none; }
.send-button { color: #fff; background: var(--accent); font-size: 1.25rem; }
.send-button:hover { background: #3f3f46; }
.send-button:disabled { cursor: not-allowed; opacity: .35; }
.stop-button { color: #fff; background: var(--danger); font-size: .66rem; }
.disclaimer { margin: 8px 0 0; color: #a1a1aa; text-align: center; font-size: .68rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
#voice-audio { display: none; }
@keyframes shimmer { to { background-position: -220% 0; } }
@keyframes orb-spin { to { transform: rotate(360deg); } }
@keyframes orb-breathe { 50% { opacity: .3; transform: scale(.65); } }
@keyframes voice-pulse { 50% { opacity: .35; } }
@keyframes voice-think { 50% { height: 10px; transform: translateY(-2px); } }
@keyframes voice-wave { 50% { height: 13px; } }
@keyframes voice-session-enter { from { opacity: 0; transform: scale(.985); } }
@keyframes voice-core-think { 50% { transform: rotate(8deg) scale(.94); border-radius: 50%; } }
@media (max-width: 640px) { .topbar { padding: 0 16px; } .connection, .voice-status { font-size: 0; } .connection-dot { margin-right: 2px; } .messages { padding-top: 28px; } .composer-hint { display: none; } }
@media (max-width: 820px) { .voice-session { grid-template-rows: 64px minmax(0, 1fr); } .voice-session-header { padding: 0 16px; } .voice-session-meta span:first-child { display: none; } .voice-session-layout { grid-template-columns: 1fr; grid-template-rows: minmax(360px, 56%) minmax(0, 44%); } .voice-stage { padding: 20px 18px 18px; } .voice-agent-visual { width: min(220px, 52vw); margin-bottom: 2px; } .voice-stage-copy { min-height: 78px; } .voice-stage h1 { margin: 5px 0; } .voice-control-bar { margin-top: 8px; } .voice-control { width: 54px; height: 54px; border-radius: 17px; } .voice-transcript-panel { border-top: 1px solid var(--border); border-left: 0; } .voice-transcript-panel > header { padding: 16px 18px 13px; } .voice-transcript { padding: 18px 18px 50px; } .voice-transcript-empty { margin-top: 6vh; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
`;
