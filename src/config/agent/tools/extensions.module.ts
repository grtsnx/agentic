import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Leaf imports prevent config/lib initialization cycles.
import { McpModule } from '../../../lib/mcp/mcp.module.js';
import { SkillsService } from '../skills/skills.service.js';
import { AgentExtensionsService } from './extensions.service.js';
@Module({
  imports: [ConfigModule, McpModule],
  providers: [AgentExtensionsService, SkillsService],
  exports: [AgentExtensionsService],
})
export class AgentExtensionsModule {}
