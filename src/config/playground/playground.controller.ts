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
import { getLiveKitClientScript } from '@/lib';
import {
  PLAYGROUND_APP,
  PLAYGROUND_PAGE,
  PLAYGROUND_STYLES,
} from './playground.assets.js';
import { ORB_ENGINE_SCRIPT, ORB_ENGINE_CORE } from './orb-engine.asset.js';
import { LIVEKIT_BROWSER_APP } from './voice-playground.asset.js';

@ApiExcludeController()
@SkipThrottle()
@Controller('playground')
export class PlaygroundController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  page(): StreamableFile {
    return this.file(PLAYGROUND_PAGE, 'text/html; charset=utf-8');
  }

  @Get('app.js')
  @Header('Cache-Control', 'no-store')
  script(): StreamableFile {
    return this.file(PLAYGROUND_APP, 'text/javascript; charset=utf-8');
  }

  @Get('livekit-client.js')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  livekitClient(): StreamableFile {
    return this.file(
      getLiveKitClientScript(),
      'text/javascript; charset=utf-8',
    );
  }

  @Get('livekit-app.js')
  @Header('Cache-Control', 'no-store')
  livekitApp(): StreamableFile {
    return this.file(LIVEKIT_BROWSER_APP, 'text/javascript; charset=utf-8');
  }

  @Get('orb-engine.js')
  @Header('Cache-Control', 'no-cache')
  orbEngine(): StreamableFile {
    return this.file(ORB_ENGINE_SCRIPT, 'text/javascript; charset=utf-8');
  }

  @Get('orb-core.js')
  @Header('Cache-Control', 'no-cache')
  orbCore(): StreamableFile {
    return this.file(ORB_ENGINE_CORE, 'text/javascript; charset=utf-8');
  }

  @Get('styles.css')
  @Header('Cache-Control', 'no-store')
  styles(): StreamableFile {
    return this.file(PLAYGROUND_STYLES, 'text/css; charset=utf-8');
  }

  private file(content: string, type: string): StreamableFile {
    if (!this.config.getOrThrow<boolean>('REALTIME_PLAYGROUND_ENABLED')) {
      throw new NotFoundException();
    }

    return new StreamableFile(Buffer.from(content), { type });
  }
}
