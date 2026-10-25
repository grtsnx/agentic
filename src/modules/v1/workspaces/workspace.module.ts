import { Module } from '@nestjs/common';
import { LibModule } from '@/lib';
import { WebToolsModule } from '@/config';
import { WorkspaceGuard } from '../../../middleware/guards/workspace.guard.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceStore } from './workspace-store.service.js';
import { WorkspaceFilesService } from './workspace-files.service.js';
import { WorkspaceController } from './workspace.controller.js';
@Module({imports:[LibModule,WebToolsModule],providers:[WorkspaceService,WorkspaceStore,WorkspaceFilesService,WorkspaceGuard],controllers:[WorkspaceController],exports:[WorkspaceService,WorkspaceStore]})
export class WorkspaceModule {}
