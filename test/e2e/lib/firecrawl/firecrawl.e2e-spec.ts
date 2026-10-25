import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { FirecrawlService } from '@/lib/firecrawl/firecrawl.service.js';

describe('Firecrawl SDK transport', () => {
  let server: Server;
  let requests: number;
  let status: number;

  beforeEach(async () => {
    requests = 0;
    status = 200;
    server = createServer((request, response) => {
      requests++;
      request.resume();
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify(
          status === 200
            ? {
                success: true,
                data: {
                  markdown: '# Example Domain',
                  metadata: {
                    title: 'Example Domain',
                    sourceURL: 'https://example.com/',
                  },
                },
              }
            : { success: false, error: 'Upstream unavailable' },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as AddressInfo).port;
    vi.stubEnv('FIRECRAWL_API_URL', `http://127.0.0.1:${port}`);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  const read = () =>
    new FirecrawlService(
      new ConfigService({ FIRECRAWL_API_KEY: 'test-only-key' }),
    ).read('https://example.com/', {
      timeoutMs: 1_000,
      maxResults: 1,
      domains: ['example.com'],
      signal: AbortSignal.timeout(2_000),
    });

  it('sends one request through the real SDK and returns normalized content', async () => {
    await expect(read()).resolves.toEqual([
      {
        title: 'Example Domain',
        url: 'https://example.com/',
        content: '# Example Domain',
      },
    ]);
    expect(requests).toBe(1);
  });

  it('does not retry a failed request', async () => {
    status = 502;
    await expect(read()).rejects.toMatchObject({ status: 502 });
    expect(requests).toBe(1);
  });
});
