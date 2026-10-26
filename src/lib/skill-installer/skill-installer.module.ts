import { Module } from '@nestjs/common';
import { SkillInstallerService } from './skill-installer.service.js';
@Module({
  providers: [SkillInstallerService],
  exports: [SkillInstallerService],
})
export class SkillInstallerModule {}
