import { DocumentsModule } from './documents/documents.module.js';
import { SandboxModule } from './sandbox/sandbox.module.js';
import { Module } from '@nestjs/common';
import { LiveKitModule } from './livekit/livekit.module.js';
import { OpenaiModule } from './openai/openai.module.js';
import { ContextDevModule } from './context-dev/context-dev.module.js';
import { FirecrawlModule } from './firecrawl/firecrawl.module.js';
import { ValyuModule } from './valyu/valyu.module.js';

@Module({
  imports: [
    DocumentsModule,
    SandboxModule,
    LiveKitModule,
    OpenaiModule,
    ContextDevModule,
    FirecrawlModule,
    ValyuModule,
  ],
  exports: [
    DocumentsModule,
    SandboxModule,
    LiveKitModule,
    OpenaiModule,
    ContextDevModule,
    FirecrawlModule,
    ValyuModule,
  ],
})
export class LibModule {}
