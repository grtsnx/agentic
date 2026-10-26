// Opt-in: opens a dedicated Chrome window, visits example.com, then closes it.
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { BrowserService } from '../../dist/lib/browser/browser.service.js';
import { MacosService } from '../../dist/lib/macos/macos.service.js';
import { ComputerService } from '../../dist/modules/v1/computer/computer.service.js';
import { WorkspaceStore } from '../../dist/modules/v1/workspaces/workspace-store.service.js';
if(process.env.RUN_COMPUTER_SMOKE!=='true')throw new Error('Set RUN_COMPUTER_SMOKE=true to open a test browser.');
const config=new ConfigService({COMPUTER_ENABLED:true,COMPUTER_ACCESS_TOKEN:'test-only-owner-key-'.repeat(3),COMPUTER_BROWSER_DOMAINS:['example.com'],COMPUTER_ALLOWED_APPS:['com.apple.TextEdit']});
const browser=new BrowserService(config),mac=new MacosService(config),computer=new ComputerService(config,browser,mac),store=new WorkspaceStore();
const created=store.create(),scope=store.authorize(created.id,created.token);
try {
  await assert.rejects(()=>computer.connect(scope,'invalid','browser'));
  console.log('PASS: invalid owner key rejected');
  await computer.connect(scope,config.get('COMPUTER_ACCESS_TOKEN'),'browser');
  const view=await computer.observe(scope.id,null,scope.abort.signal);
  const pending=store.propose(scope,computer.proposal(scope.id,{observationId:view.observationId,kind:'navigate',index:null,value:'https://example.com'}));
  assert.equal(pending.status,'pending');
  const approved=store.consume(scope,pending.id,'approve');
  await computer.execute(scope.id,approved.action,scope.abort.signal);
  assert.throws(()=>store.consume(scope,pending.id,'approve'));
  const result=await computer.observe(scope.id,null,scope.abort.signal);
  assert.match(result.text,/Example Domain/);
  assert.ok(result.image?.startsWith('data:image/jpeg;base64,'));
  console.log('PASS: approved navigation, real page text, screenshot, replay rejected');
  for(const url of ['file:///etc/passwd','http://127.0.0.1:3001','https://unapproved.example.net'])await assert.rejects(()=>browser.allowedUrl(url));
  console.log('PASS: file, loopback and unapproved websites rejected');
  await computer.disconnect(scope.id);
  await assert.rejects(()=>computer.observe(scope.id,null,scope.abort.signal));
  console.log('PASS: Stop closes browser and revokes access');
  if(process.env.RUN_MACOS_READ_SMOKE==='true'){
    const doctor=await mac.doctor(AbortSignal.timeout(15000));
    assert.equal(doctor.ready,true);
    const snapshot=await mac.observe('com.apple.TextEdit',AbortSignal.timeout(15000));
    assert.ok(snapshot.text.length>0);
    console.log('PASS: native TextEdit accessibility read (contents not logged)');
  }
}finally {store.onModuleDestroy();await computer.onModuleDestroy();await mac.close();}
