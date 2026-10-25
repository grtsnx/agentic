import { WorkspaceModule } from './workspaces/workspace.module.js';
import { Module } from '@nestjs/common';
import { ChatV1Module } from './chat/chat.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [ChatV1Module, VoiceModule, WorkspaceModule],
  exports: [ChatV1Module, VoiceModule, WorkspaceModule],
})
export class V1Module {}
