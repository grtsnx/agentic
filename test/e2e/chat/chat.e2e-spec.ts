import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap';
import { validateEnvironment } from '@/config';
import { OpenaiService } from '@/lib';

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  const generateReply = vi.fn();
  const createSession = vi.fn(() => ({
    getItems: vi.fn(async () => []),
    clearSession: vi.fn(),
    addItems: vi.fn(),
  }));
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
      .useValue({ generateReply, createSession })
      .compile();

    app = module.createNestApplication({ logger: false });
    configureApplication(
      app,
      validateEnvironment({ NODE_ENV: 'test', SWAGGER_ENABLED: true }),
    );
    await app.init();
  });

  it('serves the v1 chat endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/chat')
      .send({ message: '  Explain the Roman Republic  ' })
      .expect(200);

    expect(generateReply).toHaveBeenCalledWith('Explain the Roman Republic');
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: structuredOutput,
    });
  });

  it('keeps the v2 chat boundary empty until a new contract exists', async () => {
    await request(app.getHttpServer())
      .post('/v2/chat')
      .send({ message: 'Hello' })
      .expect(404);
    expect(generateReply).not.toHaveBeenCalled();
  });

  it('creates, continues, and deletes an in-memory session', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/chat/sessions')
      .send()
      .expect(201);
    const id = created.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/v1/chat/sessions/${id}/messages`)
      .send({ message: 'Continue' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/v1/chat/sessions/${id}`)
      .expect(204);
    await request(app.getHttpServer())
      .post(`/v1/chat/sessions/${id}/messages`)
      .send({ message: 'Too late' })
      .expect(404);
  });

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

  it('documents only the implemented chat version without exposing secrets', async () => {
    const v1 = await request(app.getHttpServer())
      .get('/api/v1-json')
      .expect(200);
    const v2 = await request(app.getHttpServer())
      .get('/api/v2-json')
      .expect(200);

    expect(v1.body.paths).toHaveProperty('/v1/chat');
    expect(v1.body.paths).not.toHaveProperty('/v2/chat');
    expect(v2.body.paths).not.toHaveProperty('/v2/chat');
    expect(v2.body.paths).not.toHaveProperty('/v1/chat');
    expect(JSON.stringify([v1.body, v2.body])).not.toContain('OPENAI_API_KEY');
  });

  afterEach(async () => {
    await app.close();
  });
});
