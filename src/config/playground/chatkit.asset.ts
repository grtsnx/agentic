import type { ChatKitOptions } from '@openai/chatkit';
import { AGENTIC_SYMBOL, AGENTIC_FAVICON } from './brand.asset.js';

const options = {
  frameTitle: 'Agentic conversation',
  theme: {
    colorScheme: 'light',
    radius: 'round',
    density: 'normal',
    color: { accent: { primary: '#159447', level: 2 } },
  },
  header: { title: { text: 'Agentic' } },
  history: { enabled: true, showDelete: true, showRename: true },
  startScreen: {
    greeting: "What's on your mind?",
    prompts: [
      {
        label: 'Explore an idea',
        prompt: 'Help me explore an idea. Ask me what I am working on.',
        icon: 'sparkle',
      },
      {
        label: 'Research a topic',
        prompt:
          'Help me research a topic with sources. Ask me what I want to learn.',
        icon: 'search',
      },
      {
        label: 'Build something',
        prompt: 'Help me build something. Ask what I want to make.',
        icon: 'lightbulb',
      },
    ],
  },
  composer: {
    placeholder: 'Ask anything, or think out loud…',
    attachments: { enabled: false },
  },
  threadItemActions: { feedback: false, retry: false },
  thread: { autoScroll: true },
  disclaimer: {
    text: 'Agentic can make mistakes. Check important information.',
  },
} satisfies Omit<ChatKitOptions, 'api'>;

export const CHATKIT_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Agentic · ChatKit</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(AGENTIC_FAVICON)}">
<link rel="stylesheet" href="/playground/chatkit.css">
<script src="/playground/chatkit.js" defer></script>
</head><body>
<header><a class="brand" href="/playground"><span>${AGENTIC_SYMBOL}</span>Agentic</a>
<nav aria-label="Chat controls"><a href="/playground">Voice & files</a><button id="theme" type="button">Dark theme</button><button id="reset" type="button" hidden>Reconnect</button></nav></header>
<main><div id="notice" role="status">Loading your conversation…</div><openai-chatkit id="chat"></openai-chatkit></main>
</body></html>`;

export const CHATKIT_STYLES = `
:root{color-scheme:light;--bg:#fff;--fg:#202628;--border:#e6e9e7;--muted:#65716a}
:root[data-theme=dark]{color-scheme:dark;--bg:#101513;--fg:#f0f5f2;--border:#29352e;--muted:#b2c0b8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px system-ui,sans-serif;height:100dvh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px clamp(12px,4vw,48px);border-bottom:1px solid var(--border)}
a{color:inherit;text-decoration:none}.brand{display:flex;align-items:center;gap:10px;font-weight:650;font-size:20px}.brand span{width:32px;height:32px;color:#159447}.brand svg{width:100%;height:100%}
nav{display:flex;align-items:center;gap:12px}button{font:inherit;color:inherit;background:transparent;border:1px solid var(--border);border-radius:12px;padding:9px 12px;cursor:pointer}
button:hover,a:hover{color:#159447}a:focus-visible,button:focus-visible{outline:2px solid #159447;outline-offset:4px}
main{flex:1;min-height:0;display:flex;flex-direction:column;width:min(100%,1120px);margin:0 auto;padding-bottom:env(safe-area-inset-bottom)}
openai-chatkit{display:block;width:100%;flex:1;min-height:0}#notice{padding:12px 20px;color:var(--muted);font-size:14px}#notice[hidden]{display:none}
@media(max-width:480px){header{padding:12px;gap:8px}.brand{font-size:17px}nav{gap:8px;font-size:12px}button{padding:8px}.brand span{width:26px;height:26px}}
`;

export function chatkitScript(domainKey: string): string {
  // JSON encoding plus '<' escaping keeps environment values from becoming script markup.
  const config = JSON.stringify({ options, domainKey }).replace(
    /</g,
    '\\u003c',
  );
  return `'use strict';
(async () => {
  const config = ${config};
  const chat = document.getElementById('chat');
  const notice = document.getElementById('notice');
  const reset = document.getElementById('reset');
  const theme = document.getElementById('theme');
  let credentials;
  let dark = false;
  let threadId = null;
  let active = false;
  function status(message, reconnect = false) { notice.textContent = message; notice.hidden = !message; reset.hidden = !reconnect; }
  function save() { try { sessionStorage.setItem('agentic-chatkit', JSON.stringify({ credentials, threadId })); } catch {} }
  async function getWorkspace() {
    try { const saved = JSON.parse(sessionStorage.getItem('agentic-chatkit') || 'null');
      if (saved?.credentials && Date.parse(saved.credentials.expiresAt) > Date.now()) { credentials = saved.credentials; threadId = saved.threadId; }
    } catch {}
    if (credentials) {
      const response = await fetch('/v1/workspaces/' + encodeURIComponent(credentials.id), { headers: { Authorization: 'Bearer ' + credentials.token }, signal: AbortSignal.timeout(10000) });
      if (response.ok) return;
      if (response.status !== 401 && response.status !== 404) throw new Error('Connection unavailable. Try again.');
    }
    const response = await fetch('/v1/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unable to start a conversation. Try again.');
    credentials = (await response.json()).data; threadId = null; save();
  }
  async function authenticatedFetch(input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const endpoint = '/v1/chatkit/' + credentials.id;
    if (url.origin !== location.origin || url.pathname !== endpoint) throw new Error('Unexpected chat destination.');
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', 'Bearer ' + credentials.token);
    try {
      const response = await fetch(input, { ...init, headers });
      if (!response.ok) {
        const failure = await response.clone().json().catch(() => null);
        console.warn('ChatKit request failed', response.status, failure?.message);
        status(response.status === 401 ? 'Your conversation expired. Reconnect to start again.' : 'The request could not finish. Please try again.', response.status === 401);
      }
      return response;
    } catch (error) { if (error.name !== 'AbortError') status('Connection lost. Check your network and reconnect.', true); throw error; }
  }
  function configure() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    theme.textContent = dark ? 'Light theme' : 'Dark theme';
    chat.setOptions({ ...config.options, theme: { ...config.options.theme, colorScheme: dark ? 'dark' : 'light' },
      initialThread: threadId, api: { url: '/v1/chatkit/' + credentials.id, domainKey: config.domainKey, fetch: authenticatedFetch },
      widgets: { onAction: async (action, item) => { await chat.sendCustomAction(action, item.id); } } });
  }
  chat.addEventListener('chatkit.ready', () => status(''));
  chat.addEventListener('chatkit.error', () => status('The conversation could not load. Check your connection and ChatKit domain configuration.', true));
  chat.addEventListener('chatkit.thread.change', (event) => { threadId = event.detail.threadId; save(); });
  chat.addEventListener('chatkit.response.start', () => { active = true; theme.disabled = true; status(''); });
  chat.addEventListener('chatkit.response.end', () => { active = false; theme.disabled = false; });
  window.addEventListener('offline', () => status('You are offline. Reconnecting when your connection returns…', true));
  window.addEventListener('online', () => status('Connection restored. You can continue your conversation.'));
  theme.addEventListener('click', () => { if (active) return; dark = !dark; configure(); });
  reset.addEventListener('click', () => location.reload());
  try {
    if (!config.domainKey) throw new Error('ChatKit needs a registered domain key. Set CHATKIT_DOMAIN_KEY and restart.');
    await getWorkspace();
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';
      const timer = setTimeout(() => reject(new Error('ChatKit could not load. Check your network.')), 15000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('ChatKit could not load. Check your network.')); };
      document.head.append(script);
    });
    await customElements.whenDefined('openai-chatkit');
    configure();
  } catch (error) { status(error.message || 'Unable to connect.', true); }
})();`;
}
