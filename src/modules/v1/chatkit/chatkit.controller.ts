import {
  Body,
  Controller,
  Header,
  Get,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FILE_MAX_BYTES, type UploadedDocument } from '@/config';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { ChatkitService } from './chatkit.service.js';

@ApiTags('ChatKit')
@ApiBearerAuth()
@Controller({ path: 'chatkit', version: '1' })
export class ChatkitController {
  constructor(
    private readonly service: ChatkitService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Upload a validated draft attachment for ChatKit' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post(':id/files')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: FILE_MAX_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  async upload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
    @UploadedFile() file: UploadedDocument,
  ) {
    this.requireEnabled();
    const owner = this.service.authorize(id, request.headers.authorization);
    const attachment = await this.service.upload(owner, file);
    return new StreamableFile(Buffer.from(JSON.stringify(attachment)), {
      type: 'application/json',
    });
  }

  @ApiOperation({
    summary: 'Preview an owned ChatKit file without exposing a public URL',
  })
  @Get(':id/files/:fileId')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  content(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Req() request: Request,
  ) {
    this.requireEnabled();
    const file = this.service.file(
      this.service.authorize(id, request.headers.authorization),
      fileId,
    );
    // DOCX is rendered as extracted text; never execute or embed document HTML.
    return new StreamableFile(
      file.kind === 'text' ? Buffer.from(file.text) : file.content,
      {
        type: file.kind === 'text' ? 'text/plain; charset=utf-8' : file.mime,
        disposition: 'attachment',
      },
    );
  }

  private requireEnabled() {
    if (!this.config.getOrThrow<boolean>('REALTIME_PLAYGROUND_ENABLED'))
      throw new NotFoundException();
  }

  @Post(':id')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('X-Accel-Buffering', 'no')
  @ApiOperation({
    summary:
      'ChatKit protocol endpoint with workspace capability authentication',
  })
  process(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    if (!this.config.getOrThrow<boolean>('REALTIME_PLAYGROUND_ENABLED'))
      throw new NotFoundException();
    const owner = this.service.authorize(id, request.headers.authorization);
    const abort = new AbortController();
    const result = this.service.process(body, owner, abort.signal);
    if (!result.stream)
      return new StreamableFile(Buffer.from(JSON.stringify(result.json)), {
        type: 'application/json',
      });
    const events = result.stream;
    const stream = Readable.from(
      (async function* () {
        for await (const event of events)
          yield `data: ${JSON.stringify(event)}\n\n`;
      })(),
      { objectMode: false, highWaterMark: 16384 },
    );
    const close = () => {
      if (!response.writableFinished) {
        abort.abort();
        stream.destroy();
      }
    };
    response.once('close', close);
    stream.once('close', () => response.off('close', close));
    // StreamableFile preserves the protocol payload instead of the normal REST envelope.
    return new StreamableFile(stream, { type: 'text/event-stream' });
  }
}
