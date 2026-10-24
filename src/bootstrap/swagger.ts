import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Environment } from '@/config/index.js';

const apiVersions = ['1', '2'] as const;
type ApiVersion = (typeof apiVersions)[number];

export function configureSwagger(
  app: INestApplication,
  environment: Environment,
): void {
  if (!environment.SWAGGER_ENABLED) return;

  const buildDocument = (version: ApiVersion) => {
    const options = new DocumentBuilder()
      .setTitle(environment.PLATFORM_NAME)
      .setDescription(`${environment.PLATFORM_NAME} API description`)
      .setVersion(`v${version}`)
      .addTag('Server')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    const prefix = `/v${version}`;
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(
        ([path]) => path === prefix || path.startsWith(`${prefix}/`),
      ),
    );
    return document;
  };

  const freshDocument = (
    version: ApiVersion,
    response: { setHeader(name: string, value: string): void },
  ) => {
    response.setHeader('Cache-Control', 'no-store');
    return buildDocument(version);
  };

  for (const version of apiVersions) {
    SwaggerModule.setup(`api/v${version}`, app, () => buildDocument(version), {
      ui: false,
      raw: ['json'],
      jsonDocumentUrl: `api/v${version}-json`,
      patchDocumentOnRequest: (_request, response) =>
        freshDocument(
          version,
          response as { setHeader(name: string, value: string): void },
        ),
    });
  }

  SwaggerModule.setup('api', app, () => buildDocument('1'), {
    explorer: true,
    raw: false,
    customSiteTitle: `${environment.PLATFORM_NAME} API`,
    customCss: [
      ':root { color-scheme: light; }',
      'html, body { background: #fafafa !important; }',
      '.swagger-ui .info a[href$="-json"] { display: none; }',
      '.swagger-ui .topbar { background: #fff; border-bottom: 1px solid #e8e8e8; }',
      '.swagger-ui .topbar a, .swagger-ui .topbar .dark-mode-toggle { display: none; }',
    ].join('\n'),
    swaggerOptions: {
      persistAuthorization: false,
      urls: apiVersions.map((version) => ({
        url: `/api/v${version}-json`,
        name: `version ${version}`,
      })),
      'urls.primaryName': 'version 1',
    },
    patchDocumentOnRequest: (_request, response) =>
      freshDocument(
        '1',
        response as { setHeader(name: string, value: string): void },
      ),
  });
}
