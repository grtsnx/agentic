import {
  FILE_ACCEPT,
  FILE_MIME_TYPES,
  FILE_MAX_BYTES,
  WORKSPACE_MAX_BYTES,
} from '../agent/tools/file-policy.js';
export const WORKSPACE_ATTACHMENTS = `
<input id="workspace-file" type="file" multiple accept="${FILE_ACCEPT}" hidden />
<div id="composer-files" class="composer-files" role="list" aria-label="Attached files" hidden></div>
<p id="composer-upload-notice" class="composer-upload-notice" role="status" hidden></p>`;
export const WORKSPACE_ATTACH_BUTTON = `
<button id="composer-attach" class="attach-button" type="button" aria-label="Attach file" title="Attach file (JPG, PNG, PDF, DOCX, TXT, Markdown, CSV, JSON)">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
</button>`;
export const WORKSPACE_SHEET = `
<dialog id="attachment-preview" class="attachment-preview" aria-labelledby="attachment-preview-title">
  <header><div><h2 id="attachment-preview-title">File preview</h2><small id="attachment-preview-info"></small></div><button id="attachment-preview-close" type="button" aria-label="Close preview">✕</button></header>
  <div id="attachment-preview-body" class="attachment-preview-body" role="status"></div>
  <footer id="attachment-preview-pager" hidden><button id="attachment-previous" type="button" aria-label="Previous page">←</button><span id="attachment-page"></span><button id="attachment-next" type="button" aria-label="Next page">→</button></footer>
</dialog>`;
export const WORKSPACE_STYLES = `
/* A bounded grid column keeps attachment overflow inside its scrolling row. */
.app-shell {grid-template-columns:minmax(0,1fr);}
.composer-wrap,.composer,.composer-files {min-width:0;}
.attach-button {display:grid;place-items:center;flex:none;width:44px;height:44px;border:0;padding:10px;background:transparent;color:var(--muted);cursor:pointer;border-radius:10px;}
.attach-button svg {width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;transition:transform .18s,color .18s;}
.attach-button:hover svg {color:var(--text);transform:scale(1.12);}
.attach-button:focus-visible {outline:2px solid var(--text);outline-offset:2px;}
.attach-button:disabled {opacity:.45;cursor:wait;}
.composer-files {display:flex;gap:10px;overflow-x:auto;max-width:100%;padding:0 0 12px;scrollbar-width:thin;}
.composer-files[hidden],.composer-upload-notice[hidden] {display:none;}
.composer-file {position:relative;display:flex;flex-direction:column;gap:8px;flex:0 0 158px;min-width:0;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--surface-subtle);color:var(--text);}
.composer-file-open {display:flex;flex-direction:column;gap:8px;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;}
.composer-file-open:disabled {cursor:wait;}
.composer-file-open:focus-visible,.composer-file-remove:focus-visible {outline:2px solid var(--text);outline-offset:3px;}
.composer-file-remove {position:absolute;top:4px;right:4px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:var(--surface-subtle);color:var(--muted);font-size:18px;cursor:pointer;}
.composer-file-remove:hover {color:var(--text);}
.composer-file-remove:disabled {opacity:.4;cursor:wait;}
.composer-file-thumbnail {width:100%;height:80px;object-fit:cover;border-radius:8px;background:var(--surface);}
.attachment-preview {width:min(900px,calc(100vw - 24px));max-height:90dvh;padding:20px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text);}
.attachment-preview::backdrop {background:#11182799;}
.attachment-preview header {display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.attachment-preview h2 {font-size:16px;margin:0 0 6px;overflow-wrap:anywhere;}
.attachment-preview small {color:var(--muted);font-size:12px;}
.attachment-preview button {border:0;background:transparent;color:inherit;cursor:pointer;min-width:40px;min-height:40px;border-radius:8px;font-size:18px;}
.attachment-preview button:disabled {opacity:.4;cursor:default;}
.attachment-preview-body {min-height:100px;max-height:66dvh;overflow:auto;}
.attachment-preview-body img {display:block;max-width:100%;max-height:66dvh;object-fit:contain;margin:auto;}
.attachment-preview-body canvas {display:block;max-width:100%;height:auto;margin:auto;}
.attachment-preview-body pre {white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 system-ui;margin:0;}
.attachment-preview footer {display:flex;align-items:center;justify-content:center;gap:16px;padding-top:10px;}
.attachment-preview footer[hidden] {display:none;}
.composer-file strong {font-size:.78rem;line-height:1.4;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.composer-file small {font-size:.65rem;color:var(--muted);}
.composer-file-type {display:flex;align-items:center;gap:7px;color:var(--muted);font-size:.65rem;font-weight:600;letter-spacing:.04em;}
.composer-file-type svg {width:18px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round;}
.composer-file[data-uploading] {opacity:.7;}
.composer-upload-notice {margin:0 0 10px;font-size:.72rem;color:var(--muted);overflow-wrap:anywhere;}
.composer-upload-notice[data-error] {color:var(--danger);}
@media(max-width:480px){.composer-file{flex-basis:140px;padding:12px;}}
.approval-card {width:calc(100% - 32px);box-sizing:border-box;max-width:720px;margin:12px auto 20px;padding:20px;border:1px solid var(--border);border-radius:18px;background:var(--surface-subtle);color:var(--text);overflow-wrap:anywhere;}
.approval-card header {display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;}
.approval-card header svg {width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;}
.approval-card p {font-size:13px;line-height:1.6;margin:10px 0;}
.approval-card small {display:block;color:var(--muted);font-size:12px;line-height:1.6;}
.approval-card pre {max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font:12px/1.6 monospace;}
.approval-card footer {display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:16px;}
.approval-card button {min-height:40px;padding:9px 16px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--text);font-weight:600;cursor:pointer;}
.approval-card button[data-approve] {background:var(--text);color:var(--surface);border-color:var(--text);}
.approval-card button:disabled {opacity:.5;cursor:default;}
.approval-card button:focus-visible {outline:2px solid var(--text);outline-offset:3px;}
.approval-card[data-settled] {opacity:.85;}
.approval-card .approval-status {color:var(--muted);font-size:12px;}
@media(max-width:480px){.approval-card{padding:16px;border-radius:14px;}}

`;
export const WORKSPACE_APP = `
function createWorkspacePanel() {
  let credentials;
  let creating;
  let generation=0;
  let uploading=false;
  let attachedFiles=[];
  let pendingFiles=[];
  const fileUrls=new Map();
  const fileLoads=new Map();
  const preview=document.querySelector('#attachment-preview');
  const previewBody=document.querySelector('#attachment-preview-body');
  let previewVersion=0;
  let previewDocument;
  let previewLoading;
  let previewRender;
  let previewPage=1;
  let previewFileId;
  let previewOpener;
  const attach=document.querySelector('#composer-attach');
  const fileInput=document.querySelector('#workspace-file');
  const uploadNotice=document.querySelector('#composer-upload-notice');
  const fileCards=document.querySelector('#composer-files');
  const approvalCards=new Map();
  const approvalTimers=new Set();
  async function request(path,options={}) {
    const headers={...(credentials?{Authorization:'Bearer '+credentials.token}:{}),...options.headers};
    const response=await fetch('/v1/workspaces'+path,{...options,headers,signal:AbortSignal.timeout(65000)});
    const payload=response.status===204?{}:await response.json();
    if(!response.ok) throw new Error(typeof payload.message==='string'?payload.message:'The workspace request failed.');
    return payload.data??payload;
  }
  async function ensure() {
    if(credentials) return credentials;
    if(!creating) {
      const current=generation;
      creating=request('',{method:'POST'}).then(value=>{
        if(current!==generation) throw new Error('The chat changed. Please attach the file again.');
        credentials=value; return value;
      }).finally(()=>{creating=undefined;});
    }
    return creating;
  }
  function text(tag,content) {const element=document.createElement(tag);element.textContent=content;return element;}
  function uploadStatus(message,error=false) {
    if(!uploadNotice)return;
    uploadNotice.textContent=message;uploadNotice.hidden=!message;
    uploadNotice.toggleAttribute('data-error',error);
  }
  async function fileBlob(file) {
    const response=await fetch('/v1/workspaces/'+credentials.id+'/files/'+file.id+'/content',{headers:{Authorization:'Bearer '+credentials.token},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Unable to load this file. It may have expired.');
    return response.blob();
  }
  function imageUrl(file) {
    if(fileUrls.has(file.id))return Promise.resolve(fileUrls.get(file.id));
    if(!fileLoads.has(file.id)) {
      const current=generation;
      const loading=fileBlob(file).then(blob=>{
        if(current!==generation||!attachedFiles.some(item=>item.id===file.id))throw new Error('Attachment no longer available.');
        const url=URL.createObjectURL(blob);fileUrls.set(file.id,url);return url;
      }).finally(()=>fileLoads.delete(file.id));
      fileLoads.set(file.id,loading);
    }
    return fileLoads.get(file.id);
  }
  function clearPreview() {
    previewVersion++;previewFileId=undefined;
    previewRender?.cancel();previewRender=undefined;
    if(previewLoading)void previewLoading.destroy().catch(()=>{});
    previewLoading=undefined;
    previewDocument=undefined;previewBody?.replaceChildren();
    document.querySelector('#attachment-preview-pager').hidden=true;
  }
  async function renderPdfPage() {
    const current=previewVersion;
    const documentToRender=previewDocument;
    const previous=document.querySelector('#attachment-previous'),next=document.querySelector('#attachment-next');
    previous.disabled=true;next.disabled=true;
    try {
      const page=await documentToRender.getPage(previewPage);if(current!==previewVersion)return;
      const natural=page.getViewport({scale:1});
      const scale=Math.min(1.5,1600/natural.width,2400/natural.height,Math.max(280,previewBody.clientWidth)/natural.width);
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      previewBody.replaceChildren(canvas);
      previewRender=page.render({canvasContext:canvas.getContext('2d'),canvas,viewport});
      await previewRender.promise;
      if(current!==previewVersion)return;
      document.querySelector('#attachment-page').textContent=previewPage+' / '+documentToRender.numPages;
    } catch(error) {if(current===previewVersion)previewBody.textContent='This page could not be rendered.';}
    finally {if(current===previewVersion){previous.disabled=previewPage<=1;next.disabled=previewPage>=documentToRender.numPages;}}
  }
  async function openPreview(file,button) {
    clearPreview();previewOpener=button;previewFileId=file.id;
    const current=previewVersion;
    document.querySelector('#attachment-preview-title').textContent=file.filename;
    document.querySelector('#attachment-preview-info').textContent=file.kind==='pdf'?'PDF preview':file.kind==='image'?'Image preview':'Text preview';
    previewBody.textContent='Loading preview…';preview.showModal();
    try {
      if(file.kind==='image') {
        const url=await imageUrl(file);if(current!==previewVersion)return;
        const image=document.createElement('img');image.src=url;image.alt=file.filename;previewBody.replaceChildren(image);
      } else if(file.kind==='pdf') {
        const blob=await fileBlob(file);if(current!==previewVersion)return;
        const pdfjs=await import('/playground/pdf.js');if(current!==previewVersion)return;
        pdfjs.GlobalWorkerOptions.workerSrc='/playground/pdf.worker.js';
        const loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,verbosity:0,maxImageSize:12000000});
        previewLoading=loading;
        const doc=await loading.promise;
        if(current!==previewVersion){await loading.destroy();return;}
        previewDocument=doc;previewPage=1;document.querySelector('#attachment-preview-pager').hidden=false;
        await renderPdfPage();
      } else {
        const result=await request('/'+credentials.id+'/files/'+file.id+'/preview');
        if(current!==previewVersion)return;
        previewBody.replaceChildren(text('pre',result.text||'This document has no extractable text.'));
      }
    } catch(error) {if(current===previewVersion)previewBody.textContent=error.message;}
  }
  document.querySelector('#attachment-preview-close').addEventListener('click',()=>preview.close());
  preview.addEventListener('close',()=>{clearPreview();if(previewOpener?.isConnected)previewOpener.focus();else attach.focus();});
  document.querySelector('#attachment-previous').addEventListener('click',()=>{previewPage--;void renderPdfPage();});
  document.querySelector('#attachment-next').addEventListener('click',()=>{previewPage++;void renderPdfPage();});
  async function removeFile(file,button) {
    const current=generation;button.disabled=true;
    try {
      await request('/'+credentials.id+'/files/'+file.id,{method:'DELETE'});
      if(current!==generation)return;
      if(previewFileId===file.id)preview.close();
      if(fileUrls.has(file.id))URL.revokeObjectURL(fileUrls.get(file.id));fileUrls.delete(file.id);
      await refresh();uploadStatus('');document.querySelector('#message').focus();
    } catch(error){if(current===generation){uploadStatus(error.message,true);button.disabled=false;}}
  }
  function renderFiles() {
    if(!fileCards)return;
    fileCards.replaceChildren();
    const entries=[...attachedFiles,...pendingFiles.map(file=>({filename:file.name,bytes:file.size,pending:true}))];
    fileCards.hidden=!entries.length;
    for(const file of entries) {
      const card=text('div','');card.className='composer-file';card.setAttribute('role','listitem');card.title=file.filename;
      const type=text('span','');type.className='composer-file-type';
      // Only this fixed SVG is markup; filenames and provider values stay text nodes.
      type.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H5v20h14V7Z M14 2v6h5 M8 12h8 M8 16h6"/></svg>';
      type.append(text('span',file.filename.split('.').pop().toUpperCase()));
      const open=text('button','');open.type='button';open.className='composer-file-open';open.setAttribute('aria-label','Preview '+file.filename);open.disabled=!!file.pending;
      if(file.kind==='image') {
        const image=document.createElement('img');image.className='composer-file-thumbnail';image.alt='';open.append(image);
        void imageUrl(file).then(url=>{if(image.isConnected)image.src=url;}).catch(()=>{image.remove();});
      }
      open.append(type,text('strong',file.filename));
      if(file.pending)open.append(text('small','Uploading…'));
      open.addEventListener('click',()=>void openPreview(file,open));card.append(open);
      if(!file.pending){const remove=text('button','×');remove.type='button';remove.className='composer-file-remove';remove.setAttribute('aria-label','Remove '+file.filename);remove.title='Remove attachment';remove.addEventListener('click',()=>void removeFile(file,remove));card.append(remove);}
      if(file.pending)card.setAttribute('data-uploading','');
      fileCards.append(card);
    }
  }
  async function refresh() {
    if(!credentials) return;
    const current=generation;
    const data=await request('/'+credentials.id);
    if(current!==generation) return;
    attachedFiles=data.files;renderFiles();
    for(const action of data.approvals) renderApproval(action);
  }
  function renderApproval(action) {
    const existing=approvalCards.get(action.id);
    if(existing){
      if(action.status!=='pending'&&!existing.busy&&!existing.settled)existing.finish(action.status==='consumed'?'Action already submitted.':action.status==='expired'?'Request expired. Ask for a new proposal.':action.status==='denied'?'Denied. Nothing was executed.':'Cancelled.');
      return;
    }
    if(action.status!=='pending')return;
    const current=generation;
    const card=text('article','');card.className='approval-card';card.setAttribute('aria-label','Action approval');
    const heading=text('header','');
    heading.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="M12 8v5m0 3v1"/></svg>';
    heading.append(text('span',action.action.tool==='execute_code'?'Allow code execution?':'Allow file removal?'));
    const target=action.action.tool==='delete_file'?(attachedFiles.find(file=>file.id===action.action.fileId)?.filename??action.target):action.target;
    card.append(heading,text('p',target),text('small','This chat only · One action · Expires '+new Date(action.expiresAt).toLocaleTimeString()),text('p',action.risk));
    card.append(text('pre',action.action.tool==='execute_code'?action.action.code:'Remove '+target));
    const footer=text('footer','');const status=text('p','Waiting for your approval.');status.className='approval-status';status.setAttribute('role','status');
    const state={busy:false,settled:false,finish(message){state.settled=true;card.setAttribute('data-settled','');for(const button of footer.children)button.disabled=true;status.textContent=message;clearTimeout(timer);approvalTimers.delete(timer);}};
    const timer=setTimeout(()=>state.finish('Request expired. Ask for a new proposal.'),Math.max(0,action.expiresAt-Date.now()));approvalTimers.add(timer);
    for(const decision of ['approve','deny']) {
      const button=text('button',decision==='approve'?'Approve once':'Deny');button.type='button';if(decision==='approve')button.setAttribute('data-approve','');
      button.addEventListener('click',async()=>{
        if(state.busy||state.settled||current!==generation)return;
        if(active){status.textContent='Wait for the current response to finish, or stop it first.';return;}
        state.busy=true;for(const sibling of footer.children)sibling.disabled=true;status.textContent=decision==='approve'?'Running approved action…':'Denying…';
        clearTimeout(timer);approvalTimers.delete(timer);
        try {
          const result=await request('/'+credentials.id+'/approvals/'+action.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});
          if(current!==generation)return;
          state.finish(result.status==='executed'?'Action completed.':result.status==='denied'?'Denied. Nothing was executed.':'Action '+result.status+'.');
          if(result.result!==undefined)card.append(text('pre',JSON.stringify(result.result,null,2)));
          await refresh().catch(()=>uploadStatus('Action finished, but attachments could not be refreshed.',true));
        } catch(error){
          // A lost response does not prove the action failed. Never offer an automatic retry.
          if(current===generation)state.finish('Could not confirm the outcome: '+error.message+' Check before requesting this action again.');
        } finally {state.busy=false;}
      });footer.append(button);
    }
    card.append(footer,status);approvalCards.set(action.id,state);
    document.querySelector('#empty-state').hidden=true;
    const messages=document.querySelector('#messages');messages.append(card);messages.scrollTop=messages.scrollHeight;
  }
  attach?.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const files=Array.from(fileInput.files??[]);if(!files.length||uploading)return;
    const current=generation;
    try {
      const mimes=${JSON.stringify(FILE_MIME_TYPES)};
      for(const file of files) {
        const ext=file.name.split('.').pop().toLowerCase();
        if(!Object.hasOwn(mimes,ext))throw new Error(file.name+': choose a JPG, PNG, PDF, DOCX, TXT, Markdown, CSV, or JSON file.');
        if(!file.size||file.size>${FILE_MAX_BYTES})throw new Error(file.name+': choose a non-empty file no larger than 1 MiB.');
      }
      uploading=true;attach.disabled=true;
      await ensure();await refresh();if(current!==generation)return;
      if(attachedFiles.length+files.length>5)throw new Error('You can attach up to five files per chat.');
      if([...attachedFiles,...files].reduce((sum,file)=>sum+(file.bytes??file.size),0)>${WORKSPACE_MAX_BYTES})throw new Error('Attachments must total no more than 2 MiB per chat.');
      pendingFiles=[...files];renderFiles();
      const failures=[];
      // Upload sequentially to respect parser capacity. Keep successful files when another fails.
      for(const [index,file] of files.entries()) {
        if(current!==generation)return;
        uploadStatus('Uploading '+(index+1)+' of '+files.length+': '+file.name+'…');
        const mime=mimes[file.name.split('.').pop().toLowerCase()];
        const form=new FormData();form.append('file',new Blob([file],{type:mime}),file.name);
        try {await request('/'+credentials.id+'/files',{method:'POST',body:form});}
        catch(error){failures.push(file.name+': '+error.message);}
        if(current!==generation)return;
        pendingFiles.shift();await refresh();
      }
      if(current===generation){
        const message=failures.length?failures.join(' '):files.length+' file'+(files.length===1?'':'s')+' attached. Ask about '+(files.length===1?'it':'them')+' in chat.';
        uploadStatus(failures.length?message:'',!!failures.length);
      }
    } catch(error) {
      if(current===generation){uploadStatus(error.message,true);}
    } finally {
      if(current===generation){uploading=false;attach.disabled=false;pendingFiles=[];fileInput.value='';renderFiles();}
    }
  });
  return {isUploading:()=>uploading,credentials:()=>credentials?{workspaceId:credentials.id,workspaceToken:credentials.token}:{},prepare:ensure,refresh:()=>refresh().catch(error=>{uploadStatus(error.message,true);}),
    reset:async()=>{generation++;preview.close();clearPreview();for(const url of fileUrls.values())URL.revokeObjectURL(url);fileUrls.clear();fileLoads.clear();uploading=false;pendingFiles=[];attachedFiles=[];attach.disabled=false;fileInput.value='';renderFiles();uploadStatus('');const previous=credentials;credentials=undefined;for(const timer of approvalTimers)clearTimeout(timer);approvalTimers.clear();approvalCards.clear();
      if(previous) await fetch('/v1/workspaces/'+previous.id,{method:'DELETE',headers:{Authorization:'Bearer '+previous.token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
    }};
}
const workspacePanel=createWorkspacePanel();
`;
