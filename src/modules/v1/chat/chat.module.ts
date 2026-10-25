import { Module } from '@nestjs/common';
import { LibModule } from '@/lib';
import { ChatV1Controller } from './chat.controller.js';
import { ChatV1Service } from './chat.service.js';

@Module({
  imports: [LibModule],
  controllers: [ChatV1Controller],
  providers: [ChatV1Service],
  exports: [ChatV1Service],
})
export class ChatV1Module {}
