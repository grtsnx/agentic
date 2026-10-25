import { AGENTIC_SYMBOL } from './brand.asset.js';

const microphoneIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/><path class="mic-slash" d="m3 3 18 18"/></svg>`;

export const VOICE_PLAYGROUND_VIEW = `
    <section id="voice-session" class="voice-session" data-state="idle" role="dialog" aria-modal="true" aria-labelledby="voice-title" hidden>
      <header class="voice-session-header">
        <div class="voice-session-brand">
          <span class="brand-mark" aria-hidden="true">${AGENTIC_SYMBOL}</span>
          <strong>Agentic<span class="voice-brand-divider">/</span><span>Voice</span></strong>
        </div>
        <button id="voice-back" class="voice-back" type="button" aria-label="End voice session and return to chat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>
          Back to chat
        </button>
      </header>
      <div class="voice-session-layout scroll-fade">
        <main class="voice-stage">
          <div class="voice-stage-topline">
            <span id="voice-elapsed" class="voice-elapsed" aria-label="Call duration">00:00</span>
          </div>
          <div class="voice-center">
            <div class="voice-agent-visual" aria-hidden="true">
              <div class="voice-orbit voice-orbit-one"></div>
              <div class="voice-orbit voice-orbit-two"></div>
              <canvas id="voice-aura" class="voice-aura-canvas"></canvas>
            </div>
            <div class="voice-stage-copy">
              <p id="voice-session-state" class="voice-state-label" role="status">Ready when you are</p>
              <h1 id="voice-title">Let's talk.</h1>
              <p id="voice-session-hint">A question, a big idea, or just a hello.<br>Make yourself heard.</p>
            </div>
            <div class="voice-participants" aria-label="Conversation participants">
              <div id="voice-user" class="voice-participant" data-active="false">
                <span class="voice-participant-avatar">Y</span>
                <div><strong>You</strong><span id="voice-user-state">Mic off</span></div>
                <span id="voice-user-meter" class="voice-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
              </div>
              <span class="voice-participant-link" aria-hidden="true"><i></i><i></i><i></i></span>
              <div id="voice-agent" class="voice-participant" data-active="false">
                <span class="voice-participant-avatar">${AGENTIC_SYMBOL}</span>
                <div><strong>Agentic</strong><span id="voice-agent-state">Ready</span></div>
                <span id="voice-agent-meter" class="voice-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
              </div>
            </div>
          </div>
          <div class="voice-stage-bottom">
            <div class="voice-control-bar">
              <button id="voice-mute" class="voice-control voice-mic-control" type="button" aria-pressed="false" aria-label="Mute microphone" disabled>${microphoneIcon}<span class="sr-only">Mute microphone</span></button>
              <button id="voice-start" class="voice-start" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6m4-10v14m4-16v18m4-16v14m4-10v6"/></svg><span>Start conversation</span></button>
              <button id="voice-end" class="voice-end" type="button" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14v-3c5-5 13-5 18 0v3l-5 1-1-4H9l-1 4-5-1Z"/></svg><span>End conversation</span></button>
              <button id="voice-transcript-toggle" class="voice-control" type="button" aria-label="Toggle transcript" aria-pressed="true" aria-controls="voice-transcript-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></button>
            </div>
            <button id="voice-enable-audio" class="voice-enable-audio" type="button" hidden>Tap to hear Agentic</button>
            <p id="voice-quality" class="voice-quality">Your microphone stays off until you start.</p>
          </div>
        </main>
        <aside id="voice-transcript-panel" class="voice-transcript-panel" aria-label="Live voice transcript">
          <header><div><span class="voice-eyebrow">Every word, together</span><h2>Conversation</h2></div><span id="voice-live-label" class="live-pill">Ready</span></header>
          <div id="voice-transcript" class="voice-transcript scroll-fade" role="log" aria-live="polite" aria-relevant="additions text">
            <div id="voice-transcript-empty" class="voice-transcript-empty">
              <div class="voice-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h6"/></svg></div>
              <h3>Be in the conversation.</h3><p>Your words appear here as you speak.<br>We'll keep your place.</p>
              <div class="voice-empty-lines" aria-hidden="true"><i></i><i></i><i></i></div>
            </div>
          </div>
          <footer><span class="voice-footer-dot"></span> Transcript stays in this chat</footer>
        </aside>
      </div>
    </section>`;

export const VOICE_PLAYGROUND_STYLES = `
.voice-session { --voice-blue: #5267cb; --voice-mint: #218b79; position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: 76px minmax(0, 1fr); color: #252b37; background: #fff; }
.voice-session[hidden], .voice-session [hidden] { display: none !important; }
.voice-session:not([hidden]) { animation: voice-session-enter .3s ease-out; }
.voice-session svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
.voice-session .agentic-symbol { width: 26px; height: 26px; stroke: none; }
.voice-participant-avatar .agentic-symbol { width: 23px; height: 23px; }
.voice-session button { cursor: pointer; transition: background .18s ease, box-shadow .18s ease; }
.voice-session button:focus-visible { outline: 3px solid #8ea5ee; outline-offset: 4px; }
.voice-session button:disabled { opacity: .45; cursor: default; }
.voice-session-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 34px; border-bottom: 1px solid #f0f0f1; }
.voice-session-brand { display: flex; align-items: center; gap: 12px; }
.voice-session-brand .brand-mark { width: 32px; height: 32px; border-radius: 11px; background: #282c36; }
.voice-session-brand strong { display: flex; align-items: center; gap: 13px; font-size: .94rem; letter-spacing: -.035em; }
.voice-session-brand strong > span:last-child { color: #8e929c; font-weight: 450; }
.voice-brand-divider { color: #d3d6de; font-weight: 300; }
.voice-back { display: inline-flex; align-items: center; gap: 7px; padding: 10px 13px; border: 0; border-radius: 10px; color: #737885; background: transparent; font-size: .75rem; }
.voice-back:hover { color: #252b37; background: #f6f7f9; }
.voice-back svg { width: 16px; height: 16px; }
.voice-session-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(310px, 30%); min-height: 0; padding: 14px; gap: 14px; }
.voice-session[data-transcript='hidden'] .voice-session-layout { grid-template-columns: 1fr; }
.voice-stage { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; min-height: 0; padding: 26px 32px 30px; overflow: hidden; border: 1px solid #f0f0f2; border-radius: 24px; background: radial-gradient(ellipse at 50% 40%, #f0f6fd85 0%, transparent 58%), #fcfcfd; }
.voice-stage-topline { display: flex; align-items: center; justify-content: flex-end; gap: 10px; z-index: 1; }
.voice-eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #8b909b; font-size: .65rem; font-weight: 500; letter-spacing: .04em; }
.voice-elapsed { color: #969ba7; font: .7rem/1.2 ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.voice-center { display: flex; min-width: 0; min-height: 0; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.voice-agent-visual { position: relative; flex-shrink: 1; min-height: 100px; width: min(440px, 58vh, 100%); aspect-ratio: 1; margin: -22px 0 -18px; isolation: isolate; }
.voice-aura-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.voice-orbit { position: absolute; left: 50%; top: 50%; width: 78%; aspect-ratio: 1; border: 1px solid #c8d5e126; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
.voice-orbit-two { width: 96%; border-style: dashed; border-color: #c8d5e11c; }
.voice-stage-copy { position: relative; flex: 0 0 auto; }
.voice-state-label { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 12px; color: var(--voice-blue); font-size: .68rem; font-weight: 550; letter-spacing: .03em; }
.voice-state-label::before { width: 4px; height: 4px; border-radius: 50%; background: currentColor; content: ''; }
.voice-stage h1 { margin: 0 0 13px; font-size: clamp(1.9rem, 3.25vw, 3rem); font-weight: 480; line-height: 1.08; letter-spacing: -.055em; }
#voice-session-hint { max-width: 360px; min-height: 40px; margin: 0 auto; color: #778192; font-size: .8rem; font-weight: 400; line-height: 1.7; }
.voice-participants { display: flex; align-items: center; gap: 17px; margin-top: 25px; }
.voice-participant { display: flex; align-items: center; gap: 9px; padding: 9px 11px; border: 1px solid #eaecef; border-radius: 13px; background: #ffffffbf; text-align: left; transition: border-color .15s ease, box-shadow .15s ease; }
.voice-participant-avatar { display: grid; place-items: center; width: 29px; height: 29px; border-radius: 10px; color: #707b8b; background: #f2f4f7; font-size: .65rem; }
#voice-agent .voice-participant-avatar { color: #6678c2; background: #f0f2fc; font-size: .95rem; }
.voice-participant > div { display: grid; gap: 3px; min-width: 42px; }
.voice-participant strong { font-size: .65rem; font-weight: 600; }
.voice-participant div > span { color: #7b8494; font-size: .57rem; }
.voice-participant-link { display: flex; gap: 4px; }
.voice-participant-link i { width: 2px; height: 2px; border-radius: 50%; background: #c4c9d4; }
.voice-level-meter { display: flex; align-items: center; gap: 2px; width: 22px; height: 20px; margin-left: 7px; color: #b6c1d2; }
.voice-level-meter i { width: 2px; height: 16px; border-radius: 3px; background: currentColor; transform: scaleY(.15); transform-origin: center; }
#voice-user[data-active='true'] { border-color: #b8dacf; box-shadow: 0 0 0 3px #b8dacf12; }
#voice-user[data-active='true'] .voice-level-meter { color: var(--voice-mint); }
#voice-agent[data-active='true'] { border-color: #c6cff0; box-shadow: 0 0 0 3px #c6cff012; }
#voice-agent[data-active='true'] .voice-level-meter { color: var(--voice-blue); }
.voice-stage-bottom { position: relative; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 26px; }
.voice-control-bar { display: flex; align-items: center; gap: 10px; padding: 7px; border: 1px solid #ebecef; border-radius: 20px; background: #fff; box-shadow: 0 8px 22px -16px #303b6650, 0 2px 5px #303b6603; }
.voice-control { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 0; border-radius: 12px; color: #7d8390; background: #fff; }
.voice-control:hover { background: #f4f5f8; }
.voice-control[aria-pressed='true'] { color: #434e6c; background: #f3f5fa; }
.voice-mic-control[aria-pressed='true'] { color: #c05858; background: #fff2f1; }
.mic-slash { display: none; }
.voice-mic-control[aria-pressed='true'] .mic-slash { display: block; }
.voice-start, .voice-end { display: inline-flex; justify-content: center; align-items: center; gap: 9px; min-height: 44px; padding: 0 21px; border: 0; border-radius: 12px; font-size: .73rem; font-weight: 550; }
.voice-start { color: #fff; background: #303746; box-shadow: inset 0 1px 1px #ffffff20; }
.voice-start:hover { background: #454f63; }
.voice-end { color: #b25050; background: #fff0ef; }
.voice-end:hover { background: #ffe4e2; }
.voice-quality { max-width: 100%; margin: 0; color: #7c8595; font-size: .62rem; text-align: center; line-height: 1.5; }
.voice-enable-audio { border: 0; background: #eef2ff; border-radius: 10px; color: #5267cb; padding: 8px 12px; font-size: .75rem; }
.voice-transcript-panel { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; min-height: 0; border: 1px solid #f0f0f2; border-radius: 24px; background: #fff; }
.voice-transcript-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 27px 23px 23px; border-bottom: 1px solid #f3f3f5; }
.voice-transcript-panel .voice-eyebrow { font-size: .58rem; color: #7b8596; }
.voice-transcript-panel h2 { margin: 7px 0 0; font-size: 1.08rem; font-weight: 520; letter-spacing: -.035em; }
.live-pill { padding: 5px 8px; border: 1px solid #e7eceb; border-radius: 7px; color: #939d9c; background: #fafcfc; font-size: .56rem; }
.voice-session[data-connected='true'] .live-pill { color: #4a9581; border-color: #deeee7; background: #f5fbf8; }
.voice-transcript { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 25px 21px; scrollbar-width: thin; }
.voice-transcript-empty { display: flex; height: 100%; min-height: 190px; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 30px; text-align: center; }
.voice-empty-icon { display: grid; width: 44px; height: 44px; place-items: center; border: 1px solid #edf0f5; border-radius: 14px; color: #aeb9cb; background: linear-gradient(130deg, #fafbfe, #fff); box-shadow: 0 4px 8px #f4f5f7; }
.voice-transcript-empty h3 { margin: 20px 0 8px; color: #79808e; font-size: .8rem; font-weight: 450; }
.voice-transcript-empty p { margin: 0; color: #a8adb7; font-size: .68rem; line-height: 1.8; }
.voice-empty-lines { display: grid; gap: 8px; width: 150px; margin-top: 28px; opacity: .8; }
.voice-empty-lines i { height: 5px; border-radius: 3px; background: linear-gradient(90deg, #f3f4f8, #f7f8fb); }
.voice-empty-lines i:nth-child(2) { width: 85%; }
.voice-empty-lines i:nth-child(3) { width: 60%; }
.voice-transcript-panel > footer { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 16px 12px; border-top: 1px solid #f3f3f5; color: #7e8797; font-size: .56rem; }
.voice-footer-dot { width: 4px; height: 4px; border-radius: 50%; background: #bec5d4; }
.voice-transcript-turn { margin-bottom: 22px; overflow-wrap: anywhere; }
.voice-transcript-turn .speaker { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #9aa0ac; font-size: .62rem; font-weight: 550; }
.voice-transcript-turn .speaker time { color: #bcc1cb; font-size: .55rem; font-weight: 400; }
.voice-transcript-turn .words { margin: 0; color: #515967; font-size: .8rem; line-height: 1.8; white-space: pre-wrap; }
.voice-transcript-turn.user { margin-left: 18%; }
.voice-transcript-turn.user .speaker { justify-content: flex-end; }
.voice-transcript-turn.user .words { padding: 12px 14px; border: 1px solid #eef0f5; border-radius: 14px 14px 3px 14px; background: #f8f9fc; }
.voice-transcript-turn.interim .words { color: #8e98ab; }
.voice-session[data-state='user-speaking'] .voice-state-label { color: var(--voice-mint); }
.voice-session[data-state='agent-speaking'] .voice-state-label { color: var(--voice-blue); }
.voice-session[data-state='thinking'] .voice-state-label { color: #8b76b7; }
.voice-session[data-state='error'] .voice-state-label { color: #c06262; }
.voice-session[data-state='thinking'] .voice-state-label { animation: voice-pulse 1.5s ease-in-out infinite; }
@media (max-width: 1000px) { .voice-session-layout { grid-template-columns: minmax(0, 1fr) 300px; padding: 10px; gap: 10px; } .voice-stage { padding: 22px 20px; } .voice-participants { gap: 9px; } .voice-participant { padding: 8px; } .voice-level-meter { margin-left: 1px; } }
@media (max-width: 760px) { .voice-session { grid-template-rows: 62px minmax(0, 1fr); } .voice-session-header { padding: 0 20px; } .voice-session-layout { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; } .voice-stage { flex-shrink: 0; min-height: 570px; padding: 20px 18px; } .voice-agent-visual { width: min(300px, 65vw); margin: -8px 0 -14px; } .voice-stage h1 { font-size: 2.3rem; } .voice-center { padding: 8px 0; } .voice-stage-bottom { padding-top: 26px; } .voice-transcript-panel { flex: 1 0 330px; max-height: 480px; } .voice-transcript-panel > header { padding: 22px; } .voice-transcript-empty { min-height: 140px; padding: 12px 0; } .voice-empty-lines { display: none; } .voice-transcript-empty h3 { margin-top: 12px; } .voice-session[data-transcript='hidden'] .voice-stage { flex: 1; } }
@media (max-height: 720px) and (min-width: 761px) { .voice-agent-visual { width: min(290px, 43vh, 100%); } .voice-stage { padding: 18px 26px; } .voice-participants { margin-top: 18px; } .voice-stage-bottom { padding-top: 18px; } .voice-stage h1 { font-size: 2rem; } }
@media (max-width: 400px) {
  .voice-session-header { padding: 0 15px; gap: 8px; }
  .voice-session-brand { gap: 8px; }
  .voice-session-brand strong { gap: 8px; font-size: .86rem; }
  .voice-back { padding: 10px 4px; font-size: .68rem; white-space: nowrap; }
  .voice-back svg { flex-shrink: 0; width: 14px; }
  .voice-participants { width: 100%; max-width: 300px; gap: 8px; }
  .voice-participant { flex: 1; min-width: 0; gap: 6px; padding: 8px 6px; }
  .voice-participant-avatar { width: 25px; height: 25px; flex-shrink: 0; }
  .voice-participant > div { min-width: 35px; }
  .voice-participant-link { display: none; }
  .voice-level-meter { width: 18px; gap: 2px; flex-shrink: 0; }
  .voice-control-bar { width: 100%; max-width: 280px; gap: 6px; padding: 5px; }
  .voice-start, .voice-end { flex: 1; min-width: 0; padding: 0 8px; font-size: .69rem; white-space: nowrap; }
  .voice-start svg, .voice-end svg { display: none; }
}
@media (max-width: 760px) { .voice-stage { height: clamp(440px, calc(100dvh - 82px), 570px); min-height: 440px; } .voice-session-layout { padding-bottom: max(10px, env(safe-area-inset-bottom)); } }
@media (max-height: 500px) and (min-width: 761px) { .voice-session-layout { overflow-y: auto; } .voice-stage, .voice-transcript-panel { min-height: 430px; } }
`;
