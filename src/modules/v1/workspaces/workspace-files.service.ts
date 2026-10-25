import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DocumentsService } from '@/lib';
import { randomUUID } from 'node:crypto';
import {
  type WorkspaceScope,
  type UploadedDocument,
  retrievalSchema,
  FILE_MAX_BYTES,
  WORKSPACE_MAX_BYTES,
  FILE_MIME_TYPES,
  type ParsedDocument,
} from '@/config';

@Injectable()
export class WorkspaceFilesService {
  constructor(
    @Optional()
    private readonly documents: DocumentsService = new DocumentsService(),
  ) {}
  async upload(scope: WorkspaceScope, file?: UploadedDocument) {
    scope.abort.signal.throwIfAborted();
    if (!file?.buffer?.length)
      throw new BadRequestException('A non-empty file is required.');
    if (
      file.buffer.length > FILE_MAX_BYTES ||
      scope.files.size >= 5 ||
      [...scope.files.values()].reduce((n, f) => n + f.bytes, 0) +
        file.buffer.length >
        WORKSPACE_MAX_BYTES
    )
      throw new PayloadTooLargeException(
        'Limit: 1 MiB per file, 2 MiB and five files per workspace.',
      );
    const filename = file.originalname;
    if (
      !/^[\p{L}\p{N}_. -]{1,120}$/u.test(filename) ||
      filename.startsWith('.')
    )
      throw new BadRequestException('Invalid filename.');
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime =
      ext && Object.hasOwn(FILE_MIME_TYPES, ext)
        ? FILE_MIME_TYPES[ext]
        : undefined;
    if (
      !mime ||
      (file.mimetype !== mime &&
        !(
          file.mimetype === 'text/plain' &&
          ['txt', 'md', 'csv', 'json'].includes(ext!)
        ))
    )
      throw new BadRequestException(
        'Unsupported file type or mismatched MIME type.',
      );
    let parsed: ParsedDocument;
    if (['pdf', 'docx', 'jpg', 'jpeg', 'png'].includes(ext!)) {
      parsed = await this.documents.parse(
        ext!,
        file.buffer,
        scope.abort.signal,
      );
    } else {
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
        // Reject binary control bytes while allowing tabs and line endings.
        // eslint-disable-next-line no-control-regex
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || !text.trim())
          throw new Error();
        if (ext === 'json') JSON.parse(text);
      } catch {
        throw new BadRequestException(
          'File must contain valid UTF-8 text; JSON must parse.',
        );
      }
      parsed = { text, kind: 'text' };
    }
    // Parsing yields: recheck expiry and quotas before the synchronous commit.
    scope.abort.signal.throwIfAborted();
    if (scope.expiresAt <= Date.now())
      throw new BadRequestException('Workspace expired.');
    if (
      scope.files.size >= 5 ||
      [...scope.files.values()].reduce((n, f) => n + f.bytes, 0) +
        file.buffer.length >
        WORKSPACE_MAX_BYTES
    )
      throw new PayloadTooLargeException('Workspace file limit reached.');
    const text = parsed.text;
    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += 1300)
      chunks.push(text.slice(offset, offset + 1500));
    const record = {
      id: randomUUID(),
      filename,
      mime,
      content: parsed.content
        ? Buffer.from(parsed.content)
        : Buffer.from(file.buffer),
      text,
      kind: parsed.kind,
      pages: parsed.pages,
      bytes: file.buffer.length,
      chunks,
    };
    scope.files.set(record.id, record);
    return {
      id: record.id,
      filename,
      mime: record.mime,
      bytes: record.bytes,
      chunks: chunks.length,
      kind: record.kind,
      pages: record.pages,
    };
  }
  list(scope: WorkspaceScope) {
    return [...scope.files.values()].map((file) => ({
      id: file.id,
      filename: file.filename,
      mime: file.mime,
      bytes: file.bytes,
      chunks: file.chunks.length,
      kind: file.kind,
      pages: file.pages,
    }));
  }
  get(scope: WorkspaceScope, fileId: string) {
    scope.abort.signal.throwIfAborted();
    const file = scope.files.get(fileId);
    if (!file) throw new NotFoundException('File not found in this workspace.');
    return file;
  }
  preview(scope: WorkspaceScope, fileId: string) {
    const file = this.get(scope, fileId);
    return {
      filename: file.filename,
      mime: file.mime,
      kind: file.kind,
      pages: file.pages,
      text: file.text,
    };
  }
  search(scope: WorkspaceScope, query: string, fileIds: string[]) {
    scope.abort.signal.throwIfAborted();
    const input = retrievalSchema.parse({ query, fileIds });
    const files = input.fileIds.length
      ? input.fileIds.map((id) => {
          const file = scope.files.get(id);
          if (!file)
            throw new NotFoundException('File not found in this workspace.');
          return file;
        })
      : [...scope.files.values()];
    const words = [
      ...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []),
    ].slice(0, 50);
    return files
      .flatMap((file) =>
        file.chunks.map((text, index) => ({
          fileId: file.id,
          filename: file.filename,
          chunk: index + 1,
          text,
          score: words.reduce(
            (n, word) =>
              n +
              ((file.filename + ' ' + text).toLowerCase().includes(word)
                ? 1
                : 0),
            0,
          ),
          contentTrust: 'untrusted' as const,
        })),
      )
      .filter((x) => query === '*' || x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  delete(scope: WorkspaceScope, fileId: string) {
    scope.abort.signal.throwIfAborted();
    if (!scope.files.delete(fileId))
      throw new NotFoundException('File not found in this workspace.');
    return { deleted: true, fileId };
  }
}
