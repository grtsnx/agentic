// Local SVGs avoid remote icon requests and keep action styling consistent.
const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const icons = {
  sources: icon(
    '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/>',
  ),
  copy: icon(
    '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  ),
  check: icon('<path d="m5 12 4 4L19 6"/>'),
  close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
  globe: icon(
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  ),
  external: icon(
    '<path d="M14 4h6v6M20 4l-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  ),
};

export const ANSWER_ACTIONS_VIEW = `
    <dialog id="sources-sheet" class="sources-sheet" aria-labelledby="sources-title" aria-describedby="sources-count">
      <header class="sources-header">
        <div class="sources-heading">${icons.sources}<h2 id="sources-title">Sources</h2></div>
        <button id="sources-close" class="sources-close" type="button" aria-label="Close sources" autofocus>${icons.close}</button>
      </header>
      <p id="sources-count" class="sources-count"></p>
      <div id="sources-list" class="sources-list"></div>
    </dialog>`;

export const ANSWER_ACTIONS_APP = `
  const actionIcons = ${JSON.stringify(icons)};
  const sourceSheet = document.querySelector('#sources-sheet');
  const sourceList = document.querySelector('#sources-list');
  const sourceCount = document.querySelector('#sources-count');
  const sourceClose = document.querySelector('#sources-close');
  let sourceTrigger;

  function closeSources() {
    if (sourceSheet.open) sourceSheet.close();
  }
  sourceClose.addEventListener('click', closeSources);
  sourceSheet.addEventListener('close', () => {
    sourceTrigger?.setAttribute('aria-expanded', 'false');
    if (sourceTrigger?.isConnected !== false) sourceTrigger?.focus();
    sourceTrigger = undefined;
    sourceList.replaceChildren();
  });
  sourceSheet.addEventListener('click', (event) => {
    // A dialog's backdrop targets the dialog itself. Ignore clicks inside it.
    if (event.target !== sourceSheet) return;
    const bounds = sourceSheet.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSources();
  });

  function openSources(sources, trigger) {
    sourceTrigger?.setAttribute('aria-expanded', 'false');
    sourceTrigger = trigger;
    sourceList.replaceChildren();
    for (const source of sources) {
      const url = sourceUrl(source.url);
      if (!url) continue;
      const link = sourceLink('', url);
      link.className = 'source-card';
      const globe = document.createElement('span');
      globe.className = 'source-globe';
      globe.innerHTML = actionIcons.globe;
      const details = document.createElement('span');
      details.className = 'source-details';
      const domain = document.createElement('small');
      domain.className = 'source-domain';
      domain.textContent = source.domain;
      const title = document.createElement('strong');
      title.className = 'source-title';
      title.textContent = source.title;
      const address = document.createElement('span');
      address.className = 'source-address';
      address.textContent = source.number + ' · ' + url.hostname + (url.pathname === '/' ? '' : url.pathname);
      details.append(domain, title, address);
      const external = document.createElement('span');
      external.className = 'source-external';
      external.innerHTML = actionIcons.external;
      link.setAttribute('aria-label', 'Source ' + source.number + ': ' + source.title + ', opens in a new tab');
      link.append(globe, details, external);
      sourceList.append(link);
    }
    sourceCount.textContent = sources.length + (sources.length === 1 ? ' web reference' : ' web references');
    trigger.setAttribute('aria-expanded', 'true');
    // Native modal dialog provides focus containment, Escape, and inert background.
    if (!sourceSheet.open) sourceSheet.showModal();
    sourceList.scrollTop = 0;
    sourceClose.focus();
  }

  function addAnswerActions(message, text, sources) {
    const toolbar = document.createElement('div');
    toolbar.className = 'answer-actions';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Answer actions');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-button';
    copy.title = 'Copy response';
    copy.setAttribute('aria-label', 'Copy response');
    copy.innerHTML = actionIcons.copy;
    const status = document.createElement('span');
    status.className = 'answer-action-status';
    status.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(text);
        copy.innerHTML = actionIcons.check;
        status.textContent = 'Copied';
      } catch {
        copy.innerHTML = actionIcons.copy;
        status.textContent = 'Could not copy. Select the response to copy it.';
      } finally { copy.disabled = false; }
    });
    toolbar.append(copy);
    if (sources.length) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sources-button';
      button.innerHTML = actionIcons.sources;
      const label = document.createElement('span');
      label.textContent = 'Sources · ' + sources.length;
      button.append(label);
      button.setAttribute('aria-label', 'View ' + sources.length + ' sources');
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'sources-sheet');
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => openSources(sources, button));
      toolbar.append(button);
    }
    toolbar.append(status);
    message.body.append(toolbar);
  }
`;

export const ANSWER_ACTIONS_STYLES = `
.answer-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.answer-actions button, .sources-close { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 36px; min-height: 36px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); cursor: pointer; font: inherit; font-size: .72rem; }
.answer-actions button:hover svg, .sources-close:hover svg, .source-card:hover svg { color: var(--text); transform: scale(1.12); }
.answer-actions button:disabled { cursor: wait; opacity: .6; }
.answer-actions .sources-button { padding: 6px 9px; }
.answer-actions svg, .sources-sheet svg { width: 18px; height: 18px; flex-shrink: 0; transition: color .15s ease, transform .15s ease; }
.answer-action-status { color: var(--muted); font-size: .7rem; }
.sources-sheet { position: fixed; inset: 12px 12px 12px auto; margin: 0; padding: 0; width: min(420px, calc(100vw - 24px)); height: calc(100dvh - 24px); max-width: none; max-height: none; overflow: hidden; border: 1px solid var(--border); border-radius: 20px; color: var(--text); background: var(--surface); box-shadow: 0 20px 70px #0002; }
.sources-sheet[open] { display: flex; flex-direction: column; animation: sources-enter .18s ease-out; }
.sources-sheet::backdrop { background: #0002; }
.sources-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border); }
.sources-heading { display: flex; align-items: center; gap: 10px; }
.sources-heading h2 { margin: 0; font-size: .98rem; font-weight: 600; letter-spacing: -.02em; }
.sources-count { margin: 0; padding: 18px 22px 8px; color: var(--muted); font-size: .74rem; }
.sources-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 12px 20px; }
.sources-list .source-card { display: flex; align-items: flex-start; gap: 12px; margin: 4px 0; padding: 16px 10px; border-radius: 12px; color: var(--text); text-decoration: none; }
.source-globe { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; color: var(--muted); }
.source-details { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 7px; }
.source-domain { color: var(--muted); font-size: .73rem; overflow-wrap: anywhere; }
.source-title { font-size: .87rem; font-weight: 550; line-height: 1.5; overflow-wrap: anywhere; }
.source-address { color: var(--muted); font-size: .66rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-external { color: var(--muted); padding-top: 2px; }
.source-external svg { width: 14px; height: 14px; }
.answer-actions button:focus-visible, .sources-sheet button:focus-visible, .source-card:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
@keyframes sources-enter { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
@media (max-width: 600px) { .sources-sheet { inset: 0; width: 100%; height: 100dvh; border-radius: 0; border: 0; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); } .answer-actions button, .sources-close { min-width: 44px; min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .sources-sheet[open] { animation: none; } .answer-actions svg, .sources-sheet svg { transition: none; } }
`;
