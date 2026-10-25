export const REALTIME_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Socket.IO Realtime Chat</title>
    <link rel="stylesheet" href="/realtime/styles.css" />
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">Agentic developer tool</p>
          <h1>Socket.IO Realtime Chat</h1>
          <p>Test streaming chat against the local <code>/v1/chat</code> namespace.</p>
        </div>
        <div class="header-actions">
          <span id="status" class="status" role="status">Connecting</span>
          <button id="theme" class="secondary" type="button" aria-label="Toggle theme">Theme</button>
        </div>
      </header>

      <section class="panel composer" aria-labelledby="prompt-label">
        <label id="prompt-label" for="message">Message</label>
        <textarea id="message" rows="5" maxlength="8000" placeholder="Ask the agent something…"></textarea>
        <div class="actions">
          <button id="send" type="button">Send</button>
          <button id="cancel" class="secondary" type="button" disabled>Cancel</button>
          <button id="clear" class="ghost" type="button">Clear</button>
        </div>
      </section>

      <div class="results">
        <section class="panel" aria-labelledby="response-title">
          <h2 id="response-title">Response</h2>
          <pre id="response" aria-live="polite">No response yet.</pre>
          <h3>Runtime</h3>
          <pre id="runtime">Tokens, cost, models, and tools appear here.</pre>
        </section>
        <section class="panel" aria-labelledby="events-title">
          <div class="section-heading">
            <h2 id="events-title">Events</h2>
            <span id="request-id" class="muted">No active request</span>
          </div>
          <pre id="events" aria-live="polite">Waiting for a connection…</pre>
        </section>
      </div>
    </main>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/realtime/app.js"></script>
  </body>
</html>`;

export const REALTIME_APP = `(() => {
  const socket = io('/v1/chat', { transports: ['websocket'] });
  const elements = {
    cancel: document.querySelector('#cancel'),
    clear: document.querySelector('#clear'),
    events: document.querySelector('#events'),
    message: document.querySelector('#message'),
    requestId: document.querySelector('#request-id'),
    response: document.querySelector('#response'),
    runtime: document.querySelector('#runtime'),
    send: document.querySelector('#send'),
    status: document.querySelector('#status'),
    theme: document.querySelector('#theme'),
  };

  let active = false;

  function setActive(value) {
    active = value;
    elements.send.disabled = value || !socket.connected;
    elements.cancel.disabled = !value;
  }

  function log(event, data = {}) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + event + ' ' + JSON.stringify(data);
    elements.events.textContent = elements.events.textContent.startsWith('Waiting')
      ? line
      : line + '\\n' + elements.events.textContent;
  }

  function send() {
    const message = elements.message.value.trim();
    if (!message || active || !socket.connected) return;
    socket.emit('chat.send', { message });
    log('chat.send', { message });
  }

  socket.on('connect', () => {
    elements.status.textContent = 'Connected';
    elements.status.dataset.state = 'connected';
    setActive(false);
    log('connect', { socketId: socket.id });
  });

  socket.on('disconnect', (reason) => {
    elements.status.textContent = 'Disconnected';
    elements.status.dataset.state = 'disconnected';
    setActive(false);
    log('disconnect', { reason });
  });

  socket.on('connect_error', (error) => {
    elements.status.textContent = 'Connection failed';
    elements.status.dataset.state = 'disconnected';
    log('connect_error', { message: error.message });
  });

  socket.on('chat.started', (data) => {
    setActive(true);
    elements.response.textContent = '';
    elements.runtime.textContent = 'Waiting for completion…';
    elements.requestId.textContent = data.requestId;
    log('chat.started', data);
  });

  socket.on('chat.delta', (data) => {
    elements.response.textContent += data.delta;
    log('chat.delta', data);
  });

  socket.on('chat.completed', (data) => {
    setActive(false);
    elements.response.textContent = data.response?.message ?? elements.response.textContent;
    elements.runtime.textContent = JSON.stringify(data.response?.runtime ?? {}, null, 2);
    log('chat.completed', data);
  });

  socket.on('chat.cancelling', (data) => log('chat.cancelling', data));
  socket.on('chat.cancelled', (data) => {
    setActive(false);
    log('chat.cancelled', data);
  });
  socket.on('chat.error', (data) => {
    setActive(false);
    log('chat.error', data);
  });

  elements.send.addEventListener('click', send);
  elements.message.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send();
  });
  elements.cancel.addEventListener('click', () => socket.emit('chat.cancel', {}));
  elements.clear.addEventListener('click', () => {
    elements.response.textContent = 'No response yet.';
    elements.runtime.textContent = 'Tokens, cost, models, and tools appear here.';
    elements.events.textContent = '';
    elements.requestId.textContent = 'No active request';
  });
  elements.theme.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const isDark = current
      ? current === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  });
})();`;

export const REALTIME_STYLES = `:root {
  color-scheme: light dark;
  --background: #f5f7fb;
  --panel: #ffffff;
  --text: #172033;
  --muted: #667085;
  --border: #d8dee9;
  --primary: #1668e3;
  --primary-hover: #0f56bf;
  --success: #087f5b;
  --danger: #c92a2a;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

:root[data-theme='dark'] {
  --background: #0d1117;
  --panel: #161b22;
  --text: #e6edf3;
  --muted: #8b949e;
  --border: #30363d;
  --primary: #58a6ff;
  --primary-hover: #79b8ff;
  --success: #3fb950;
  --danger: #ff7b72;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --background: #0d1117;
    --panel: #161b22;
    --text: #e6edf3;
    --muted: #8b949e;
    --border: #30363d;
    --primary: #58a6ff;
    --primary-hover: #79b8ff;
    --success: #3fb950;
    --danger: #ff7b72;
  }
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--text); }
main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0; }
header, .section-heading, .actions, .header-actions { display: flex; align-items: center; gap: 12px; }
header { justify-content: space-between; margin-bottom: 24px; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 8px; font-size: clamp(1.75rem, 4vw, 2.5rem); }
h2 { font-size: 1.05rem; }
h3 { margin: 24px 0 10px; font-size: .85rem; color: var(--muted); text-transform: uppercase; }
.eyebrow { color: var(--primary); font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.panel { padding: 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
.composer { margin-bottom: 18px; }
.results { display: grid; grid-template-columns: 1.35fr 1fr; gap: 18px; }
label { display: block; margin-bottom: 8px; font-weight: 650; }
textarea { width: 100%; resize: vertical; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--background); color: var(--text); font: inherit; }
textarea:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
.actions { margin-top: 12px; }
button { padding: 9px 15px; border: 1px solid var(--primary); border-radius: 8px; background: var(--primary); color: #fff; cursor: pointer; font: inherit; font-weight: 650; }
button:hover:not(:disabled) { background: var(--primary-hover); }
button:disabled { cursor: not-allowed; opacity: .5; }
button.secondary, button.ghost { background: transparent; color: var(--text); border-color: var(--border); }
.status { padding: 6px 10px; border-radius: 999px; background: color-mix(in srgb, var(--muted) 14%, transparent); color: var(--muted); font-size: .82rem; font-weight: 700; }
.status[data-state='connected'] { color: var(--success); }
.status[data-state='disconnected'] { color: var(--danger); }
.section-heading { justify-content: space-between; }
.muted { color: var(--muted); font-size: .78rem; overflow-wrap: anywhere; }
pre { min-height: 150px; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: .85rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
#runtime { min-height: 80px; color: var(--muted); }
#events { max-height: 520px; overflow: auto; color: var(--muted); }
code { color: var(--primary); }
@media (max-width: 760px) { header { align-items: flex-start; } .results { grid-template-columns: 1fr; } .header-actions { flex-direction: column; align-items: flex-end; } }
`;
