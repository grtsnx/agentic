import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// The entrypoint shares its name with the directory; an alias rewrites to itself.
import { CliModule, CliService } from './cli/index.js';

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
