import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow your external frontend app to call the build API + SSE stream.
  // Set CORS_ORIGIN to your app's origin in production; defaults to "*" for local dev.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
  });

  // ── OpenAPI document ───────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('JAX AI Builder API')
    .setDescription(
      'Runtime API for the 27-agent website/app builder pipeline. ' +
        'Start builds, stream orchestrator events (SSE), and approve deploys.',
    )
    .setVersion('1.0')
    .addTag('builds', 'Run and observe builds')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI at /docs (raw JSON at /docs-json)
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  // Scalar API reference at /reference (modern, interactive)
  app.use(
    '/reference',
    apiReference({
      content: document,
      // Cosmetic: pick a theme. See https://github.com/scalar/scalar
      theme: 'purple',
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const base = `http://localhost:${port}`;
  const log = new Logger('Bootstrap');
  log.log(`🚀 Runtime API ready at ${base}`);
  log.log(`📘 Swagger UI       → ${base}/docs`);
  log.log(`🔮 Scalar reference → ${base}/reference`);
  log.log(`🧩 OpenAPI JSON     → ${base}/docs-json`);
}
bootstrap();
