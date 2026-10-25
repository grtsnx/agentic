import { ConfigService } from '@nestjs/config';
import { ClefService } from '@/lib/clef/clef.service.js';

const settings = {
  CLEF_ROUTING_ENABLED: true,
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  CLOUDFLARE_API_TOKEN: 'test-secret',
  CLEF_ROUTING_TIMEOUT_MS: 100,
  CLEF_ROUTING_CONFIDENCE: 0.75,
};
const answer = (probability: unknown) =>
  new Response(
    JSON.stringify({
      success: true,
      result: { answers: { needs_complex: probability } },
    }),
    { status: 200 },
  );

describe('optional Clef routing', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not contact Cloudflare when disabled', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await new ClefService(
      new ConfigService({ ...settings, CLEF_ROUTING_ENABLED: false }),
    ).route('Debug this');
    expect(result).toMatchObject({
      model: 'gpt-6-luna',
      source: 'local',
      reason: 'disabled',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [0.1, 'gpt-5-nano'],
    [0.9, 'gpt-6-luna'],
  ])(
    'maps probability %s only to allowed models',
    async (probability, model) => {
      const fetch = vi.fn().mockResolvedValue(answer(probability));
      vi.stubGlobal('fetch', fetch);
      const result = await new ClefService(new ConfigService(settings)).route(
        'Question',
        { recentUserMessages: ['Earlier question'], hasAttachments: true },
      );
      expect(result).toMatchObject({
        model,
        source: 'clef',
        reason: 'classified',
        probability,
        estimatedCostUsd: null,
      });
      const [url, request] = fetch.mock.calls[0]!;
      expect(url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/' +
          settings.CLOUDFLARE_ACCOUNT_ID +
          '/ai/run/@cf/cloudflare/clef-flash',
      );
      expect(request.redirect).toBe('error');
      expect(JSON.parse(request.body).state.hasAttachments).toBe(true);
      expect(JSON.parse(request.body).questions.needs_complex.type).toBe(
        'noul',
      );
      expect(JSON.stringify(result)).not.toContain('test-secret');
    },
  );
  it('uses bounded input and falls back when confidence is low', async () => {
    const fetch = vi.fn().mockResolvedValue(answer(0.5));
    vi.stubGlobal('fetch', fetch);
    const result = await new ClefService(new ConfigService(settings)).route(
      'Debug this' + 'x'.repeat(10000),
      { recentUserMessages: Array(20).fill('y'.repeat(5000)) },
    );
    expect(result).toMatchObject({
      source: 'local',
      reason: 'uncertain',
      model: 'gpt-6-luna',
    });
    const state = JSON.parse(fetch.mock.calls[0]![1].body).state;
    expect(state.message.length).toBeLessThanOrEqual(8000);
    expect(state.recentUserMessages.length).toBeLessThanOrEqual(6);
    expect(
      state.recentUserMessages.every((value: string) => value.length <= 1000),
    ).toBe(true);
  });
  it.each([401, 429, 503])(
    'falls back on HTTP %s without retrying',
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response('provider secret', { status }));
      vi.stubGlobal('fetch', fetch);
      expect(
        await new ClefService(new ConfigService(settings)).route('Hello'),
      ).toMatchObject({
        source: 'local',
        reason: 'provider_error',
        model: 'gpt-5-nano',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['0.9', 2, null])(
    'rejects malformed probability %s',
    async (probability) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(probability)));
      expect(
        await new ClefService(new ConfigService(settings)).route('Debug this'),
      ).toMatchObject({ source: 'local', reason: 'invalid_response' });
    },
  );
  it('falls back on oversized responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(' '.repeat(40000))),
    );
    expect(
      await new ClefService(new ConfigService(settings)).route('Hello'),
    ).toMatchObject({ reason: 'invalid_response' });
  });
  it('enforces the classifier deadline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, request) =>
          new Promise((_resolve, reject) =>
            request.signal.addEventListener('abort', () =>
              reject(request.signal.reason),
            ),
          ),
      ),
    );
    expect(
      await new ClefService(new ConfigService(settings)).route('Debug this'),
    ).toMatchObject({ reason: 'timeout', model: 'gpt-6-luna' });
  });
  it('propagates cancellation instead of continuing with a fallback', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      new ClefService(new ConfigService(settings)).route(
        'Hello',
        {},
        controller.signal,
      ),
    ).rejects.toThrow('cancelled');
    expect(fetch).not.toHaveBeenCalled();
  });
});
