import { Module } from '@nestjs/common';
import { ChatkitAdapterModule } from '@/lib';
import { WorkspaceModule } from '../workspaces/workspace.module.js';
import { ChatkitController } from './chatkit.controller.js';
import { ChatkitService } from './chatkit.service.js';

@Module({
  imports: [WorkspaceModule, ChatkitAdapterModule],
  controllers: [ChatkitController],
  providers: [ChatkitService],
  exports: [ChatkitService],
})
export class ChatkitModule {}
