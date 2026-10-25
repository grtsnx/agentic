import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContextDevModule } from '@/lib/context-dev/context-dev.module.js';
import { FirecrawlModule } from '@/lib/firecrawl/firecrawl.module.js';
import { ValyuModule } from '@/lib/valyu/valyu.module.js';
import { WebToolsService } from './web-tools.service.js';

@Module({
  imports: [ConfigModule, ContextDevModule, FirecrawlModule, ValyuModule],
  providers: [WebToolsService],
  exports: [WebToolsService],
})
export class WebToolsModule {}
