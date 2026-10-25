import { HttpStatus, type INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type OperationObject,
  type ReferenceObject,
  type ResponseObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Environment } from '@/config';

const apiVersions = ['1', '2'] as const;
type ApiVersion = (typeof apiVersions)[number];

const operationMethods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

const standardErrors = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload too large',
  422: 'Unprocessable entity',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
} as const;

function isReferenceObject(
  value: SchemaObject | ReferenceObject,
): value is ReferenceObject {
  return '$ref' in value;
}

function schemaExample(
  document: OpenAPIObject,
  schema: SchemaObject | ReferenceObject | undefined,
): unknown {
  if (!schema) return undefined;

  if (isReferenceObject(schema)) {
    const name = schema.$ref.split('/').at(-1);
    const resolved = name ? document.components?.schemas?.[name] : undefined;
    return resolved ? schemaExample(document, resolved) : undefined;
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  if (schema.type === 'array') {
    const item = schemaExample(document, schema.items);
    return item === undefined ? [] : [item];
  }

  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([name, property]) => [
        name,
        schemaExample(document, property),
      ]),
    );
  }

  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'string') return 'string';

  return undefined;
}

function addResponseExample(
  document: OpenAPIObject,
  response: ResponseObject,
  statusCode: number,
): void {
  const mediaType = ((response.content ??= {})['application/json'] ??= {});
  if (mediaType.example !== undefined || mediaType.examples) return;

  const data = schemaExample(document, mediaType.schema);
  mediaType.example = {
    statusCode,
    statusType: HttpStatus[statusCode],
    message: 'Success',
    ...(data === undefined ? {} : { data }),
  };
}

function addStandardResponseExamples(document: OpenAPIObject): void {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of operationMethods) {
      const operation: OperationObject | undefined = pathItem[method];
      if (!operation) continue;

      for (const [status, response] of Object.entries(operation.responses)) {
        if (!response || '$ref' in response) continue;
        const statusCode = Number(status);
        if (statusCode >= 200 && statusCode < 300) {
          addResponseExample(document, response, statusCode);
        }
      }

      for (const [status, message] of Object.entries(standardErrors)) {
        const statusCode = Number(status);
        const current = operation.responses[status];
        const response: ResponseObject =
          current && !('$ref' in current) ? current : { description: message };
        const mediaType = ((response.content ??= {})['application/json'] ??=
          {});

        if (mediaType.example === undefined && !mediaType.examples) {
          mediaType.example = {
            statusCode,
            statusType: HttpStatus[statusCode],
            message,
            path,
            requestId: 'example-request-id',
            timestamp: '2026-01-01T00:00:00.000Z',
          };
        }

        operation.responses[status] = response;
      }
    }
  }
}

export function configureSwagger(
  app: INestApplication,
  environment: Environment,
): void {
  if (!environment.SWAGGER_ENABLED) return;

  const buildDocument = (version: ApiVersion) => {
    const builder = new DocumentBuilder()
      .setTitle(environment.PLATFORM_NAME)
      .setDescription(`${environment.PLATFORM_NAME} API description`)
      .setVersion(`v${version}`)
      .addTag(
        'Server',
        'Core server status, health, and connectivity endpoints.',
      );

    if (version === '1') {
      builder.addTag(
        'Chat',
        'Version 1 agent chat endpoints for validated, structured responses.',
      );
      builder.addTag(
        'Voice',
        'Version 1 short-lived credentials for LiveKit voice sessions.',
      );
    }

    const options = builder.build();
    const document = SwaggerModule.createDocument(app, options);
    const prefix = `/v${version}`;
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(
        ([path]) => path === prefix || path.startsWith(`${prefix}/`),
      ),
    );
    addStandardResponseExamples(document);
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
      'html, body, #swagger-ui, .swagger-ui { min-height: 100%; }',
      'html:not(.dark-mode), html:not(.dark-mode) body, html:not(.dark-mode) #swagger-ui, html:not(.dark-mode) .swagger-ui { background: #fafafa !important; color-scheme: light; }',
      'html.dark-mode, html.dark-mode body, html.dark-mode #swagger-ui, html.dark-mode .swagger-ui { background: #1c2022 !important; color-scheme: dark; }',
      '.swagger-ui .info a[href$="-json"] { display: none; }',
      '.swagger-ui .topbar { display: none; }',
      '.swagger-ui .topbar a { display: none; }',
      '.swagger-ui .topbar .download-url-wrapper { display: none; }',
      '.swagger-ui .topbar .dark-mode-toggle { display: none; }',
      '.swagger-ui .api-version-picker { margin-top: 20px; max-width: 220px; width: 100%; }',
      '.swagger-ui .api-version-picker select { border: 2px solid #62a03f; border-radius: 4px; height: 40px; padding: 0 12px; width: 100%; }',
      'html:not(.dark-mode) .swagger-ui .api-version-picker select { background: #fff; color: #3b4151; }',
      'html.dark-mode .swagger-ui .api-version-picker select { background: #1c2022; color: #e4e6e6; }',
      '.swagger-ui .info .title .api-theme-toggle { align-items: center; background: transparent; border: 1px solid currentColor; border-radius: 999px; color: inherit; cursor: pointer; display: inline-flex; font-size: 13px; height: 26px; justify-content: center; margin-left: 8px; padding: 0; vertical-align: super; width: 26px; }',
      '.swagger-ui .info .title .api-theme-toggle:hover { opacity: .75; }',
    ].join('\n'),
    swaggerOptions: {
      defaultModelsExpandDepth: -1,
      persistAuthorization: false,
      urls: apiVersions.map((version) => ({
        url: `/api/v${version}-json`,
        name: `version ${version}`,
      })),
      'urls.primaryName': 'version 1',
      onComplete: () => {
        const nativeSelect = document.querySelector<HTMLSelectElement>(
          '.swagger-ui .topbar .download-url-wrapper select',
        );
        const nativeThemeButton = document.querySelector<HTMLButtonElement>(
          '.swagger-ui .topbar .dark-mode-toggle button',
        );
        const info = document.querySelector<HTMLElement>('.swagger-ui .info');

        if (!nativeSelect || !info) return;

        document.querySelector('.api-version-picker')?.remove();
        document.querySelector('.api-theme-toggle')?.remove();

        const picker = document.createElement('div');
        const select = nativeSelect.cloneNode(true) as HTMLSelectElement;
        picker.className = 'api-version-picker';
        select.removeAttribute('id');
        select.setAttribute('aria-label', 'API version');
        select.value = nativeSelect.value;
        select.addEventListener('change', () => {
          nativeSelect.value = select.value;
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        picker.append(select);

        const description = info.querySelector('.description');
        if (description) {
          description.insertAdjacentElement('afterend', picker);
        } else {
          info.append(picker);
        }

        const title = info.querySelector<HTMLElement>('.title');
        if (nativeThemeButton && title) {
          const themeToggle = document.createElement('button');
          const updateThemeToggle = () => {
            const dark =
              document.documentElement.classList.contains('dark-mode');
            const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
            themeToggle.textContent = dark ? '☀' : '☾';
            themeToggle.setAttribute('aria-label', label);
            themeToggle.title = label;
          };

          themeToggle.className = 'api-theme-toggle';
          themeToggle.type = 'button';
          themeToggle.addEventListener('click', () => {
            nativeThemeButton.click();
            requestAnimationFrame(updateThemeToggle);
          });
          updateThemeToggle();
          title.append(themeToggle);
        }
      },
    },
    patchDocumentOnRequest: (_request, response) =>
      freshDocument(
        '1',
        response as { setHeader(name: string, value: string): void },
      ),
  });

  app.use(
    '/docs',
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      response.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      );
      next();
    },
    apiReference({
      agent: { disabled: true },
      cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0',
      darkMode: false,
      hideDarkModeToggle: true,
      pageTitle: `${environment.PLATFORM_NAME} API Reference`,
      sources: apiVersions.map((version, index) => ({
        default: index === 0,
        slug: `v${version}`,
        title: `version ${version}`,
        url: `/api/v${version}-json`,
      })),
      theme: 'default',
      urlRouting: false,
    }),
  );
}
