export const COMPUTER_BUTTON = `<button id="computer-open" class="theme-toggle" type="button" aria-label="Computer access" title="Computer access"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/></svg></button>`;
export const COMPUTER_VIEW = `<dialog id="computer-panel" aria-labelledby="computer-title"><header><div><h2 id="computer-title">Your computer</h2><p>A private connection for this conversation.</p></div><button id="computer-close" type="button" aria-label="Close computer panel">✕</button></header><form id="computer-connect"><label for="computer-target">Control</label><select id="computer-target"><option value="browser">Browser on this Mac</option><option value="desktop">Mac apps</option></select><label for="computer-key">Local access key</label><input id="computer-key" type="password" autocomplete="off" spellcheck="false" placeholder="COMPUTER_ACCESS_TOKEN from your .env" required minlength="32" maxlength="256"/><p class="computer-note">Connect for up to 10 minutes. Reads can include private screen content and are sent to the model when it uses the computer. Every action needs your approval.</p><button type="submit">Connect</button></form><p id="computer-status" role="status">Send a message first, then connect this conversation.</p><section id="computer-session" hidden><label for="computer-app">Allowed app</label><select id="computer-app"></select><div class="computer-controls"><button id="computer-refresh" type="button">Refresh view</button><button id="computer-stop" type="button">Stop & disconnect</button></div><p class="computer-note">You can use the Mac yourself at any time. Refreshing the view invalidates earlier action proposals.</p><img id="computer-image" alt="Latest connected browser screenshot" hidden/><pre id="computer-state"></pre></section></dialog>`;
export const COMPUTER_STYLES = `
#computer-panel{box-sizing:border-box;margin:0 0 0 auto;width:min(600px,100vw);max-width:100vw;height:100dvh;max-height:100dvh;padding:24px;border:0;border-left:1px solid var(--border);background:var(--surface);color:var(--text);overflow:auto;}
#computer-panel::backdrop{background:#0005;}#computer-panel header{display:flex;justify-content:space-between;gap:16px;}#computer-panel h2{font-size:22px;margin:0;}#computer-panel p{font-size:13px;line-height:1.6;color:var(--muted);}#computer-panel label{display:block;font-size:13px;margin:18px 0 8px;}
#computer-panel input,#computer-panel select{box-sizing:border-box;width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;}#computer-panel button{min-height:44px;padding:10px 16px;border:1px solid var(--border);border-radius:10px;background:var(--text);color:var(--surface);cursor:pointer;font:inherit;font-size:13px;}#computer-panel button:disabled{opacity:.5;cursor:wait;}#computer-panel #computer-close{background:transparent;color:var(--text);border:0;padding:4px 8px;align-self:flex-start;}#computer-panel .computer-controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;}#computer-panel #computer-refresh{background:var(--surface);color:var(--text);}#computer-image{width:100%;height:auto;border:1px solid var(--border);border-radius:12px;}#computer-state{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;max-height:40vh;overflow:auto;}#computer-panel :focus-visible{outline:2px solid var(--text);outline-offset:3px;}
`;
export const COMPUTER_APP = String.raw`
const computerPanel=(()=>{
  const panel=document.querySelector('#computer-panel'),form=document.querySelector('#computer-connect'),notice=document.querySelector('#computer-status'),session=document.querySelector('#computer-session'),app=document.querySelector('#computer-app'),picture=document.querySelector('#computer-image'),state=document.querySelector('#computer-state');
  let boundThread;let expiry;let target;
  const say=message=>{notice.textContent=message;};
  async function call(thread,path,body){
    const creds=workspacePanel.credentials();
    const response=await fetch('/v1/chatkit/'+creds.workspaceId+'/threads/'+thread+'/computer'+path,{method:'POST',headers:{Authorization:'Bearer '+creds.workspaceToken,'Content-Type':'application/json'},body:JSON.stringify(body??{}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw new Error(result.message??'Computer connection failed.');return result.data??result;
  }
  async function stop(){
    if(!boundThread)return;
    const thread=boundThread;say('Stopping computer access…');
    try{await call(thread,'/stop');boundThread=undefined;clearTimeout(expiry);session.hidden=true;form.hidden=false;picture.removeAttribute('src');picture.hidden=true;state.textContent='';say('Disconnected. Computer access has been revoked.');}
    catch(error){say('Could not confirm Stop: '+error.message+' Stop the local Agentic process if the network is unavailable.');throw error;}
  }
  async function refresh(){
    if(!boundThread)return;const thread=boundThread;say('Reading the current screen…');
    try{const view=await call(thread,'/observe',target==='desktop'?{app:app.value}:{});if(thread!==boundThread)return;state.textContent=view.text;picture.hidden=!view.image;if(view.image)picture.src=view.image;else picture.removeAttribute('src');say('Current screen. Ask Agentic what you want to do.');}
    catch(error){say(error.message);}
  }
  document.querySelector('#computer-open').addEventListener('click',()=>panel.showModal());
  document.querySelector('#computer-close').addEventListener('click',()=>panel.close());
  document.querySelector('#computer-stop').addEventListener('click',()=>void stop().catch(()=>{}));
  document.querySelector('#computer-refresh').addEventListener('click',()=>void refresh());
  form.addEventListener('submit',async event=>{
    event.preventDefault();const thread=chatTransport.threadId;if(!thread){say('Send a message first so this connection belongs to one conversation.');return;}
    const submit=form.querySelector('button'),key=document.querySelector('#computer-key');submit.disabled=true;say('Connecting…');
    try{
      const connected=await call(thread,'',{accessToken:key.value,target:document.querySelector('#computer-target').value});boundThread=thread;target=connected.target;form.hidden=true;session.hidden=false;
      app.replaceChildren();for(const id of connected.apps??[]){const option=document.createElement('option');option.value=id;option.textContent=id;app.append(option);}app.hidden=target!=='desktop';panel.querySelector('label[for="computer-app"]').hidden=app.hidden;
      clearTimeout(expiry);expiry=setTimeout(()=>void stop().catch(()=>{}),Math.max(0,connected.expiresAt-Date.now()));
      await refresh();
    }catch(error){say(error.message);}finally{key.value='';submit.disabled=false;}
  });
  return {stop};
})();
`;
