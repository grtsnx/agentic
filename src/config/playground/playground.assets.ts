import { AGENTIC_FAVICON, AGENTIC_SYMBOL } from './brand.asset.js';
import {
  VOICE_PLAYGROUND_VIEW,
  VOICE_PLAYGROUND_STYLES,
} from './voice-playground.view.js';

export const PLAYGROUND_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
    <title>Agentic</title>
    <script>
      try {
        if (localStorage.getItem('agentic-playground-theme') === 'dark') {
          document.documentElement.dataset.theme = 'dark';
        }
      } catch {}
    </script>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(AGENTIC_FAVICON)}" />
    <link rel="stylesheet" href="/playground/styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/playground" aria-label="Agentic home">
          <span class="brand-mark" aria-hidden="true">${AGENTIC_SYMBOL}</span>
          <span>Agentic</span><span class="brand-divider" aria-hidden="true">/</span><span class="workspace-label">Your workspace</span>
        </a>
        <div class="topbar-actions">
          <span id="connection" class="sr-only" role="status">Connecting</span>
          <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Use dark theme">
            <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z"/></svg>
            <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          </button>
          <button id="new-chat" class="quiet-button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New chat</button>
        </div>
      </header>

      <main id="conversation" class="conversation">
        <section id="empty-state" class="empty-state">
          <span class="welcome-aura" aria-hidden="true"><i></i><i></i><i></i><span>${AGENTIC_SYMBOL}</span></span>
          <h1>What's on your mind?</h1>
          <p>Work through an idea, find an answer, or talk it out.</p>
          <div class="prompt-starters" aria-label="Ideas to get started">
            <button class="prompt-starter" type="button" data-prompt="Help me understand a complex topic. Start by asking what I want to learn.">
              <span class="starter-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v13m0-13C9 5 5 5 3 6v13c3-1 6-1 9 2 3-3 6-3 9-2V6c-2-1-6-1-9 2Z"/></svg></span>
              <strong>Make sense of it</strong><span>Explore something new</span><span class="starter-arrow" aria-hidden="true">↗</span>
            </button>
            <button class="prompt-starter" type="button" data-prompt="Help me build a small project. Ask me what I want to make and which language I use.">
              <span class="starter-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/></svg></span>
              <strong>Build something</strong><span>Turn an idea into a start</span><span class="starter-arrow" aria-hidden="true">↗</span>
            </button>
            <button class="prompt-starter" type="button" data-prompt="Help me find a fresh angle on an idea. Ask me what I am working on.">
              <span class="starter-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></svg></span>
              <strong>Find a fresh angle</strong><span>Give your thinking room</span><span class="starter-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
        <div id="messages" class="messages" aria-live="polite"></div>
      </main>

      <footer class="composer-wrap">
        <div class="composer">
          <label class="sr-only" for="message">Message Agentic</label>
          <textarea id="message" rows="1" maxlength="8000" placeholder="Ask anything, or think out loud…"></textarea>
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
              <button id="send" class="send-button" type="button" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
            </div>
          </div>
        </div>
        <p class="disclaimer">Agentic can make mistakes. Check important information.</p>
      </footer>
    </div>

    ${VOICE_PLAYGROUND_VIEW}

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
    themeToggle: document.querySelector('#theme-toggle'),
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

  const themeRoot = document.documentElement;
  function applyTheme(theme) {
    if (!themeRoot?.dataset) return;
    if (theme === 'dark') themeRoot.dataset.theme = 'dark';
    else delete themeRoot.dataset.theme;
    if (elements.themeToggle) {
      elements.themeToggle.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Use light theme' : 'Use dark theme',
      );
    }
  }
  if (themeRoot?.dataset && elements.themeToggle) {
    elements.themeToggle.addEventListener('click', () => {
      const next = themeRoot.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('agentic-playground-theme', next);
      } catch {}
    });
  }

  function setConnection(state, label) {
    if (themeRoot?.dataset) themeRoot.dataset.connection = state;
    if (elements.connection) elements.connection.textContent = label;
  }

  function syncScrollFade() {
    elements.conversation.classList?.toggle?.(
      'scroll-fade',
      Boolean(elements.empty.hidden),
    );
  }

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
    syncScrollFade();
    const article = document.createElement('article');
    article.className = 'message ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (role === 'user') avatar.textContent = 'Y';
    else avatar.innerHTML = ${JSON.stringify(AGENTIC_SYMBOL)};
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
    ].filter(Boolean);
    for (const value of values) {
      const chip = document.createElement('span');
      chip.textContent = value;
      metadata.append(chip);
    }
    message.body.append(metadata);
  }

  function addSources(sources = []) {
    if (!assistantMessage?.body || !sources.length) return;
    const list = document.createElement('div');
    list.className = 'message-sources';
    const label = document.createElement('strong');
    label.textContent = 'Sources';
    list.append(label);
    for (const source of sources) {
      if (!source?.url || !source?.title) continue;
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title;
      list.append(link);
    }
    assistantMessage.body.append(list);
  }

  function interruptResponse(detail) {
    const message = ensureAssistant();
    stopElapsed();
    setActive(false);
    message.status.hidden = true;
    // Keep received text visible: a transport failure must not erase the answer.
    const notice = document.createElement('div');
    notice.className = 'response-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = detail;
    message.body.append(notice);
    assistantMessage = undefined;
    startedAt = undefined;
    responseStarted = false;
    scrollToLatest();
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
    syncScrollFade();
    elements.message.value = '';
    assistantMessage = undefined;
    responseStarted = false;
    startedAt = undefined;
    socket.disconnect();
    socket.connect();
  }

  socket.on('connect', () => {
    setConnection('online', 'Online');
    setActive(false);
  });

  socket.on('disconnect', () => {
    if (active) interruptResponse('Connection interrupted. This answer is incomplete; send your request again once connected.');
    stopElapsed();
    setConnection('offline', 'Offline');
    setActive(false);
  });

  socket.on('connect_error', () => {
    stopElapsed();
    setConnection('offline', 'Connection failed');
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
    addSources(data.response?.sources);
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
    interruptResponse(data.message ?? 'The response could not be completed. Please try again.');
  });

  elements.send.addEventListener('click', send);
  elements.stop.addEventListener('click', () => socket.emit('chat.cancel', {}));
  elements.newChat.addEventListener('click', resetConversation);
  for (const starter of document.querySelectorAll('.prompt-starter')) {
    starter.addEventListener('click', () => {
      if (active) return;
      elements.message.value = starter.dataset.prompt;
      elements.message.dispatchEvent(new Event('input'));
      elements.message.focus();
    });
  }
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
  --spacing: 0.25rem;
  --background: #ffffff;
  --surface: #ffffff;
  --surface-subtle: #f7f7f8;
  --text: #292d38;
  --muted: #737b8b;
  --border: #e9ebf0;
  --accent: #303746;
  --success: #16a34a;
  --danger: #dc2626;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: var(--background); color: var(--text); }
button, textarea { font: inherit; }
button { color: inherit; }
.app-shell { display: grid; grid-template-rows: 76px minmax(0, 1fr) auto; height: 100%; height: 100dvh; background: radial-gradient(ellipse 45% 50% at 50% 45%, #f5f7fc85, transparent 100%), #fff; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 34px; background: #ffffffd9; }
.brand { display: inline-flex; align-items: center; gap: 12px; color: var(--text); text-decoration: none; font-size: .94rem; font-weight: 650; letter-spacing: -.035em; }
.brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 11px; color: #fff; background: var(--accent); transition: background .2s ease; }
html[data-connection='online'] .brand-mark { background: var(--success); }
.agentic-symbol { display: block; width: 26px; height: 26px; }
.welcome-aura .agentic-symbol { width: 38px; height: 38px; filter: drop-shadow(0 2px 8px #5f74b744); }
.avatar .agentic-symbol { width: 24px; height: 24px; }
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
.voice-button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 12px; color: #6f7a8e; background: #f7f8fb; cursor: pointer; }
.voice-button:hover { color: var(--text); background: var(--surface-subtle); }
.voice-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.voice-button[aria-pressed='true'] { color: #fff; background: var(--danger); animation: orb-breathe 1.4s ease-in-out infinite; }
.voice-button:disabled { cursor: wait; opacity: .55; }
${VOICE_PLAYGROUND_STYLES}

button:focus-visible, a:focus-visible { outline: 3px solid #9aaee9; outline-offset: 4px; }
.brand-divider { margin: 0 1px; color: #d3d6de; font-weight: 300; }
.workspace-label { color: #858c9b; font-size: .8rem; font-weight: 450; letter-spacing: -.01em; }
.quiet-button svg, .send-button svg, .starter-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.send-button svg { width: 21px; height: 21px; }
.welcome-aura { position: relative; display: grid; place-items: center; width: 76px; height: 76px; margin-bottom: 24px; isolation: isolate; }
.welcome-aura::before { position: absolute; inset: -30px; z-index: -1; border-radius: 50%; background: radial-gradient(circle, #dde9fa90 0%, #f2edfc40 42%, transparent 70%); content: ''; }
.welcome-aura i { position: absolute; inset: 5px; border: 1px solid #9ac9df60; border-radius: 44% 56% 60% 40%; background: linear-gradient(135deg, #ddf7f98a, #b6c9eb85 40%, #cfc0f78a); transform: rotate(-15deg); }
.welcome-aura i:nth-child(2) { inset: 9px; border-color: #c6b3e06b; transform: rotate(45deg); }
.welcome-aura i:nth-child(3) { inset: 13px; border-color: #ffffffa6; transform: rotate(90deg); background: linear-gradient(130deg, #ffffff70, #9eabe86b); }
.welcome-aura > span { z-index: 1; color: #fff; text-shadow: 0 2px 12px #5f74b75c; font-size: 1.6rem; }
.prompt-starters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: min(640px, 100%); margin-top: 36px; }
.prompt-starter { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 18px; border: 1px solid #e9ecf3; border-radius: 16px; color: #4c566c; background: #ffffffb8; text-align: left; cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; }
.prompt-starter:hover { border-color: #c7d0e8; box-shadow: 0 7px 20px #455a910a; transform: translateY(-2px); }
.starter-icon { display: grid; place-items: center; width: 29px; height: 29px; margin-bottom: 8px; border: 1px solid #edf0f6; border-radius: 9px; color: #7f90bd; background: #f7f9fe; }
.prompt-starter:nth-child(2) .starter-icon { color: #768e85; background: #f5f9f6; }
.prompt-starter:nth-child(3) .starter-icon { color: #9a82b4; background: #f9f6fc; }
.prompt-starter strong { font-size: .73rem; font-weight: 550; letter-spacing: -.015em; }
.prompt-starter > span:not(.starter-icon):not(.starter-arrow) { color: #7c8698; font-size: .64rem; line-height: 1.4; }
.starter-arrow { position: absolute; top: 20px; right: 17px; color: #b0bacb; font-size: .82rem; }
.composer:focus-within { border-color: #becbe6; box-shadow: 0 0 0 3px #eff3fc80, 0 16px 45px -22px #46577938; }
.theme-toggle { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 1px solid var(--border); border-radius: 10px; color: var(--muted); background: var(--surface); cursor: pointer; }
.theme-toggle:hover { color: var(--text); background: var(--surface-subtle); }
.theme-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
html:not([data-theme='dark']) .theme-icon-sun,
html[data-theme='dark'] .theme-icon-moon { display: none; }
.quiet-button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); cursor: pointer; font-size: .73rem; font-weight: 500; }
.quiet-button:hover { background: var(--surface-subtle); }
.quiet-button:disabled { cursor: not-allowed; opacity: .5; }
@property --scroll-fade-t { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --scroll-fade-b { syntax: "<length>"; inherits: false; initial-value: 0px; }
@keyframes scroll-fade-reveal-t { from { --scroll-fade-t: 0px; } to { --scroll-fade-t: var(--_scroll-fade-size-t); } }
@keyframes scroll-fade-reveal-b { from { --scroll-fade-b: var(--_scroll-fade-size-b); } to { --scroll-fade-b: 0px; } }
.scroll-fade {
  --_scroll-fade-size-t: min(12%, calc(var(--spacing) * 10));
  --_scroll-fade-size-b: min(12%, calc(var(--spacing) * 10));
  --scroll-fade-block: linear-gradient(to bottom, transparent 0, #000 var(--scroll-fade-t, 0px), #000 calc(100% - var(--scroll-fade-b, 0px)), transparent 100%);
  -webkit-mask-image: var(--scroll-fade-block);
  mask-image: var(--scroll-fade-block);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
@supports (animation-timeline: scroll()) {
  .scroll-fade {
    animation: scroll-fade-reveal-t 1ms ease-in-out, scroll-fade-reveal-b 1ms ease-in-out;
    animation-timeline: scroll(self y), scroll(self y);
    animation-range: 0 calc(var(--spacing) * 24), calc(100% - calc(var(--spacing) * 24)) 100%;
    animation-fill-mode: both;
  }
}
@supports not (animation-timeline: scroll()) {
  .scroll-fade { --scroll-fade-t: var(--_scroll-fade-size-t); --scroll-fade-b: var(--_scroll-fade-size-b); }
}
.conversation { overflow-y: auto; scroll-behavior: smooth; }
.empty-state { display: flex; min-height: 100%; flex-direction: column; align-items: center; justify-content: center; padding: 34px 24px 42px; text-align: center; }
.empty-state[hidden] { display: none; }
.empty-state h1 { margin: 0 0 15px; font-size: clamp(2rem, 4vw, 3rem); font-weight: 480; line-height: 1.12; letter-spacing: -.055em; }
.empty-state p { margin: 0; color: #7a8292; font-size: .88rem; line-height: 1.7; }
.messages { width: min(800px, calc(100% - 48px)); margin: 0 auto; padding: 44px 0 32px; }
.message { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 13px; margin-bottom: 36px; }
.avatar { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); font-size: .8rem; font-weight: 500; }
.assistant .avatar { color: #7b86c3; border-color: #e7eaf7; background: linear-gradient(135deg, #f3f6ff, #f1f0fa); }
.message-body { min-width: 0; padding-top: 4px; }
.message-label { margin-bottom: 10px; color: #4b5364; font-size: .75rem; font-weight: 600; letter-spacing: -.01em; }
.message-content { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .93rem; line-height: 1.85; }
.user { grid-template-columns: minmax(0, 1fr); }
.user .avatar, .user .message-label { display: none; }
.user .message-body { display: flex; width: min(78%, 620px); flex-direction: column; align-items: flex-end; justify-self: end; }
.user .message-content { display: inline-block; padding: 13px 18px; border: 1px solid #e9edf6; border-radius: 20px 20px 5px 20px; color: #454e60; background: #f2f4fa; }
.message.error .message-content { color: var(--danger); }
.response-notice { margin-top: 12px; color: var(--danger); font-size: .85rem; }
.agent-status { display: flex; align-items: center; gap: 8px; min-height: 28px; color: var(--muted); font-size: .9rem; }
.agent-status[hidden] { display: none; }
.thinking-orb { position: relative; width: 20px; height: 20px; flex: 0 0 20px; animation: orb-spin 2.2s linear infinite; }
.thinking-orb i { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--text); box-shadow: 0 0 8px rgba(24, 24, 27, .18); }
.thinking-orb i:nth-child(1) { top: 1px; left: 8px; }
.thinking-orb i:nth-child(2) { right: 1px; bottom: 3px; animation: orb-breathe 1.1s ease-in-out infinite .15s; }
.thinking-orb i:nth-child(3) { left: 1px; bottom: 3px; animation: orb-breathe 1.1s ease-in-out infinite .3s; }
.status-label { color: transparent; background: linear-gradient(100deg, #71717a 20%, #18181b 45%, #a1a1aa 70%); background-size: 220% 100%; background-clip: text; -webkit-background-clip: text; animation: shimmer 1.8s linear infinite; }
.status-elapsed { min-width: 34px; color: #a1a1aa; font: .72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.runtime-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 17px; }
.runtime-chips span { padding: 4px 7px; border: 1px solid #edf0f5; border-radius: 6px; color: #788294; background: #fbfcfe; font: 400 .62rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.message-sources { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; font-size: .78rem; }
.message-sources strong { color: var(--muted); }
.message-sources a { color: #2563eb; text-underline-offset: 3px; }
.composer-wrap { position: relative; width: min(800px, calc(100% - 48px)); margin: 0 auto; padding: 0 0 22px; background: linear-gradient(to top, #fff 78%, #ffffff00); }
.composer { padding: 17px 18px 12px; border: 1px solid #e0e5ef; border-radius: 23px; background: #fff; box-shadow: 0 4px 8px #30405b03, 0 16px 45px -22px #46577938; transition: border-color .2s, box-shadow .2s; }
textarea { display: block; width: 100%; max-height: 180px; min-height: 55px; resize: none; padding: 2px 1px 14px; border: 0; outline: 0; background: transparent; color: var(--text); font-size: .88rem; line-height: 1.65; }
textarea::placeholder { color: #8a93a5; }
.composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.composer-status { display: flex; min-width: 0; align-items: center; gap: 10px; }
.composer-hint { color: #8991a0; font-size: .61rem; }
.composer-buttons { display: flex; gap: 8px; }
.send-button, .stop-button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 12px; cursor: pointer; }
.send-button[hidden], .stop-button[hidden] { display: none; }
.send-button { color: #fff; background: var(--accent); font-size: 1.25rem; }
.send-button:hover { background: #3f3f46; }
.send-button:disabled { cursor: not-allowed; opacity: .35; }
.stop-button { color: #fff; background: var(--danger); font-size: .66rem; }
.disclaimer { margin: 12px 0 0; color: #858d9c; text-align: center; font-size: .6rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
#voice-audio { display: none; }
@keyframes shimmer { to { background-position: -220% 0; } }
@keyframes orb-spin { to { transform: rotate(360deg); } }
@keyframes orb-breathe { 50% { opacity: .3; transform: scale(.65); } }
@keyframes voice-pulse { 50% { opacity: .35; } }
@keyframes voice-think { 50% { height: 10px; transform: translateY(-2px); } }
@keyframes voice-wave { 50% { height: 13px; } }
@keyframes voice-session-enter { from { opacity: 0; transform: scale(.985); } }
@media (max-width: 640px) { .app-shell { grid-template-rows: 62px minmax(0, 1fr) auto; } .workspace-label, .brand-divider { display: none; } .empty-state { padding: 30px 20px; } .welcome-aura { width: 62px; height: 62px; margin-bottom: 18px; } .prompt-starters { gap: 8px; margin-top: 26px; } .prompt-starter { padding: 12px; border-radius: 13px; } .prompt-starter strong { font-size: .66rem; } .prompt-starter > span:not(.starter-icon):not(.starter-arrow), .starter-arrow { display: none; } .empty-state p { font-size: .8rem; max-width: 270px; } .composer-wrap, .messages { width: calc(100% - 28px); } .composer-wrap { padding-bottom: 12px; } .composer { padding: 14px 13px 10px; border-radius: 20px; } .topbar { padding: 0 18px; } .voice-status { font-size: 0; } .messages { padding-top: 28px; } .composer-hint { display: none; } }

@media (max-width: 640px) { textarea { font-size: 16px; } .send-button, .stop-button, .voice-button { width: 44px; height: 44px; } .quiet-button { min-height: 44px; } .composer-wrap { padding-bottom: max(12px, env(safe-area-inset-bottom)); } }
@media (max-height: 500px) { .empty-state { justify-content: flex-start; padding-top: 24px; padding-bottom: 24px; } .welcome-aura { width: 48px; height: 48px; margin-bottom: 14px; } .prompt-starters { margin-top: 20px; } textarea { max-height: 100px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; } .scroll-fade { animation-duration: 1ms !important; } }
html[data-theme='dark'] {
  color-scheme: dark;
  --background: #000000;
  --surface: #171b24;
  --surface-subtle: #222733;
  --text: #e8ebf2;
  --muted: #a7b0c0;
  --border: #2d3340;
  --accent: #3c4658;
}
html[data-theme='dark'] body,
html[data-theme='dark'] .app-shell { background: #000000; }
html[data-theme='dark'] .topbar { background: #000000; }
html[data-theme='dark'] .workspace-label,
html[data-theme='dark'] .empty-state p,
html[data-theme='dark'] .disclaimer,
html[data-theme='dark'] .composer-hint,
html[data-theme='dark'] .message-label { color: #9aa3b5; }
html[data-theme='dark'] .quiet-button,
html[data-theme='dark'] .theme-toggle,
html[data-theme='dark'] .avatar { background: #1c212c; }
html[data-theme='dark'] .prompt-starter { border-color: #2c3342; color: #d5dbe6; background: #1a1e28; }
html[data-theme='dark'] .prompt-starter strong { color: #eef1f6; }
html[data-theme='dark'] .starter-icon { border-color: #323848; background: #222838; }
html[data-theme='dark'] .composer-wrap { background: linear-gradient(to top, #000000 78%, #00000000); }
html[data-theme='dark'] .composer { border-color: #31384a; background: #171b24; }
html[data-theme='dark'] .user .message-content { border-color: #343b4d; color: #e4e8f1; background: #242a38; }
html[data-theme='dark'] .assistant .avatar { border-color: #343b4d; color: #c5d0f5; background: #1c2433; }
html[data-theme='dark'] .runtime-chips span { border-color: #31384a; color: #b7c0d0; background: #1c212c; }
html[data-theme='dark'] .voice-session { color: #e8ebf2; background: #000000; }
html[data-theme='dark'] .voice-session-header,
html[data-theme='dark'] .voice-transcript-panel > header,
html[data-theme='dark'] .voice-transcript-panel > footer { border-color: #2a3040; }
html[data-theme='dark'] .voice-stage,
html[data-theme='dark'] .voice-transcript-panel { border-color: #2a3040; background: #141820; }
html[data-theme='dark'] .voice-back,
html[data-theme='dark'] .voice-control,
html[data-theme='dark'] .voice-start { color: #e8ebf2; }
html[data-theme='dark'] .voice-participant,
html[data-theme='dark'] .voice-transcript-turn.user .words { border-color: #31384a; background: #1c212c; }
html[data-connection='online'] .brand-mark,
html[data-connection='online'] .voice-session-brand .brand-mark { background: var(--success); }
`;
