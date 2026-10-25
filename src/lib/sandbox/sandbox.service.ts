import { Injectable, ServiceUnavailableException, ConflictException } from '@nestjs/common';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { sandboxArguments } from '../../config/sandbox/sandbox-policy.js';

@Injectable()
export class SandboxService {
  private active = 0;
  constructor(private readonly config: ConfigService) {}
  async execute(code: string, external: AbortSignal) {
    if (this.config.get('SANDBOX_ENABLED') !== true) throw new ServiceUnavailableException('Sandbox is disabled.');
    if (this.active >= 2) throw new ConflictException('Sandbox capacity reached.');
    external.throwIfAborted();
    this.active++;
    const name = `agentic-sandbox-${randomUUID()}`;
    const signal = AbortSignal.any([external,AbortSignal.timeout(10_000)]);
    let child: ReturnType<typeof spawn> | undefined;
    try {
      return await new Promise<{stdout:string;stderr:string;exitCode:number;truncated:boolean}>((resolve,reject)=>{
        let stdout=''; let stderr=''; let bytes=0; let stopped=false;
        child=spawn('docker',sandboxArguments(name),{stdio:['pipe','pipe','pipe'],shell:false});
        const stop=()=>{stopped=true;child?.kill('SIGKILL');};
        signal.addEventListener('abort',stop,{once:true});
        const collect=(data: Buffer, channel:'stdout'|'stderr')=>{
          bytes+=data.length;
          if(bytes>32_768) { stop(); return; }
          if(channel==='stdout') stdout+=data.toString(); else stderr+=data.toString();
        };
        child.stdout?.on('data',(data:Buffer)=>collect(data,'stdout'));
        child.stderr?.on('data',(data:Buffer)=>collect(data,'stderr'));
        child.stdin?.on('error',()=>{});
        child.once('error',()=>{signal.removeEventListener('abort',stop);reject(new ServiceUnavailableException('Docker sandbox could not start.'));});
        child.once('close',code=>{
          signal.removeEventListener('abort',stop);
          if(signal.aborted) {reject(signal.reason);return;}
          if(stopped) {reject(new Error('SANDBOX_OUTPUT_LIMIT'));return;}
          if(code===125) {reject(new ServiceUnavailableException('Docker sandbox unavailable; ensure the pinned image is installed.'));return;}
          resolve({stdout,stderr,exitCode:code??1,truncated:false});
        });
        if(signal.aborted) stop(); else child.stdin?.end(code);
      });
    } finally {
      // Killing the Docker CLI alone does not kill its container. Always remove it.
      child?.kill('SIGKILL');
      try { await promisify(execFile)('docker',['rm','-f',name],{timeout:5_000,maxBuffer:4096}); }
      catch { /* --rm may already have removed a completed container. */ }
      this.active--;
    }
  }
}
