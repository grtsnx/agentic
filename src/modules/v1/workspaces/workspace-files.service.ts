import { Injectable, BadRequestException, PayloadTooLargeException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type WorkspaceScope, type UploadedDocument, retrievalSchema } from '@/config';

@Injectable()
export class WorkspaceFilesService {
  upload(scope: WorkspaceScope, file?: UploadedDocument) {
    scope.abort.signal.throwIfAborted();
    if (!file?.buffer?.length) throw new BadRequestException('A non-empty file is required.');
    if (file.buffer.length > 1_048_576 || scope.files.size >= 5 ||
      [...scope.files.values()].reduce((n,f) => n + f.bytes, 0) + file.buffer.length > 2_097_152)
      throw new PayloadTooLargeException('Limit: 1 MiB per file, 2 MiB and five files per workspace.');
    const filename = file.originalname;
    if (!/^[\p{L}\p{N}_. -]{1,120}$/u.test(filename) || filename.startsWith('.')) throw new BadRequestException('Invalid filename.');
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimes: Record<string, string[]> = {txt:['text/plain'],md:['text/markdown','text/plain'],csv:['text/csv','text/plain'],json:['application/json','text/plain']};
    if (!ext || !mimes[ext]?.includes(file.mimetype)) throw new BadRequestException('Supported files: UTF-8 TXT, Markdown, CSV, and JSON with matching MIME types.');
    let text: string;
    try {
      text = new TextDecoder('utf-8', {fatal:true}).decode(file.buffer);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || !text.trim()) throw new Error();
      if (ext === 'json') JSON.parse(text);
    } catch { throw new BadRequestException('File must contain valid, non-empty UTF-8 text; JSON must parse.'); }
    const chunks: string[] = [];
    for (let offset=0; offset<text.length; offset+=1300) chunks.push(text.slice(offset,offset+1500));
    const record = {id:randomUUID(),filename,mime:file.mimetype,bytes:file.buffer.length,chunks};
    scope.files.set(record.id,record);
    return {id:record.id,filename,mime:record.mime,bytes:record.bytes,chunks:chunks.length};
  }
  list(scope: WorkspaceScope) { return [...scope.files.values()].map(({chunks,...file})=>({...file,chunks:chunks.length})); }
  search(scope: WorkspaceScope, query: string, fileIds: string[]) {
    scope.abort.signal.throwIfAborted();
    const input = retrievalSchema.parse({query,fileIds});
    const files = input.fileIds.length ? input.fileIds.map(id => {
      const file=scope.files.get(id); if (!file) throw new NotFoundException('File not found in this workspace.'); return file;
    }) : [...scope.files.values()];
    const words = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0,50);
    return files.flatMap(file => file.chunks.map((text,index)=>({fileId:file.id,filename:file.filename,chunk:index+1,text,
      score:words.reduce((n,word)=>n+(text.toLowerCase().includes(word)?1:0),0),contentTrust:'untrusted' as const})))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  }
  delete(scope: WorkspaceScope, fileId: string) {
    scope.abort.signal.throwIfAborted();
    if (!scope.files.delete(fileId)) throw new NotFoundException('File not found in this workspace.');
    return {deleted:true,fileId};
  }
}
