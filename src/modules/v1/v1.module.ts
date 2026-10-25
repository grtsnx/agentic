import { Module } from '@nestjs/common';
import { ChatV1Module } from './chat/chat.module.js';

@Module({
  imports: [ChatV1Module],
  exports: [ChatV1Module],
})
export class V1Module {}
