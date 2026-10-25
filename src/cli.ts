import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CliModule } from '@/cli/cli.module.js';
import { CliService } from '@/cli/cli.service.js';

const app = await NestFactory.createApplicationContext(CliModule, {
  logger: new ConsoleLogger({ logLevels: ['warn', 'error', 'fatal'] }),
});

try {
  process.exitCode = await app
    .get(CliService)
    .run(process.stdin, process.stdout);
} catch {
  process.exitCode = 1;
} finally {
  await app.close();
}
