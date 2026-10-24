import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  StandardSchemaValidationPipe,
  ConsoleLogger,
  VersioningType,
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

  app.enableVersioning({
    type: VersioningType.URI,
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

  const platformName = process.env.PLATFORM_NAME ?? 'Agentic';
  const apiVersions = ['1', '2'] as const;

  const buildApiDocument = (version: (typeof apiVersions)[number]) => {
    const config = new DocumentBuilder()
      .setTitle(platformName)
      .setDescription(`${platformName} API description`)
      .setVersion(version)
      .addTag('Server', `Version ${version}`)
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const prefix = `/v${version}`;
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(
        ([path]) => path === prefix || path.startsWith(`${prefix}/`),
      ),
    );
    return document;
  };

  const freshDocument = (
    version: (typeof apiVersions)[number],
    response: { setHeader: (name: string, value: string) => void },
  ) => {
    response.setHeader('Cache-Control', 'no-store');
    return buildApiDocument(version);
  };

  for (const version of apiVersions) {
    SwaggerModule.setup(`api/v${version}`, app, () => buildApiDocument(version), {
      ui: false,
      raw: ['json'],
      jsonDocumentUrl: `api/v${version}-json`,
      patchDocumentOnRequest: (_request, response) =>
        freshDocument(
          version,
          response as { setHeader: (name: string, value: string) => void },
        ),
    });
  }

  SwaggerModule.setup('api', app, () => buildApiDocument('1'), {
    explorer: true,
    raw: false,
    customCss: '.swagger-ui .info a[href$="-json"] { display: none; }',
    swaggerOptions: {
      urls: apiVersions.map((version) => ({
        url: `/api/v${version}-json`,
        name: `version ${version}`,
      })),
      'urls.primaryName': 'version 1',
    },
    // Nest keeps the first document for the life of the process, and the
    // browser will cache swagger-ui-init.js. Rebuild on each load so a
    // refresh shows routes added since the server started.
    patchDocumentOnRequest: (_request, response) =>
      freshDocument(
        '1',
        response as { setHeader: (name: string, value: string) => void },
      ),
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
