import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap/application.js';
import { validateEnvironment } from '@/config';
import { VoiceService } from '@/modules';

describe('VoiceController (e2e)', () => {
  let app: INestApplication;
  const createCredentials = vi.fn();

  beforeEach(async () => {
    createCredentials.mockResolvedValue({
      serverUrl: 'wss://agentic.livekit.cloud',
      participantToken: 'short-lived-token',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VoiceService)
      .useValue({ createCredentials })
      .compile();

    app = module.createNestApplication({ logger: false });
    configureApplication(
      app,
      validateEnvironment({ NODE_ENV: 'test', SWAGGER_ENABLED: true }),
    );
    await app.init();
  });

  it('returns short-lived LiveKit credentials with HTTP 200', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/voice/token')
      .expect(200);

    expect(response.body).toMatchObject({
      statusCode: 200,
      data: {
        serverUrl: 'wss://agentic.livekit.cloud',
        participantToken: 'short-lived-token',
      },
    });
    expect(createCredentials).toHaveBeenCalledOnce();
  });

  it('documents voice only in v1 without exposing credential names', async () => {
    const v1 = await request(app.getHttpServer())
      .get('/api/v1-json')
      .expect(200);
    const v2 = await request(app.getHttpServer())
      .get('/api/v2-json')
      .expect(200);

    expect(v1.body.paths).toHaveProperty('/v1/voice/token');
    expect(v2.body.paths).not.toHaveProperty('/v1/voice/token');
    expect(JSON.stringify(v1.body)).not.toContain('LIVEKIT_API_SECRET');
    expect(JSON.stringify(v1.body)).not.toContain('OPENAI_API_KEY');
  });

  afterEach(async () => {
    await app.close();
  });
});
