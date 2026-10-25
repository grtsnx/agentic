import { Module } from '@nestjs/common';
import { LiveKitModule } from './livekit/livekit.module.js';
import { OpenaiModule } from './openai/openai.module.js';
import { ContextDevModule } from './context-dev/context-dev.module.js';
import { FirecrawlModule } from './firecrawl/firecrawl.module.js';
import { ValyuModule } from './valyu/valyu.module.js';

@Module({
  imports: [
    LiveKitModule,
    OpenaiModule,
    ContextDevModule,
    FirecrawlModule,
    ValyuModule,
  ],
  exports: [
    LiveKitModule,
    OpenaiModule,
    ContextDevModule,
    FirecrawlModule,
    ValyuModule,
  ],
})
export class LibModule {}
