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
import { getLiveKitClientScript, getPdfPreviewScript } from '@/lib';
import {
  PLAYGROUND_APP,
  PLAYGROUND_PAGE,
  PLAYGROUND_STYLES,
} from './playground.assets.js';
import { ORB_ENGINE_SCRIPT, ORB_ENGINE_CORE } from './orb-engine.asset.js';
import { LIVEKIT_BROWSER_APP } from './voice-playground.asset.js';
import {
  CHATKIT_PAGE,
  CHATKIT_STYLES,
  chatkitScript,
} from './chatkit.asset.js';

@ApiExcludeController()
@SkipThrottle()
@Controller('playground')
export class PlaygroundController {
  constructor(private readonly config: ConfigService) {}

  @Get('chatkit')
  @Header('Cache-Control', 'no-store')
  @Header(
    'Content-Security-Policy',
    // The official component injects its shadow-root styles. Only this page permits inline CSS.
    "default-src 'self'; script-src 'self' https://cdn.platform.openai.com; frame-src https://cdn.platform.openai.com; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
  )
  chatkit(): StreamableFile {
    return this.file(CHATKIT_PAGE, 'text/html; charset=utf-8');
  }

  @Get('chatkit.js')
  @Header('Cache-Control', 'no-store')
  chatkitApp(): StreamableFile {
    const domainKey =
      this.config.get<string>('CHATKIT_DOMAIN_KEY') ||
      (this.config.get<string>('NODE_ENV') === 'production'
        ? ''
        : 'domain_pk_localhost_dev');
    return this.file(
      chatkitScript(domainKey),
      'text/javascript; charset=utf-8',
    );
  }

  @Get('chatkit.css')
  @Header('Cache-Control', 'no-store')
  chatkitStyles(): StreamableFile {
    return this.file(CHATKIT_STYLES, 'text/css; charset=utf-8');
  }

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

  @Get('pdf.js')
  @Header('Cache-Control', 'no-cache')
  pdfScript(): StreamableFile {
    return this.file(getPdfPreviewScript(), 'text/javascript; charset=utf-8');
  }

  @Get('pdf.worker.js')
  @Header('Cache-Control', 'no-cache')
  pdfWorker(): StreamableFile {
    return this.file(
      getPdfPreviewScript(true),
      'text/javascript; charset=utf-8',
    );
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
