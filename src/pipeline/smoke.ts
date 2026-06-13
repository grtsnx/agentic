// Smoke test: boots the pipeline's DI graph without touching the network.
// It verifies that every provider (services + all agents) wires up and that
// PipelineService resolves. It deliberately does NOT call setup(), so no
// Anthropic API key or outbound request is required.
//
// Run with: bun run smoke

import { NestFactory } from '@nestjs/core';
import { PipelineModule } from './pipeline.module';
import { PipelineService } from './pipeline.service';

async function smoke(): Promise<void> {
  const app = await NestFactory.createApplicationContext(PipelineModule, {
    logger: ['error'],
  });

  try {
    const pipeline = app.get(PipelineService);
    if (!pipeline || typeof pipeline.setup !== 'function') {
      throw new Error('PipelineService did not resolve from the DI container');
    }
    console.log('✅ Smoke test passed: pipeline DI graph boots cleanly.');
  } finally {
    await app.close();
  }
}

smoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Smoke test failed:', err);
    process.exit(1);
  });
