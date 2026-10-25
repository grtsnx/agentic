import { ConsoleLogger } from '@nestjs/common';
import { createApplication } from '@/bootstrap/application.js';

const { app, environment } = await createApplication();
await app.listen(environment.PORT, '0.0.0.0');

const baseUrl = `http://localhost:${environment.PORT}`;
const logger = new ConsoleLogger('Bootstrap');
logger.log(`Application: ${baseUrl}`);
logger.log(`REST chat v1: ${baseUrl}/v1/chat`);
logger.log(`Socket.IO v1 namespace: ${baseUrl}/v1/chat`);
logger.log(`Liveness: ${baseUrl}/v1/health/live`);
logger.log(`Readiness: ${baseUrl}/v1/health/ready`);
logger.log('CLI: bun run chat');

if (environment.SWAGGER_ENABLED) {
  logger.log(`Swagger UI: ${baseUrl}/api`);
  logger.log(`Scalar API reference: ${baseUrl}/docs`);
  logger.log(`OpenAPI v1: ${baseUrl}/api/v1-json`);
  logger.log(`OpenAPI v2: ${baseUrl}/api/v2-json`);
}
