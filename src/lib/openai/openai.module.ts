import { Global, Module } from '@nestjs/common';
import { OpenaiService } from './openai.service.js';
import { WebToolsModule } from '@/config/web-tools';

@Global()
@Module({
  imports: [WebToolsModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
