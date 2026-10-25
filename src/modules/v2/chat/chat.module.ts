import { Module } from '@nestjs/common';
import { LibModule } from '@/lib';
import { ChatV2Controller } from './chat.controller.js';
import { ChatV2Service } from './chat.service.js';

@Module({
  imports: [LibModule],
  controllers: [ChatV2Controller],
  providers: [ChatV2Service],
  exports: [ChatV2Service],
})
export class ChatV2Module {}
