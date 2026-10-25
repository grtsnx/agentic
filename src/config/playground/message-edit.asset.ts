export const MESSAGE_EDIT_STYLES = `
.message-edit-button{border:0;background:none;color:var(--muted);cursor:pointer;padding:10px;min-height:44px;align-self:flex-end;}
.message-edit-button svg{width:17px;height:17px;transition:color .15s,transform .15s;}
.message-edit-button:hover svg{color:var(--text);transform:scale(1.1);}
.user .message-content[hidden]{display:none;}
.message-editor{width:100%;margin-top:8px;}
.message-editor textarea{box-sizing:border-box;width:100%;min-height:54px;max-height:45vh;resize:vertical;border:1px solid var(--border);border-radius:20px;padding:15px 18px;background:var(--surface);color:var(--text);font:inherit;line-height:1.5;}
.message-editor textarea:focus{outline:2px solid var(--text);outline-offset:2px;}
.message-editor p{font-size:12px;color:var(--muted);line-height:1.5;margin:10px 0;}
.message-editor footer{display:flex;justify-content:flex-end;gap:10px;}
.message-editor button{min-height:44px;border:0;border-radius:24px;padding:10px 20px;cursor:pointer;background:transparent;color:var(--text);font:inherit;}
.message-editor button[type='submit']{background:var(--text);color:var(--surface);}
.message-editor button:disabled{opacity:.4;cursor:default;}
@media(max-width:600px){.user .message-body:has(.message-editor){width:100%;}}
`;

export const MESSAGE_EDIT_APP = String.raw`
  const messageElements = new Map();
  let pendingUserMessage;
  let closeMessageEditor;

  function bindUserMessage(message, item) {
    messageElements.set(item.id, message.article);
    const edit = document.createElement('button');
    edit.type='button';edit.className='message-edit-button';
    edit.setAttribute('aria-label','Edit message');edit.title='Edit message';
    edit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg>';
    message.body.append(edit);
    edit.addEventListener('click',()=>{
      if(active||chatTransport.busy)return;
      closeMessageEditor?.();
      const original=item.content.map(part=>part.text).join('\n');
      const form=document.createElement('form');form.className='message-editor';
      const textarea=document.createElement('textarea');textarea.value=original;textarea.maxLength=8000;textarea.rows=1;
      textarea.setAttribute('aria-label','Edit your message');
      const hint=document.createElement('p');hint.textContent='Updating replaces later replies. Completed actions are not undone.';
      const buttons=document.createElement('footer');
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
      const update=document.createElement('button');update.type='submit';update.textContent='Update';update.disabled=true;
      buttons.append(cancel,update);form.append(textarea,hint,buttons);message.body.append(form);
      message.content.hidden=true;edit.hidden=true;
      const close=()=>{form.remove();message.content.hidden=false;edit.hidden=false;closeMessageEditor=undefined;edit.focus();};
      closeMessageEditor=close;
      cancel.addEventListener('click',()=>{if(!active)close();});
      textarea.addEventListener('input',()=>{update.disabled=!textarea.value.trim()||textarea.value.trim()===original.trim()||active;});
      textarea.addEventListener('keydown',event=>{if(event.key==='Escape'&&!active){event.preventDefault();close();}});
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        const text=textarea.value.trim();
        if(active||chatTransport.busy||!chatTransport.connected||!text||text===original.trim())return;
        update.disabled=true;cancel.disabled=true;textarea.disabled=true;
        try{await chatTransport.edit(item.id,text);}
        catch(error){hint.textContent=error.message;}
        finally{update.disabled=false;cancel.disabled=false;textarea.disabled=false;}
      });
      textarea.focus();
    });
  }

  chatTransport.on('chat.user',item=>{
    let message=pendingUserMessage;
    pendingUserMessage=undefined;
    if(!message){
      message=createMessage('user',item.content.map(part=>part.text).join('\n'));
      workspacePanel.renderSent(message.body,message.content,item.attachments.map(file=>file.id));
      if(assistantMessage)elements.messages.insertBefore(message.article,assistantMessage.article);
    }
    bindUserMessage(message,item);
  });
  chatTransport.on('chat.removed',({itemId})=>{
    closeMessageEditor?.();
    messageElements.get(itemId)?.remove();messageElements.delete(itemId);
    chatkitWidgets.get(itemId)?.remove();chatkitWidgets.delete(itemId);
    closeSources();
  });
`;
