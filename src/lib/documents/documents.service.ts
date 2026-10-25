import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ParsedDocument } from '@/config';
// A leaf import keeps standalone parsing independent of application bootstrap.
import { DOCUMENT_PARSER_WORKER } from '../../config/files/document-parser.worker.js';
const require = createRequire(import.meta.url);

@Injectable()
export class DocumentsService {
  private active = 0;
  async parse(
    kind: string,
    buffer: Buffer,
    signal: AbortSignal,
  ): Promise<ParsedDocument> {
    signal.throwIfAborted();
    if (this.active >= 2)
      throw new ServiceUnavailableException(
        'File processing is busy. Try again shortly.',
      );
    this.active++;
    let worker: Worker | undefined;
    try {
      const paths = Object.fromEntries(
        Object.entries({
          pdf: 'pdfjs-dist/legacy/build/pdf.mjs',
          zip: 'fflate',
          xml: 'fast-xml-parser',
          sharp: 'sharp',
        }).map(([key, name]) => [
          key,
          pathToFileURL(require.resolve(name)).href,
        ]),
      );
      worker = new Worker(DOCUMENT_PARSER_WORKER, {
        eval: true,
        workerData: { kind, buffer, paths },
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 16,
        },
      });
      const running = worker;
      return await new Promise<ParsedDocument>((resolve, reject) => {
        const abort = () =>
          reject(new BadRequestException('File processing was cancelled.'));
        const timer = setTimeout(
          () => reject(new BadRequestException('File processing timed out.')),
          10_000,
        );
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
        };
        running.once(
          'message',
          (result: ParsedDocument & { error?: boolean }) => {
            cleanup();
            if (result.error)
              reject(
                new BadRequestException(
                  'File is invalid, encrypted, or exceeds document limits.',
                ),
              );
            else resolve(result);
          },
        );
        running.once('error', () => {
          cleanup();
          reject(new BadRequestException('File could not be processed.'));
        });
        running.once('exit', () => {
          cleanup();
          reject(new BadRequestException('File processing stopped.'));
        });
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    } finally {
      if (worker) await worker.terminate();
      this.active--;
    }
  }
}

export function getPdfPreviewScript(worker = false): string {
  return readFileSync(
    require.resolve(
      worker ? 'pdfjs-dist/build/pdf.worker.mjs' : 'pdfjs-dist/build/pdf.mjs',
    ),
    'utf8',
  );
}
