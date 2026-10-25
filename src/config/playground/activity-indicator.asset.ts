const glyph = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const activityGlyphs = {
  thinking: '',
  searching: glyph(
    '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><path d="M4 12h16"/>',
  ),
  reading: glyph(
    '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1ZM12 6v14"/>',
  ),
  reviewing: glyph(
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 14l3 3 5-5"/>',
  ),
  organizing: glyph('<path d="m12 3 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>'),
  tool: glyph('<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>'),
  handoff: glyph('<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>'),
  responding: glyph('<path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4"/>'),
  approval: glyph('<circle cx="12" cy="12" r="9"/><path d="M9 8v8M15 8v8"/>'),
  stopping: glyph('<rect x="6" y="6" width="12" height="12" rx="3"/>'),
};

export const ACTIVITY_INDICATOR_VIEW =
  '<span class="activity-orb" aria-hidden="true"><i class="activity-core"></i><i class="activity-ring"></i><span class="activity-symbol"></span></span>';

export const ACTIVITY_INDICATOR_APP = `
  const activityGlyphs = ${JSON.stringify(activityGlyphs)};
  const activityLabels = {
    'Searching the web': 'searching',
    'Reading a page': 'reading',
    'Reviewing sources': 'reviewing',
    'Reviewing information': 'reviewing',
    'Organizing context': 'organizing',
    'Stopping': 'stopping',
  };
  function updateActivityIndicator(message, data) {
    // These labels come from provider events, never from an animation timer.
    // Only trusted local SVGs can become markup, not streamed message content.
    const activity = Object.hasOwn(activityLabels, data.message) ? activityLabels[data.message]
      : Object.hasOwn(activityGlyphs, data.phase) ? data.phase : 'thinking';
    if (message.status.dataset.activity === activity) return;
    message.status.dataset.activity = activity;
    message.activitySymbol.innerHTML = activityGlyphs[activity];
  }
`;

export const ACTIVITY_INDICATOR_STYLES = `
.activity-orb { --orb-color: #438b79; position: relative; display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 28px; color: var(--orb-color); }
.activity-core { position: absolute; inset: 4px; border-radius: 50%; background: radial-gradient(circle at 30% 24%, #defbee 0%, #87c8b7 22%, #5e94b9 50%, #777aaa 74%, #c0bde4 100%); box-shadow: inset -2px -3px 5px #32486540, inset 1px 1px 4px #ffffffb3, 0 0 12px #7ebcaf30; animation: activity-think 2.8s ease-in-out infinite; }
.activity-ring { position: absolute; inset: 0; border: 1px solid transparent; border-top-color: var(--orb-color); border-right-color: color-mix(in srgb, var(--orb-color) 18%, transparent); border-radius: 50%; opacity: .5; animation: activity-orbit 2.4s linear infinite; }
.activity-symbol { position: relative; display: grid; place-items: center; width: 20px; height: 20px; }
.activity-symbol svg { width: 19px; height: 19px; }
.agent-status:not([data-activity='thinking']) .activity-core { opacity: .12; box-shadow: none; animation: none; }
.agent-status[data-activity='searching'] .activity-orb { --orb-color: #5579ad; }
.agent-status[data-activity='searching'] .activity-ring { animation-duration: 1.8s; }
.agent-status[data-activity='reading'] .activity-symbol, .agent-status[data-activity='reviewing'] .activity-symbol, .agent-status[data-activity='organizing'] .activity-symbol, .agent-status[data-activity='tool'] .activity-symbol { animation: activity-read 2s ease-in-out infinite; }
.agent-status[data-activity='handoff'] .activity-symbol { animation: activity-transfer 1.6s ease-in-out infinite; }
.agent-status[data-activity='responding'] .activity-symbol { animation: activity-read .8s ease-in-out infinite; }
.agent-status[data-activity='approval'] .activity-orb, .agent-status[data-activity='stopping'] .activity-orb { --orb-color: var(--muted); }
.agent-status[data-activity='approval'] .activity-ring, .agent-status[data-activity='stopping'] .activity-ring { animation: none; border-color: var(--border); }
.agent-status[data-activity='approval'] .status-label, .agent-status[data-activity='stopping'] .status-label { animation: none; background: none; color: var(--muted); }
html[data-theme='dark'] .activity-orb { --orb-color: #8ecdbc; }
html[data-theme='dark'] .agent-status[data-activity='searching'] .activity-orb { --orb-color: #9bb9e5; }
@keyframes activity-think { 0%, 100% { transform: scale(.88) rotate(0); filter: hue-rotate(0deg); } 50% { transform: scale(1.06) rotate(25deg); filter: hue-rotate(22deg); } }
@keyframes activity-orbit { to { transform: rotate(360deg); } }
@keyframes activity-read { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes activity-transfer { 0%, 100% { transform: translateX(-1px); } 50% { transform: translateX(1px); } }
@media (prefers-reduced-motion: reduce) { .activity-core, .activity-ring, .activity-symbol { animation: none !important; } }
`;
