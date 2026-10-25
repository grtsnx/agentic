import { WorkspaceModule } from '../workspaces/workspace.module.js';
import { Module } from '@nestjs/common';
import { LibModule } from '@/lib';
import { ChatV1Controller } from './chat.controller.js';
import { ChatSessionService } from './chat-session.service.js';
import { ChatV1Gateway } from './chat.gateway.js';
import { ChatV1Service } from './chat.service.js';

@Module({
  imports: [LibModule, WorkspaceModule],
  controllers: [ChatV1Controller],
  providers: [ChatV1Gateway, ChatV1Service, ChatSessionService],
  exports: [ChatV1Service, ChatSessionService],
})
export class ChatV1Module {}
