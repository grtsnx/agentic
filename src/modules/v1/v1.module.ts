import { Module } from '@nestjs/common';
import { ChatV1Module } from './chat/chat.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [ChatV1Module, VoiceModule],
  exports: [ChatV1Module, VoiceModule],
})
export class V1Module {}
