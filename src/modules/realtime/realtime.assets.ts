export const REALTIME_PAGE = `<!doctype html>
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
            <span class="composer-hint">Enter to send · Shift + Enter for a new line</span>
            <div class="composer-buttons">
              <button id="stop" class="stop-button" type="button" aria-label="Stop response" hidden>■</button>
              <button id="send" class="send-button" type="button" aria-label="Send message">↑</button>
            </div>
          </div>
        </div>
        <p class="disclaimer">Agentic can make mistakes. Check important information.</p>
        <details class="developer-details">
          <summary>Activity log</summary>
          <pre id="events">Waiting for a connection…</pre>
        </details>
      </footer>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/playground/app.js"></script>
  </body>
</html>`;

export const REALTIME_APP = `(() => {
  const socket = io('/v1/chat', { transports: ['websocket'] });
  const elements = {
    connection: document.querySelector('#connection'),
    conversation: document.querySelector('#conversation'),
    empty: document.querySelector('#empty-state'),
    events: document.querySelector('#events'),
    message: document.querySelector('#message'),
    messages: document.querySelector('#messages'),
    newChat: document.querySelector('#new-chat'),
    send: document.querySelector('#send'),
    stop: document.querySelector('#stop'),
  };

  let active = false;
  let assistantMessage;

  function scrollToLatest() {
    requestAnimationFrame(() => {
      elements.conversation.scrollTop = elements.conversation.scrollHeight;
    });
  }

  function log(event, data = {}) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + event + ' ' + JSON.stringify(data);
    elements.events.textContent = elements.events.textContent.startsWith('Waiting')
      ? line
      : line + '\\n' + elements.events.textContent;
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

  function createAssistant() {
    const message = createMessage('assistant');
    const status = document.createElement('div');
    status.className = 'agent-status';
    status.innerHTML = '<span class="status-spark" aria-hidden="true">✦</span><span class="status-label">Thinking</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    message.body.insertBefore(status, message.content);
    assistantMessage = { ...message, status, statusLabel: status.querySelector('.status-label') };
    return assistantMessage;
  }

  function ensureAssistant() {
    return assistantMessage ?? createAssistant();
  }

  function updateStatus(data) {
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
    elements.message.value = '';
    elements.message.style.height = 'auto';
    setActive(true);
    socket.emit('chat.send', { message });
    log('chat.send', { message });
  }

  function resetConversation() {
    elements.messages.replaceChildren();
    elements.empty.hidden = false;
    elements.events.textContent = 'Waiting for a connection…';
    elements.message.value = '';
    assistantMessage = undefined;
    socket.disconnect();
    socket.connect();
  }

  socket.on('connect', () => {
    elements.connection.lastChild.textContent = ' Online';
    elements.connection.dataset.state = 'online';
    setActive(false);
    log('connect');
  });

  socket.on('disconnect', (reason) => {
    elements.connection.lastChild.textContent = ' Offline';
    elements.connection.dataset.state = 'offline';
    setActive(false);
    log('disconnect', { reason });
  });

  socket.on('connect_error', (error) => {
    elements.connection.lastChild.textContent = ' Connection failed';
    elements.connection.dataset.state = 'offline';
    setActive(false);
    log('connect_error', { message: error.message });
  });

  socket.on('chat.started', (data) => {
    setActive(true);
    updateStatus({ phase: 'thinking', message: 'Thinking' });
    log('chat.started', data);
  });

  socket.on('chat.status', (data) => {
    updateStatus(data);
    log('chat.status', data);
  });

  socket.on('chat.delta', (data) => {
    const message = ensureAssistant();
    message.status.hidden = true;
    message.content.textContent += data.delta;
    scrollToLatest();
  });

  socket.on('chat.completed', (data) => {
    const message = ensureAssistant();
    setActive(false);
    message.status.hidden = true;
    message.content.textContent = data.response?.message ?? message.content.textContent;
    addRuntime(data.response?.runtime);
    assistantMessage = undefined;
    log('chat.completed', data);
    scrollToLatest();
  });

  socket.on('chat.cancelling', (data) => {
    updateStatus({ phase: 'thinking', message: 'Stopping' });
    log('chat.cancelling', data);
  });

  socket.on('chat.cancelled', (data) => {
    const message = ensureAssistant();
    setActive(false);
    message.status.hidden = true;
    if (!message.content.textContent) message.content.textContent = 'Response stopped.';
    assistantMessage = undefined;
    log('chat.cancelled', data);
  });

  socket.on('chat.error', (data) => {
    const message = ensureAssistant();
    setActive(false);
    message.status.hidden = true;
    message.content.textContent = data.message ?? 'The response could not be completed.';
    message.article.classList.add('error');
    assistantMessage = undefined;
    log('chat.error', data);
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

export const REALTIME_STYLES = `:root {
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
.user .message-content { display: inline-block; padding: 11px 15px; border-radius: 18px 18px 4px 18px; background: var(--surface-subtle); }
.message.error .message-content { color: var(--danger); }
.agent-status { display: flex; align-items: center; gap: 8px; min-height: 28px; color: var(--muted); font-size: .9rem; }
.agent-status[hidden] { display: none; }
.status-spark { color: var(--text); animation: pulse 1.3s ease-in-out infinite; }
.thinking-dots { display: inline-flex; gap: 3px; margin-left: -3px; }
.thinking-dots i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; animation: bounce 1.2s infinite; }
.thinking-dots i:nth-child(2) { animation-delay: .15s; }
.thinking-dots i:nth-child(3) { animation-delay: .3s; }
.runtime-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.runtime-chips span { padding: 4px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); background: var(--surface); font: 600 .7rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.composer-wrap { position: relative; width: min(780px, calc(100% - 32px)); margin: 0 auto; padding: 0 0 14px; background: linear-gradient(to top, #fff 78%, rgba(255, 255, 255, 0)); }
.composer { padding: 13px 14px 10px; border: 1px solid #d4d4d8; border-radius: 18px; background: #fff; box-shadow: 0 10px 34px rgba(0, 0, 0, .08); }
textarea { display: block; width: 100%; max-height: 180px; resize: none; padding: 3px 4px 12px; border: 0; outline: 0; background: transparent; color: var(--text); line-height: 1.5; }
textarea::placeholder { color: #a1a1aa; }
.composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.composer-hint { color: #a1a1aa; font-size: .7rem; }
.composer-buttons { display: flex; gap: 8px; }
.send-button, .stop-button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 10px; cursor: pointer; }
.send-button[hidden], .stop-button[hidden] { display: none; }
.send-button { color: #fff; background: var(--accent); font-size: 1.25rem; }
.send-button:hover { background: #3f3f46; }
.send-button:disabled { cursor: not-allowed; opacity: .35; }
.stop-button { color: #fff; background: var(--danger); font-size: .66rem; }
.disclaimer { margin: 8px 0 0; color: #a1a1aa; text-align: center; font-size: .68rem; }
.developer-details { position: absolute; right: 0; bottom: 12px; transform: translateX(calc(100% + 14px)); width: 230px; color: var(--muted); font-size: .72rem; }
.developer-details summary { cursor: pointer; user-select: none; }
.developer-details pre { max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-subtle); font: .65rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes pulse { 50% { opacity: .35; transform: scale(.86); } }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-3px); opacity: 1; } }
@media (max-width: 1120px) { .developer-details { position: static; transform: none; width: 100%; margin-top: 7px; } }
@media (max-width: 640px) { .topbar { padding: 0 16px; } .connection { font-size: 0; } .connection-dot { margin-right: 2px; } .messages { padding-top: 28px; } .composer-hint { display: none; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
`;
