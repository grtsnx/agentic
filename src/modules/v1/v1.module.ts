import { WorkspaceModule } from './workspaces/workspace.module.js';
import { ChatkitModule } from './chatkit/chatkit.module.js';
import { Module } from '@nestjs/common';
import { ChatV1Module } from './chat/chat.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [ChatV1Module, VoiceModule, WorkspaceModule, ChatkitModule],
  exports: [ChatV1Module, VoiceModule, WorkspaceModule, ChatkitModule],
})
export class V1Module {}
