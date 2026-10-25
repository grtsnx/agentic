// The playground owns presentation. This client consumes the same ChatKit
// thread/event protocol as the official component, without embedding a second UI.
export const CHATKIT_HISTORY_VIEW = `<dialog id="chat-history" class="chat-history" aria-labelledby="chat-history-title"><header><h2 id="chat-history-title">Conversations</h2><button id="history-close" type="button" aria-label="Close history">✕</button></header><button id="new-chat" class="quiet-button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New chat</button><p id="history-notice" role="status"></p><div id="history-list"></div></dialog>`;
export const CHATKIT_STYLES = `
.chat-history{margin:0 0 0 auto;width:min(380px,100vw);max-width:100vw;height:100dvh;max-height:100dvh;padding:24px;border:0;border-left:1px solid var(--border);background:var(--surface);color:var(--text);}
.chat-history #new-chat{width:100%;justify-content:flex-start;margin:8px 0;border:1px solid var(--border);}
.chat-history::backdrop{background:#10182855;}
.chat-history header,.history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.chat-history h2{font-size:18px;}.chat-history button{border:0;background:transparent;cursor:pointer;color:inherit;min-height:44px;}
.history-row{border-bottom:1px solid var(--border);padding:8px 0;}.history-row button{color:var(--muted);}.history-row button:first-child{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#history-notice{font-size:13px;color:var(--muted);}.chat-history button:hover{color:var(--text);}
`;
export const CHATKIT_APP = String.raw`
function createChatkitTransport() {
  const handlers=new Map();
  let threadId;
  let files=[];
  let controller;
  let connected=navigator.onLine!==false;
  const deliver=(name,data)=>{for(const handler of handlers.get(name)??[])handler(data);};
  const endpoint=()=>{const value=workspacePanel.credentials();return {url:'/v1/chatkit/'+value.workspaceId,headers:{Authorization:'Bearer '+value.workspaceToken,'Content-Type':'application/json'}};};
  async function request(type,params,signal=AbortSignal.timeout(65000)) {
    await workspacePanel.prepare();
    const {url,headers}=endpoint();
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({type,params}),signal});
    if(!response.ok){let body;try{body=await response.json();}catch{}throw new Error(body?.message??'The conversation request failed. Please try again.');}
    return response;
  }
  async function json(type,params){return (await request(type,params)).json();}
  async function stream(type,params,onEvent,signal) {
    const response=await request(type,params,signal);
    if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('The response stream was unavailable.');
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let buffer='';
    try {
      while(true){
        const {done,value}=await reader.read();
        buffer+=decoder.decode(value,{stream:!done});
        // Normalize CRLF only after complete chunks have been assembled.
        let match;
        while((match=/\r?\n\r?\n/.exec(buffer))){
          const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
          const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
          if(data){const event=JSON.parse(data);if(event.type==='error')throw new Error(event.message);await onEvent(event);}
        }
        if(buffer.length>4*1024*1024)throw new Error('The response exceeded the stream limit.');
        if(done){if(buffer.trim())throw new Error('The response stream was interrupted.');break;}
      }
    } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  async function syncFiles() {
    if(!threadId){files=[];return;}
    const thread=await json('threads.get_by_id',{thread_id:threadId});files=thread.files??[];
  }
  async function send(data) {
    if(controller)return;
    controller=new AbortController();const current=controller;
    let completed;
    deliver('chat.started');
    try {
      const input={content:[{type:'input_text',text:data.message}],attachments:data.attachments??[],inference_options:{}};
      await stream(threadId?'threads.add_user_message':'threads.create',threadId?{thread_id:threadId,input}:{input},event=>{
        if(event.type==='thread.created'){threadId=event.thread.id;files=event.thread.files??[];}
        if(event.type==='progress_update')deliver('chat.status',{message:event.text});
        if(event.type==='thread.item.updated'&&event.update.type==='assistant_message.content_part.text_delta')deliver('chat.delta',{delta:event.update.delta});
        if(event.type==='thread.item.done'){
          if(event.item.type==='assistant_message')completed=event.item.agentic??{message:event.item.content.map(part=>part.text).join('\n'),sources:[]};
          else if(event.item.type==='widget')deliver('chat.widget',event.item);
        }
      },current.signal);
      if(!completed)throw new Error('The response was interrupted. Please send a new message.');
      await syncFiles().catch(()=>{});
      deliver('chat.completed',{response:completed});
    } catch(error){
      deliver(current.signal.aborted&&connected?'chat.cancelled':'chat.error',{message:connected?error.message:'Network connection lost. Reconnect and send a new message.'});
    } finally {if(controller===current)controller=undefined;}
  }
  async function action(item,action) {
    if(controller)throw new Error('Wait for the current response to finish.');
    const current=new AbortController();controller=current;
    try {await stream('threads.custom_action',{thread_id:threadId,item_id:item.id,action},event=>{if(event.type==='thread.item.replaced')deliver('chat.widget',event.item);},AbortSignal.any([current.signal,AbortSignal.timeout(65000)]));await syncFiles();}
    finally {if(controller===current)controller=undefined;}
  }
  async function load(id) {
    if(controller)throw new Error('Wait for the current response to finish.');
    const items=[];let after=null;
    do {const page=await json('items.list',{thread_id:id,order:'asc',limit:100,after});items.push(...page.data);after=page.has_more?page.after:null;}while(after);
    const thread=await json('threads.get_by_id',{thread_id:id});
    await workspacePanel.clearDrafts();
    threadId=id;files=thread.files??[];
    workspacePanel.useFiles(files);
    deliver('chat.history',items);
  }
  globalThis.addEventListener?.('offline',()=>{connected=false;controller?.abort();deliver('disconnect');});
  globalThis.addEventListener?.('online',()=>{connected=true;deliver('connect');});
  queueMicrotask(()=>deliver(connected?'connect':'disconnect'));
  return {
    on(name,handler){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(handler);},deliver,
    get connected(){return connected;},get files(){return files;},get busy(){return !!controller;},
    emit(name,data){if(name==='chat.send')void send(data);else if(name==='chat.cancel'){deliver('chat.cancelling');controller?.abort();}},
    disconnect(){controller?.abort();},connect(){deliver(connected?'connect':'disconnect');},
    newThread(){threadId=undefined;files=[];},json,load,action,
    async deleteThread(id){await json('threads.delete',{thread_id:id});if(threadId===id)resetConversation();},
  };
}
const chatkitWidgets=new Map();
function renderChatkitWidget(item) {
  // Only approval cards belong in the conversation. Usage and attachment cards
  // are already rendered by our message components. Never interpret remote HTML.
  const children=item.widget?.children??[];
  if(children[0]?.value!=='Review action')return;
  const card=document.createElement('article');card.className='approval-card';card.setAttribute('aria-label','Action approval');
  const status=document.createElement('p');status.setAttribute('role','status');
  const render=(node)=>{
    if(node.type==='Text'){const text=document.createElement('p');text.textContent=node.value;return text;}
    if(node.type==='Row'){const row=document.createElement('footer');for(const child of node.children??[]){const element=render(child);if(element)row.append(element);}return row;}
    if(node.type==='Button'&&node.onClickAction?.type==='approval.decide'){
      const button=document.createElement('button');button.type='button';button.textContent=node.label;
      button.addEventListener('click',async()=>{
        if(active||chatTransport.busy){status.textContent='Wait for the current response to finish.';return;}
        for(const sibling of card.querySelectorAll('button'))sibling.disabled=true;
        status.textContent='Submitting your decision…';
        try{await chatTransport.action(item,node.onClickAction);}
        catch(error){status.textContent='Could not confirm the outcome: '+error.message+' Check before requesting this action again.';}
      });return button;
    }
  };
  for(const child of children){const element=render(child);if(element)card.append(element);}card.append(status);
  const existing=chatkitWidgets.get(item.id);if(existing?.isConnected)existing.replaceWith(card);else document.querySelector('#messages').append(card);
  chatkitWidgets.set(item.id,card);
}
function setupChatkitHistory() {
  const dialog=document.querySelector('#chat-history'),list=document.querySelector('#history-list'),notice=document.querySelector('#history-notice');
  document.querySelector('#history-close')?.addEventListener('click',()=>dialog.close());
  document.querySelector('#history')?.addEventListener('click',async()=>{
    if(active||chatTransport.busy)return;
    dialog.showModal();notice.textContent='Loading conversations…';list.replaceChildren();
    try {
      let after=null;
      do {
        const page=await chatTransport.json('threads.list',{limit:100,after});
        for(const thread of page.data){
          const row=document.createElement('div');row.className='history-row';
          const open=document.createElement('button');open.type='button';open.textContent=thread.title;open.title=thread.title;
          open.addEventListener('click',async()=>{open.disabled=true;try{await chatTransport.load(thread.id);dialog.close();}catch(error){notice.textContent=error.message;}finally{open.disabled=false;}});
          const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Delete '+thread.title);
          remove.addEventListener('click',async()=>{remove.disabled=true;try{await chatTransport.deleteThread(thread.id);row.remove();}catch(error){notice.textContent=error.message;remove.disabled=false;}});
          row.append(open,remove);list.append(row);
        }
        after=page.has_more?page.after:null;
      }while(after);
      notice.textContent=list.children.length?'Conversations expire after 30 minutes.':'No conversations yet.';
    }catch(error){notice.textContent=error.message;}
  });
}
queueMicrotask(setupChatkitHistory);
`;
