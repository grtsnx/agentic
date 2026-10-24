import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  it.each(['/v1', '/v2'])('%s (GET)', (path) => {
    return request(app.getHttpServer())
      .get(path)
      .expect(200)
      .expect({
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
