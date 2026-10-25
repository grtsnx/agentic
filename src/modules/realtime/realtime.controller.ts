import {
  Controller,
  Get,
  Header,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  REALTIME_APP,
  REALTIME_PAGE,
  REALTIME_STYLES,
} from './realtime.assets.js';

@ApiExcludeController()
@SkipThrottle()
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  page(): StreamableFile {
    return this.file(REALTIME_PAGE, 'text/html; charset=utf-8');
  }

  @Get('app.js')
  @Header('Cache-Control', 'no-store')
  script(): StreamableFile {
    return this.file(REALTIME_APP, 'text/javascript; charset=utf-8');
  }

  @Get('styles.css')
  @Header('Cache-Control', 'no-store')
  styles(): StreamableFile {
    return this.file(REALTIME_STYLES, 'text/css; charset=utf-8');
  }

  private file(content: string, type: string): StreamableFile {
    if (!this.config.getOrThrow<boolean>('REALTIME_PLAYGROUND_ENABLED')) {
      throw new NotFoundException();
    }

    return new StreamableFile(Buffer.from(content), { type });
  }
}
