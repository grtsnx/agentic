import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap/application.js';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  const generateReply = vi.fn();
  const structuredOutput = {
    status: 'completed',
    message: 'Test response',
    summary: 'Test summary',
    keyPoints: ['Test point'],
    suggestedActions: [],
    followUpQuestions: ['Test follow-up?'],
  };

  beforeEach(async () => {
    generateReply.mockReset().mockResolvedValue(structuredOutput);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenaiService)
      .useValue({ generateReply })
      .compile();

    app = module.createNestApplication({ logger: false });
    configureApplication(
      app,
      validateEnvironment({ NODE_ENV: 'test', SWAGGER_ENABLED: true }),
    );
    await app.init();
  });

  it.each(['/v1/chat', '/v2/chat'])(
    'serves the isolated %s chat endpoint',
    async (path) => {
      const response = await request(app.getHttpServer())
        .post(path)
        .send({ message: '  Explain the Roman Republic  ' })
        .expect(200);

      expect(generateReply).toHaveBeenCalledWith('Explain the Roman Republic');
      expect(response.body).toMatchObject({
        statusCode: 200,
        data: structuredOutput,
      });
    },
  );

  it.each([
    [{}, 400],
    [{ message: '' }, 400],
    [{ message: '   ' }, 400],
    [{ message: 'x'.repeat(4_001) }, 400],
    [{ message: 'valid', unexpected: true }, 400],
  ])('rejects invalid input %#', async (body, status) => {
    await request(app.getHttpServer())
      .post('/v1/chat')
      .send(body)
      .expect(status);
    expect(generateReply).not.toHaveBeenCalled();
  });

  it('validates v2 independently', async () => {
    await request(app.getHttpServer())
      .post('/v2/chat')
      .send({ message: '   ' })
      .expect(400);
    expect(generateReply).not.toHaveBeenCalled();
  });

  it('documents both chat versions without exposing secrets', async () => {
    const v1 = await request(app.getHttpServer())
      .get('/api/v1-json')
      .expect(200);
    const v2 = await request(app.getHttpServer())
      .get('/api/v2-json')
      .expect(200);

    expect(v1.body.paths).toHaveProperty('/v1/chat');
    expect(v1.body.paths).not.toHaveProperty('/v2/chat');
    expect(v2.body.paths).toHaveProperty('/v2/chat');
    expect(v2.body.paths).not.toHaveProperty('/v1/chat');
    expect(JSON.stringify([v1.body, v2.body])).not.toContain('OPENAI_API_KEY');
  });

  afterEach(async () => {
    await app.close();
  });
});
