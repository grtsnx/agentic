import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  StandardSchemaValidationPipe,
  ConsoleLogger,
} from '@nestjs/common';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from '@/app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({
      json: true,
      logLevels: ['log', 'warn', 'error', 'fatal'],
    }),
  });

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: false,
      whitelist: true,
      transform: true,
    }),
    new StandardSchemaValidationPipe({
      validateCustomDecorators: true,
    }),
  );
  app.use(helmet());
  app.useSecurityHeaders({
    contentSecurityPolicy: isProduction
      ? true
      : {
          directives: {
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          },
        },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
