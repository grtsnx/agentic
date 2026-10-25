import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap';
import { validateEnvironment, type OpenaiStreamEvent } from '@/config';
import { OpenaiService } from '@/lib';

describe('ChatKit protocol and capability isolation', () => {
  let app: INestApplication;
  const streamReply = vi.fn(
    async function* (): AsyncGenerator<OpenaiStreamEvent> {
      yield { type: 'status', phase: 'thinking', message: 'Thinking' };
      yield { type: 'delta', delta: 'Hello there.' };
      yield {
        type: 'completed',
        response: {
          message: 'Hello there.',
          sources: [
            {
              title: 'Example',
              url: 'https://example.com',
              domain: 'example.com',
              endIndex: 12,
            },
          ],
          runtime: {
            durationMs: 30,
            tokens: {
              input: 12,
              output: 3,
              total: 15,
              cachedInput: 0,
              reasoningOutput: 0,
            },
            cost: {
              estimatedUsd: 0.0001,
              currency: 'USD',
              exact: false,
              includesToolCosts: false,
            },
            models: [{ name: 'gpt-5-nano', calls: 1 }],
            tools: [],
          },
        },
      };
    },
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenaiService)
      .useValue({ streamReply })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app, validateEnvironment({ NODE_ENV: 'test' }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  const owner = async () =>
    (await request(app.getHttpServer()).post('/v1/workspaces').expect(201)).body
      .data as { id: string; token: string };
  const post = (auth: { id: string; token: string }, body: object) =>
    request(app.getHttpServer())
      .post('/v1/chatkit/' + auth.id)
      .set('Authorization', 'Bearer ' + auth.token)
      .send(body);
  const input = {
    content: [{ type: 'input_text', text: 'Hello' }],
    attachments: [],
    inference_options: {},
  };
  const events = (text: string) =>
    text
      .split('\n\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));

  it('serves the official component with a page-scoped CSP and no API secret', async () => {
    const response = await request(app.getHttpServer())
      .get('/playground/chatkit')
      .expect(200);
    expect(response.text).toContain('<openai-chatkit');
    expect(response.headers['content-security-policy']).toContain(
      'https://cdn.platform.openai.com',
    );
    expect(response.headers['content-security-policy']).toContain(
      "script-src 'self' https://cdn.platform.openai.com;",
    );
    const script = await request(app.getHttpServer())
      .get('/playground/chatkit.js')
      .expect(200);
    expect(script.text).toContain('domain_pk_localhost_dev');
    expect(script.text).not.toContain('OPENAI_API_KEY');
  });
  it('streams the ChatKit protocol, citations and usage without a REST envelope, and continues history', async () => {
    const auth = await owner();
    const result = await post(auth, {
      type: 'threads.create',
      params: { input },
    }).expect(200);
    expect(result.headers['content-type']).toContain('text/event-stream');
    const output = events(result.text);
    const id = output[0].thread.id;
    expect(output.map((event) => event.type)).toContain('progress_update');
    const answer = output.find(
      (event) =>
        event.type === 'thread.item.done' &&
        event.item.type === 'assistant_message',
    );
    expect(answer.item.content[0].annotations[0].source.url).toBe(
      'https://example.com',
    );
    expect(result.text).toContain('12 in / 3 out / 15 total');
    const history = await post(auth, {
      type: 'threads.get_by_id',
      params: { thread_id: id },
    }).expect(200);
    expect(history.body.id).toBe(id);
    expect(history.body.items.data).toHaveLength(3);
    expect(history.body).not.toHaveProperty('statusCode');
    await post(auth, {
      type: 'threads.add_user_message',
      params: { thread_id: id, input },
    }).expect(200);
    const renamed = await post(auth, {
      type: 'threads.update',
      params: { thread_id: id, title: 'My chat' },
    }).expect(200);
    expect(renamed.body.title).toBe('My chat');
    const listed = await post(auth, {
      type: 'threads.list',
      params: { limit: 10000 },
    }).expect(200);
    expect(listed.body.data[0].id).toBe(id);
    await post(auth, {
      type: 'threads.delete',
      params: { thread_id: id },
    }).expect(200);
    await post(auth, {
      type: 'threads.get_by_id',
      params: { thread_id: id },
    }).expect(404);
  });
  it('rejects missing tokens, cross-owner reads and actions, model overrides, and unsupported uploads', async () => {
    const a = await owner(),
      b = await owner();
    await request(app.getHttpServer())
      .post('/v1/chatkit/' + a.id)
      .send({ type: 'threads.list', params: {} })
      .expect(401);
    const result = await post(a, {
      type: 'threads.create',
      params: { input },
    }).expect(200);
    const id = events(result.text)[0].thread.id;
    await post(b, {
      type: 'threads.get_by_id',
      params: { thread_id: id },
    }).expect(404);
    await post(b, {
      type: 'threads.custom_action',
      params: {
        thread_id: id,
        item_id: 'invented',
        action: { type: 'approval.decide', payload: { decision: 'approve' } },
      },
    }).expect(404);
    await post(a, {
      type: 'threads.create',
      params: {
        input: { ...input, inference_options: { model: 'expensive-model' } },
      },
    }).expect(400);
    await post(a, {
      type: 'threads.create',
      params: { input: { ...input, attachments: ['foreign-file'] } },
    }).expect(400);
    await post(a, { type: 'attachments.create', params: {} }).expect(400);
    await post(a, {
      type: 'threads.create',
      params: {
        input: { ...input, content: [{ type: 'input_text', text: ' ' }] },
      },
    }).expect(400);
  });
});
