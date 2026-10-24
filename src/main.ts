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

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('cats')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
