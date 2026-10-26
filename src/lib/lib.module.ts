import { McpModule } from './mcp/mcp.module.js';
import { BrowserModule } from './browser/browser.module.js';
import { MacosModule } from './macos/macos.module.js';
import { ClefModule } from './clef/clef.module.js';
import { ChatkitAdapterModule } from './chatkit/chatkit.module.js';
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
    McpModule,
    BrowserModule,
    MacosModule,
    ChatkitAdapterModule,
    ClefModule,
    DocumentsModule,
    SandboxModule,
    LiveKitModule,
    OpenaiModule,
    ContextDevModule,
    FirecrawlModule,
    ValyuModule,
  ],
  exports: [
    McpModule,
    BrowserModule,
    MacosModule,
    ChatkitAdapterModule,
    ClefModule,
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
