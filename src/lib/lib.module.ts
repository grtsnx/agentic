import { Module } from '@nestjs/common';
import { LiveKitModule } from './livekit/livekit.module.js';
import { OpenaiModule } from './openai/openai.module.js';

@Module({
  imports: [LiveKitModule, OpenaiModule],
  exports: [LiveKitModule, OpenaiModule],
})
export class LibModule {}
