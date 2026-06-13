// Run with: bun run setup:pipeline

import { NestFactory } from '@nestjs/core';
import { PipelineModule } from './pipeline.module';
import { PipelineService } from './pipeline.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(PipelineModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const pipelineService = app.get(PipelineService);
    await pipelineService.setup();
    process.exit(0);
  } catch (err) {
    console.error('❌ Pipeline setup failed:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void bootstrap();
}
