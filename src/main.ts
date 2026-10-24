import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  StandardSchemaValidationPipe,
  ConsoleLogger,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from '@/app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({
      json: true,
      logLevels: ['warn', 'error', 'fatal'],
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
            defaultSrc: [`'self'`],
            styleSrc: [`'self'`, `'unsafe-inline'`],
            imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
            scriptSrc: [
              "'self'",
              'https:',
              "'unsafe-inline'",
              'https://unpkg.com',
            ],
          },
        },
  });

  const apiVersion = '1.0';
  const config = new DocumentBuilder()
    .setTitle(process.env.PLATFORM_NAME ?? 'Agentic')
    .setDescription(process.env.PLATFORM_NAME + ' API description')
    .setVersion(apiVersion)
    .addTag('Server', `Version ${apiVersion}`)
    .build();
  const buildApiDocument = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, buildApiDocument, {
    // Nest keeps the first document for the life of the process, and the
    // browser will cache swagger-ui-init.js. Rebuild on each load so a
    // refresh shows routes added since the server started.
    patchDocumentOnRequest: (_request, response) => {
      const httpResponse = response as {
        setHeader: (name: string, value: string) => void;
      };
      httpResponse.setHeader('Cache-Control', 'no-store');
      return buildApiDocument();
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
