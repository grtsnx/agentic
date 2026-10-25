import { FILE_ACCEPT, FILE_MIME_TYPES } from '../agent/tools/file-policy.js';
export const WORKSPACE_VIEW = `
<button id="workspace-open" class="quiet-button" type="button" aria-haspopup="dialog">Files &amp; actions</button>`;
export const WORKSPACE_ATTACHMENTS = `
<input id="workspace-file" type="file" accept="${FILE_ACCEPT}" hidden />
<div id="composer-files" class="composer-files" role="list" aria-label="Attached files" hidden></div>
<p id="composer-upload-notice" class="composer-upload-notice" role="status" hidden></p>`;
export const WORKSPACE_ATTACH_BUTTON = `
<button id="composer-attach" class="attach-button" type="button" aria-label="Attach file" title="Attach file (JPG, PNG, PDF, DOCX, TXT, Markdown, CSV, JSON)">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
</button>`;
export const WORKSPACE_SHEET = `
<dialog id="workspace-sheet" class="workspace-sheet" aria-labelledby="workspace-title">
  <header><h2 id="workspace-title">Files &amp; actions</h2><button id="workspace-close" type="button" aria-label="Close files and actions">✕</button></header>
  <p>Files are private to this chat and expire after 30 minutes.</p>
  <button id="workspace-choose" class="workspace-upload" type="button">Attach a file</button>
  <small>JPG, PNG, PDF, DOCX, TXT, Markdown, CSV, JSON. Up to 1 MiB each.</small>
  <p id="workspace-notice" role="status"></p>
  <section aria-label="Attached files" id="workspace-files"></section>
  <h3>Review actions</h3><p>Review the exact action before allowing it.</p>
  <section id="workspace-approvals" aria-live="polite"></section>
</dialog>
<dialog id="attachment-preview" class="attachment-preview" aria-labelledby="attachment-preview-title">
  <header><div><h2 id="attachment-preview-title">File preview</h2><small id="attachment-preview-info"></small></div><button id="attachment-preview-close" type="button" aria-label="Close preview">✕</button></header>
  <div id="attachment-preview-body" class="attachment-preview-body" role="status"></div>
  <footer id="attachment-preview-pager" hidden><button id="attachment-previous" type="button" aria-label="Previous page">←</button><span id="attachment-page"></span><button id="attachment-next" type="button" aria-label="Next page">→</button></footer>
</dialog>`;
export const WORKSPACE_STYLES = `
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
.workspace-sheet { position:fixed; inset:0 0 0 auto; margin:0; width:min(480px,100vw); height:100dvh; max-height:100dvh; box-sizing:border-box; border:0; padding:24px; background:#fff; color:#20232b; overflow:auto; }
.workspace-sheet::backdrop {background:#14182466;}
.workspace-sheet header {display:flex;align-items:center;justify-content:space-between;gap:12px;}
.workspace-sheet h2 {font-size:20px;} .workspace-sheet p,.workspace-sheet small {color:#697080;line-height:1.5;}
.workspace-sheet button {border:1px solid #dce0e8;border-radius:8px;padding:8px 12px;background:transparent;color:inherit;cursor:pointer;}
.workspace-sheet button:disabled {opacity:.5;cursor:wait;}
.workspace-upload {display:grid;gap:10px;margin-bottom:8px;} .workspace-upload input {max-width:100%;}
.workspace-action {border:1px solid #dce0e8;border-radius:12px;padding:14px;margin:12px 0;overflow-wrap:anywhere;}
.workspace-action pre {white-space:pre-wrap;max-height:240px;overflow:auto;font-size:12px;}
.workspace-action footer {display:flex;flex-wrap:wrap;gap:8px;}
html[data-theme='dark'] .workspace-sheet {background:#101010;color:#eee;}
html[data-theme='dark'] .workspace-sheet p,html[data-theme='dark'] .workspace-sheet small {color:#aaa;}
html[data-theme='dark'] .workspace-action,html[data-theme='dark'] .workspace-sheet button {border-color:#333;}
@media(max-width:480px){#workspace-open{font-size:12px;padding:8px;} .workspace-sheet{padding:18px;}}
`;
export const WORKSPACE_APP = `
function createWorkspacePanel() {
  let credentials;
  let creating;
  let generation=0;
  let uploading=false;
  let attachedFiles=[];
  let pendingFile;
  const fileUrls=new Map();
  const fileLoads=new Map();
  const preview=document.querySelector('#attachment-preview');
  const previewBody=document.querySelector('#attachment-preview-body');
  let previewVersion=0;
  let previewDocument;
  let previewRender;
  let previewPage=1;
  let previewFileId;
  let previewOpener;
  const attach=document.querySelector('#composer-attach');
  const fileInput=document.querySelector('#workspace-file');
  const uploadNotice=document.querySelector('#composer-upload-notice');
  const fileCards=document.querySelector('#composer-files');
  const sheet=document.querySelector('#workspace-sheet');
  const opener=document.querySelector('#workspace-open');
  const notice=document.querySelector('#workspace-notice');
  if(!sheet || !opener) return {isUploading:()=>false,credentials:()=>({}),refresh:async()=>{},reset:async()=>{}};
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
  function safe(task) {return async()=>{try{notice.textContent='';await task();}catch(error){notice.textContent=error.message;}};}
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
    if(previewDocument)void previewDocument.destroy().catch(()=>{});
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
        const doc=await loading.promise;
        if(current!==previewVersion){await doc.destroy();return;}
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
    const entries=[...attachedFiles,...(pendingFile?[{filename:pendingFile.name,bytes:pendingFile.size,pending:true}]:[])];
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
      } else open.append(type);
      open.append(text('strong',file.filename),text('small',file.pending?'Uploading…':Math.max(1,Math.ceil(file.bytes/1024))+' KB · Attached'));
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
    const files=document.querySelector('#workspace-files');files.replaceChildren();
    for(const file of data.files) {
      const row=text('p',file.filename+' · '+Math.ceil(file.bytes/1024)+' KB');
      files.append(row);
    }
    const actions=document.querySelector('#workspace-approvals');actions.replaceChildren();
    const pending=data.approvals.filter(action=>action.status==='pending');
    opener.textContent=pending.length?'Review actions ('+pending.length+')':'Files & actions';
    for(const action of pending) {
      const card=document.createElement('article');card.className='workspace-action';
      card.append(text('strong',action.target),text('p',action.risk),text('small','Scope: this chat · '+action.tier+' · Expires '+new Date(action.expiresAt).toLocaleTimeString()),text('pre',JSON.stringify(action.action,null,2)));
      const buttons=document.createElement('footer');
      for(const decision of ['approve','deny','cancel']) {
        const button=text('button',decision==='approve'?'Approve once':decision==='deny'?'Deny':'Cancel');button.type='button';
        button.addEventListener('click',safe(async()=>{
          for(const sibling of buttons.children) sibling.disabled=true;
          try {
            const result=await request('/'+credentials.id+'/approvals/'+action.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});
            notice.textContent=result.status==='executed'?'Action finished. You can ask about the result.':'Action '+result.status+'.';
            if(result.result) notice.append(text('pre',JSON.stringify(result.result,null,2)));
          } finally {await refresh();}
        }));buttons.append(button);
      }
      card.append(buttons);actions.append(card);
    }
    if(!pending.length) actions.append(text('p','No actions waiting for approval.'));
  }
  opener.addEventListener('click',safe(async()=>{sheet.showModal();await ensure();await refresh();}));
  document.querySelector('#workspace-close').addEventListener('click',()=>sheet.close());
  sheet.addEventListener('close',()=>opener.focus());
  attach?.addEventListener('click',()=>fileInput.click());
  document.querySelector('#workspace-choose').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file||uploading)return;
    const current=generation;
    try {
      const ext=file.name.split('.').pop().toLowerCase();const mime=${JSON.stringify(FILE_MIME_TYPES)}[ext];
      if(!mime)throw new Error('Choose a JPG, PNG, PDF, DOCX, TXT, Markdown, CSV, or JSON file.');
      if(file.size>1048576)throw new Error('Choose a file no larger than 1 MiB.');
      uploading=true;attach.disabled=true;pendingFile=file;renderFiles();uploadStatus('Uploading '+file.name+'…');
      await ensure();if(current!==generation)return;
      const form=new FormData();form.append('file',new Blob([file],{type:mime}),file.name);
      await request('/'+credentials.id+'/files',{method:'POST',body:form});
      if(current!==generation)return;
      pendingFile=undefined;await refresh();
      if(current===generation){uploadStatus('');notice.textContent='File attached. Ask about it in chat.';}
    } catch(error) {
      if(current===generation){uploadStatus(error.message,true);notice.textContent=error.message;}
    } finally {
      if(current===generation){uploading=false;attach.disabled=false;pendingFile=undefined;fileInput.value='';renderFiles();}
    }
  });
  return {isUploading:()=>uploading,credentials:()=>credentials?{workspaceId:credentials.id,workspaceToken:credentials.token}:{},refresh:()=>refresh().catch(error=>{notice.textContent=error.message;}),
    reset:async()=>{generation++;preview.close();clearPreview();for(const url of fileUrls.values())URL.revokeObjectURL(url);fileUrls.clear();fileLoads.clear();uploading=false;pendingFile=undefined;attachedFiles=[];attach.disabled=false;fileInput.value='';renderFiles();uploadStatus('');const previous=credentials;credentials=undefined;opener.textContent='Files & actions';sheet.close();
      if(previous) await fetch('/v1/workspaces/'+previous.id,{method:'DELETE',headers:{Authorization:'Bearer '+previous.token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
    }};
}
const workspacePanel=createWorkspacePanel();
`;
