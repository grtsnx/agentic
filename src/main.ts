import { ConsoleLogger } from '@nestjs/common';
import { createApplication } from '@/bootstrap';

const { app, environment } = await createApplication();
await app.listen(environment.PORT, '0.0.0.0');

const baseUrl = `http://localhost:${environment.PORT}`;
const logger = new ConsoleLogger('Bootstrap');
if (environment.REALTIME_PLAYGROUND_ENABLED) {
  logger.log(`Playground: ${baseUrl}/playground`);
}
logger.log('CLI: bun run chat');
if(environment.COMPUTER_ENABLED)logger.log(`Computer access: ${baseUrl}/playground (computer icon; local owner key required)`);

if (environment.SWAGGER_ENABLED) {
  logger.log(`Swagger UI: ${baseUrl}/api`);
  logger.log(`Scalar API reference: ${baseUrl}/docs`);
  logger.log(`OpenAPI v1: ${baseUrl}/api/v1-json`);
  logger.log(`OpenAPI v2: ${baseUrl}/api/v2-json`);
}
