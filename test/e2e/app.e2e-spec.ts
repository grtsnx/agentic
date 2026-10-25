import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap/application.js';
import { validateEnvironment } from '@/config';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(
      app,
      validateEnvironment({
        NODE_ENV: 'test',
        SWAGGER_ENABLED: true,
        CORS_ORIGINS: 'https://app.example.com',
      }),
    );
    await app.init();
  });

  it('returns security headers and a request ID', async () => {
    const response = await request(app.getHttpServer()).get('/v1');

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toMatch(/^[\w.-]{1,64}$/);
    expect(response.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('applies exact-origin CORS without reflecting untrusted origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/v1')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    const rejected = await request(app.getHttpServer())
      .options('/v1')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('adds security headers and a request ID to CSRF rejections', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1')
      .set('Origin', 'https://evil.example.com')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toMatch(/^[\w.-]{1,64}$/);
    expect(response.body).toMatchObject({
      statusCode: 403,
      requestId: response.headers['x-request-id'],
    });
  });

  it('replaces an invalid caller-supplied request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1')
      .set('x-request-id', '<script>alert(1)</script>')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[\w.-]{1,64}$/);
    expect(response.headers['x-request-id']).not.toContain('script');
  });

  it('returns sanitized global errors for missing routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing')
      .set('x-request-id', 'test-request-123')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      statusType: 'NOT_FOUND',
      requestId: 'test-request-123',
      path: '/missing',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it.each(['/v1/health/live', '/v2/health/live'])(
    '%s exposes a dependency-free liveness check',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.body.data).toEqual({ status: 'ok' });
    },
  );

  it('does not throttle dependency-free liveness probes', async () => {
    const responses = [];
    for (let index = 0; index < 105; index += 1) {
      responses.push(await request(app.getHttpServer()).get('/v1/health/live'));
    }

    expect(responses.every(({ status }) => status === 200)).toBe(true);
  });

  it('serves populated, version-specific OpenAPI documents', async () => {
    const v1 = await request(app.getHttpServer())
      .get('/api/v1-json')
      .expect(200);
    const v2 = await request(app.getHttpServer())
      .get('/api/v2-json')
      .expect(200);

    expect(v1.body.info.version).toBe('v1');
    expect(v1.body.tags).toContainEqual({
      name: 'Server',
      description: 'Core server status, health, and connectivity endpoints.',
    });
    expect(v1.body.tags).toContainEqual({
      name: 'Chat',
      description:
        'Version 1 agent chat endpoints for validated, structured responses.',
    });
    expect(v1.body.paths).toHaveProperty('/v1');
    expect(v1.body.paths).not.toHaveProperty('/v2');
    expect(v2.body.info.version).toBe('v2');
    expect(v2.body.tags).not.toContainEqual(
      expect.objectContaining({ name: 'Chat' }),
    );
    expect(v2.body.paths).toHaveProperty('/v2');
    expect(v2.body.paths).not.toHaveProperty('/v1');
  });

  it('adds standard response examples to every documented operation', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/v1-json')
      .expect(200);
    const responses = body.paths['/v1/chat'].post.responses;

    expect(Object.keys(responses)).toEqual(
      expect.arrayContaining([
        '200',
        '400',
        '401',
        '403',
        '404',
        '409',
        '422',
        '429',
        '500',
        '503',
      ]),
    );
    expect(responses['200'].content['application/json'].example).toEqual({
      statusCode: 200,
      statusType: 'OK',
      message: 'Success',
      data: {
        status: 'completed',
        message: 'The Roman Republic ended after civil conflict.',
        summary: 'Rome changed from a republic into an empire.',
        keyPoints: ['Political violence weakened republican institutions.'],
        suggestedActions: [],
        followUpQuestions: ['Would you like a timeline of the civil wars?'],
        runtime: {
          durationMs: 1840,
          tokens: {
            input: 120,
            output: 80,
            total: 200,
            cachedInput: 20,
            reasoningOutput: 10,
          },
          cost: {
            estimatedUsd: 0.00502,
            currency: 'USD',
            exact: false,
            includesToolCosts: true,
          },
          models: [{ name: 'gpt-6-astra', calls: 1 }],
          tools: [],
        },
      },
    });
    expect(responses['429'].content['application/json'].example).toEqual({
      statusCode: 429,
      statusType: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      path: '/v1/chat',
      requestId: 'example-request-id',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('serves Swagger with consistent themes and a compact version picker', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);
    const initializer = await request(app.getHttpServer())
      .get('/api/swagger-ui-init.js')
      .expect(200);

    expect(response.text).toContain('swagger-ui-bundle.js');
    expect(response.text).not.toContain('MutationObserver');
    expect(response.text).not.toContain("classList.remove('dark-mode')");
    expect(response.text).toContain(
      '.swagger-ui .topbar .download-url-wrapper { display: none; }',
    );
    expect(response.text).toContain('.swagger-ui .topbar { display: none; }');
    expect(response.text).toContain('api-version-picker');
    expect(response.text).toContain('max-width: 220px');
    expect(response.text).toContain(
      '.swagger-ui .topbar .dark-mode-toggle { display: none; }',
    );
    expect(response.text).toContain('api-theme-toggle');
    expect(initializer.text).toContain(
      'setAttribute("aria-label", "API version")',
    );
    expect(initializer.text).toContain('setAttribute("aria-label", label)');
    expect(initializer.text).toContain('"defaultModelsExpandDepth": -1');
    expect(response.text).toContain('html.dark-mode body');
  });

  it('serves Scalar with both versioned OpenAPI documents', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.text).toContain('Scalar.createApiReference');
    expect(response.text).toContain(
      'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0',
    );
    expect(response.text).toContain('/api/v1-json');
    expect(response.text).toContain('/api/v2-json');
    expect(response.headers['content-security-policy']).toContain(
      'https://cdn.jsdelivr.net',
    );
  });

  it('serves a same-origin Socket.IO playground and local assets', async () => {
    const page = await request(app.getHttpServer())
      .get('/playground')
      .expect('Content-Type', /text\/html/)
      .expect(200);
    const script = await request(app.getHttpServer())
      .get('/playground/app.js')
      .expect('Content-Type', /javascript/)
      .expect(200);
    const styles = await request(app.getHttpServer())
      .get('/playground/styles.css')
      .expect('Content-Type', /text\/css/)
      .expect(200);

    expect(page.text).toContain('<title>Agentic</title>');
    expect(page.text).toContain('/socket.io/socket.io.js');
    expect(page.text).toContain('/playground/app.js');
    expect(page.text).not.toContain('https://hoppscotch.io');
    expect(page.text).not.toContain('/v1/chat');
    expect(page.text).toContain('How can I help you today?');
    expect(script.text).toContain("io('/v1/chat'");
    expect(script.text).toContain("socket.on('chat.status'");
    expect(script.text).toContain('formatDuration');
    expect(styles.text).toContain('color-scheme: light');
    expect(styles.text).toContain('.thinking-orb');
    expect(styles.text).toContain('@keyframes shimmer');
    expect(styles.text).toContain('.user .message-body');
    expect(styles.text).toContain('justify-self: end');
    expect(styles.text).toContain('.stop-button[hidden]');
    expect(styles.text).not.toContain('prefers-color-scheme: dark');

    await request(app.getHttpServer()).get('/realtime').expect(404);
  });

  it.each(['/v1', '/v2'])('%s (GET)', async (path) => {
    await request(app.getHttpServer()).get(path).expect(200).expect({
      statusCode: 200,
      statusType: 'OK',
      message: 'Success',
      data: 'Hello World!',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
