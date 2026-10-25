import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app';
import { configureApplication } from '@/bootstrap';
import { validateEnvironment } from '@/config';
import { SandboxService } from '@/lib';

describe('workspaces API security', () => {
  let app: INestApplication;
  const execute = vi.fn(async (_code: string, _signal: AbortSignal) => ({
    stdout: '4\n',
    stderr: '',
    exitCode: 0,
    truncated: false,
  }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SandboxService)
      .useValue({ execute })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app, validateEnvironment({ NODE_ENV: 'test' }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  const create = async () =>
    (await request(app.getHttpServer()).post('/v1/workspaces').expect(201)).body
      .data as { id: string; token: string };
  it('rejects unauthorized access and isolates uploads', async () => {
    const a = await create();
    const b = await create();
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/files`)
      .attach('file', Buffer.from('secret'), 'secret.txt')
      .expect(401);
    await request(app.getHttpServer())
      .get(`/v1/workspaces/${a.id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .expect(401);
    const uploaded = await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/files`)
      .set('Authorization', `Bearer ${a.token}`)
      .attach('file', Buffer.from('The budget is 42 dollars.'), 'notes.txt')
      .expect(201);
    const fileId = uploaded.body.data.id;
    const found = await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/retrieve`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ query: 'budget', fileIds: [fileId] })
      .expect(200);
    expect(found.body.data[0].text).toContain('42');
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${b.id}/retrieve`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ query: 'budget', fileIds: [fileId] })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/files`)
      .set('Authorization', `Bearer ${a.token}`)
      .attach('file', Buffer.alloc(1_048_577), 'large.txt')
      .expect(413);
  });
  it('requires an immutable single-use approval before execution', async () => {
    execute.mockClear();
    const a = await create();
    const b = await create();
    const proposed = await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/code`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ code: 'console.log(2+2)' })
      .expect(201);
    const id = proposed.body.data.id;
    expect(proposed.body.data).toMatchObject({
      status: 'pending',
      tier: 'write',
      action: { code: 'console.log(2+2)' },
      scopeId: a.id,
    });
    expect(execute).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/approvals/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ decision: 'approve' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/approvals/${id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ decision: 'approve', code: 'changed' })
      .expect(400);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/v1/workspaces/${a.id}/approvals/${id}`)
          .set('Authorization', `Bearer ${a.token}`)
          .send({ decision: 'approve' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toBe('console.log(2+2)');
    const audit = await request(app.getHttpServer())
      .get(`/v1/workspaces/${a.id}/audit`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(audit.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: 'execute_code',
          status: 'succeeded',
          durationMs: expect.any(Number),
          output: expect.objectContaining({ exitCode: 0 }),
        }),
      ]),
    );
  });
  it('denial and deletion never execute a proposed action', async () => {
    execute.mockClear();
    const a = await create();
    const proposed = await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/code`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ code: 'console.log(1)' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${a.id}/approvals/${proposed.body.data.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ decision: 'deny' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/v1/workspaces/${a.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/v1/workspaces/${a.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(401);
    expect(execute).not.toHaveBeenCalled();
  });
});
