import { ClefModule } from '../clef/clef.module.js';
import { Global, Module } from '@nestjs/common';
import { DelegationService } from './delegation.service.js';
import { OpenaiService } from './openai.service.js';
import { WebToolsModule, AgentExtensionsModule } from '@/config';

@Global()
@Module({
  imports: [WebToolsModule, ClefModule, AgentExtensionsModule],
  providers: [OpenaiService, DelegationService],
  exports: [OpenaiService, DelegationService],
})
export class OpenaiModule {}
