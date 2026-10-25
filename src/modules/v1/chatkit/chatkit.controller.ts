import {
  Body,
  Controller,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
