import { Module } from '@nestjs/common';
import { ChatV2Module } from './chat/chat.module.js';

@Module({
  imports: [ChatV2Module],
  exports: [ChatV2Module],
})
export class V2Module {}
