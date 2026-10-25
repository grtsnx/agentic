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

  it('serves the custom UI without a remote widget or API secret', async () => {
    const response = await request(app.getHttpServer())
      .get('/playground')
      .expect(200);
    expect(response.text).toContain('id="message"');
    expect(response.text).not.toContain('<openai-chatkit');
    expect(response.text).not.toContain('href="/playground/chatkit"');
    await request(app.getHttpServer())
      .get('/playground/chatkit')
      .expect(308)
      .expect('Location', '/playground');
    expect(response.headers['content-security-policy']).not.toContain(
      'https://cdn.platform.openai.com',
    );
    expect(response.headers['content-security-policy']).toContain(
      "script-src 'self'",
    );
    const script = await request(app.getHttpServer())
      .get('/playground/app.js')
      .expect(200);
    expect(script.text).toContain('threads.create');
    expect(script.text).not.toContain('cdn.platform.openai.com');
    expect(script.text).not.toContain('OPENAI_API_KEY');
  });
  it('uploads, scopes, previews, and removes attachments without sharing them across threads', async () => {
    const auth = await owner();
    const other = await owner();
    const upload = await request(app.getHttpServer())
      .post('/v1/chatkit/' + auth.id + '/files')
      .set('Authorization', 'Bearer ' + auth.token)
      .attach('file', Buffer.from('Private facts for this chat.'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(200);
    expect(upload.body).toMatchObject({ type: 'file', name: 'notes.txt' });
    const fileId = upload.body.id;
    const result = await post(auth, {
      type: 'threads.create',
      params: { input: { ...input, attachments: [fileId] } },
    }).expect(200);
    const output = events(result.text);
    expect(
      output.find((event) => event.item?.type === 'user_message').item
        .attachments[0].id,
    ).toBe(fileId);
    expect(result.text).toContain('Preview notes.txt');
    await request(app.getHttpServer())
      .get('/v1/chatkit/' + auth.id + '/files/' + fileId)
      .set('Authorization', 'Bearer ' + auth.token)
      .expect(200)
      .expect('Private facts for this chat.');
    await request(app.getHttpServer())
      .get('/v1/chatkit/' + other.id + '/files/' + fileId)
      .set('Authorization', 'Bearer ' + other.token)
      .expect(404);
    await post(auth, {
      type: 'threads.create',
      params: { input: { ...input, attachments: [fileId] } },
    }).expect(404);
    await post(auth, {
      type: 'attachments.delete',
      params: { attachment_id: fileId },
    }).expect(200);
    // A draft-delete replay must not erase a file already sent to a conversation.
    await request(app.getHttpServer())
      .get('/v1/chatkit/' + auth.id + '/files/' + fileId)
      .set('Authorization', 'Bearer ' + auth.token)
      .expect(200);
    await post(auth, {
      type: 'threads.delete',
      params: { thread_id: output[0].thread.id },
    }).expect(200);
    await request(app.getHttpServer())
      .get('/v1/chatkit/' + auth.id + '/files/' + fileId)
      .set('Authorization', 'Bearer ' + auth.token)
      .expect(404);
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
    expect(answer.item.agentic.runtime.tokens).toMatchObject({
      input: 12,
      output: 3,
      total: 15,
    });
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
  it('edits an owned user message and removes later turns, rejecting foreign or invalid edits', async () => {
    const auth = await owner(),
      foreign = await owner();
    const original = await post(auth, {
      type: 'threads.create',
      params: { input },
    }).expect(200);
    const output = events(original.text);
    const id = output[0].thread.id;
    const user = output.find(
      (event) =>
        event.type === 'thread.item.done' && event.item.type === 'user_message',
    ).item;
    const assistant = output.find(
      (event) =>
        event.type === 'thread.item.done' &&
        event.item.type === 'assistant_message',
    ).item;
    const edit = {
      type: 'threads.edit_user_message',
      params: { thread_id: id, item_id: user.id, text: 'Updated question' },
    };
    await post(foreign, edit).expect(404);
    await post(auth, { ...edit, params: { ...edit.params, text: ' ' } }).expect(
      400,
    );
    await post(auth, {
      ...edit,
      params: { ...edit.params, item_id: assistant.id },
    }).expect(404);
    await post(auth, {
      type: 'threads.add_user_message',
      params: { thread_id: id, input },
    }).expect(200);
    const updated = await post(auth, edit).expect(200);
    expect(events(updated.text)).toContainEqual({
      type: 'thread.item.removed',
      item_id: user.id,
    });
    const history = await post(auth, {
      type: 'items.list',
      params: { thread_id: id, order: 'asc' },
    }).expect(200);
    const messages = history.body.data.filter(
      (item: { type: string }) => item.type === 'user_message',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].content[0].text).toBe('Updated question');
    expect(
      history.body.data.some(
        (item: { id: string }) => item.id === assistant.id,
      ),
    ).toBe(false);
    await post(auth, edit).expect(404);
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
