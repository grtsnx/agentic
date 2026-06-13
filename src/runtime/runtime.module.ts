import { Module } from '@nestjs/common';

import { BuildController } from './build.controller';
import { RuntimeService } from './runtime.service';

/**
 * Runtime layer: turns the provisioned Orchestrator agent into an HTTP/SSE API that
 * any external frontend app can call to run builds. Provisioning lives in
 * PipelineModule; this module only consumes the agents it created.
 */
@Module({
  controllers: [BuildController],
  providers: [RuntimeService],
  exports: [RuntimeService],
})
export class RuntimeModule {}
