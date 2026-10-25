const sdk = vi.hoisted(() => ({
  context: vi.fn(),
  scrape: vi.fn(),
  valyu: vi.fn(),
  contextOptions: vi.fn(),
  firecrawlOptions: vi.fn(),
  valyuOptions: vi.fn(),
}));
vi.mock('context.dev', () => ({
  default: class {
    web = { search: sdk.context };
    constructor(options: unknown) {
      sdk.contextOptions(options);
    }
  },
}));
vi.mock('firecrawl', () => ({
  Firecrawl: class {
    scrape = sdk.scrape;
    constructor(options: unknown) {
      sdk.firecrawlOptions(options);
    }
  },
}));
vi.mock('valyu-js', () => ({
  Valyu: class {
    search = sdk.valyu;
    constructor(...options: unknown[]) {
      sdk.valyuOptions(...options);
    }
  },
}));

import { validateEnvironment } from '@/config/environment.js';
import { WebToolsService } from '@/config/web-tools';
import { publicPageUrl } from '@/config/web-tools/web-tool.policy.js';

const enabled = {
  CONTEXT_DEV_ENABLED: true,
  CONTEXT_DEV_API_KEY: 'test-context',
  FIRECRAWL_ENABLED: true,
  FIRECRAWL_API_KEY: 'test-firecrawl',
  VALYU_ENABLED: true,
  VALYU_API_KEY: 'test-valyu',
};
function registry(settings: Record<string, unknown> = {}) {
  return WebToolsService.fromEnvironment({
    ...validateEnvironment({ ...enabled, ...settings }),
  });
}

describe('optional external tools', () => {
  beforeEach(() => vi.resetAllMocks());

  it('registers no tools or SDK clients by default, even when a key is present', () => {
    const service = WebToolsService.fromEnvironment({
      ...validateEnvironment({ CONTEXT_DEV_API_KEY: 'unused' }),
    });
    expect(service.createTools()).toEqual([]);
    expect(sdk.contextOptions).not.toHaveBeenCalled();
    expect(sdk.firecrawlOptions).not.toHaveBeenCalled();
    expect(sdk.valyuOptions).not.toHaveBeenCalled();
  });

  it.each(['CONTEXT_DEV', 'FIRECRAWL', 'VALYU'])(
    'requires a key only when %s is enabled',
    (provider) => {
      expect(() =>
        validateEnvironment({ [`${provider}_ENABLED`]: true }),
      ).toThrow(`${provider}_API_KEY`);
      expect(() =>
        validateEnvironment({ [`${provider}_ENABLED`]: false }),
      ).not.toThrow();
    },
  );

  it('uses the Context.dev SDK with limits and filters unsafe or out-of-scope sources', async () => {
    sdk.context.mockResolvedValue({
      results: [
        {
          title: 'Source',
          url: 'https://docs.example.com/guide',
          description: 'x'.repeat(1_500),
        },
        {
          title: 'Duplicate',
          url: 'https://docs.example.com/guide#heading',
          description: 'duplicate',
        },
        {
          title: 'Outside',
          url: 'https://example.com.attacker.net/',
          description: 'ignored',
        },
        { title: 'Local', url: 'http://127.0.0.1/', description: 'ignored' },
      ],
      apiKey: 'must-not-leak',
    });
    const sources = vi.fn();
    const tools = registry({
      WEB_SEARCH_ALLOWED_DOMAINS: 'example.com',
      EXTERNAL_TOOLS_MAX_CHARS: 1_000,
    }).createTools(sources);
    const result = await tools[0]!.execute({ input: 'a query' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected sources');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      content: 'x'.repeat(1_000),
      truncated: true,
    });
    expect(sources).toHaveBeenCalledWith([
      {
        title: 'Source',
        url: 'https://docs.example.com/guide',
        domain: 'docs.example.com',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(sdk.context).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'a query',
        numResults: 5,
        includeDomains: ['example.com'],
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(sdk.contextOptions).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0, timeout: 15_000 }),
    );
  });

  it('reads one public page with Firecrawl and does not auto-resume or retry', async () => {
    sdk.scrape.mockResolvedValue({
      markdown: '# Reference',
      metadata: { title: 'Reference' },
    });
    const tool = registry().createTools()[1]!;
    const result = await tool.execute({ input: 'https://example.com/guide' });
    expect(result).toMatchObject({
      ok: true,
      provider: 'firecrawl',
      contentTrust: 'untrusted',
      results: [
        {
          title: 'Reference',
          url: 'https://example.com/guide',
          content: '# Reference',
        },
      ],
    });
    expect(sdk.scrape).toHaveBeenCalledWith('https://example.com/guide', {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 15_000,
      autoResume: false,
    });
    expect(sdk.firecrawlOptions).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 1, timeoutMs: 15_000 }),
    );
  });

  it('uses bounded Valyu web search without rate-limit retries', async () => {
    sdk.valyu.mockResolvedValue({
      success: true,
      results: [
        {
          title: 'Research',
          url: 'https://example.com/paper',
          content: 'Research summary',
        },
      ],
    });
    const result = await registry({ WEB_SEARCH_ALLOWED_DOMAINS: 'example.com' })
      .createTools()[2]!
      .execute({ input: 'research' });
    expect(result).toMatchObject({
      ok: true,
      provider: 'valyu',
      results: [{ domain: 'example.com' }],
    });
    expect(sdk.valyu).toHaveBeenCalledWith('research', {
      searchType: 'web',
      maxNumResults: 5,
      responseLength: 'short',
      isToolCall: true,
      includedSources: ['example.com'],
    });
    expect(sdk.valyuOptions).toHaveBeenCalledWith('test-valyu', undefined, {
      timeout: 15_000,
      maxRateLimitRetries: 0,
    });
  });

  it.each([
    'http://localhost/a',
    'http://127.0.0.1',
    'http://2130706433',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://192.168.1.1',
    'https://host.internal',
    'file:///etc/passwd',
    'https://user:password@example.com',
    'https://example.com:8000',
  ])('rejects unsafe page URL %s before contacting a provider', async (url) => {
    const result = await registry().createTools()[1]!.execute({ input: url });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TOOL_INPUT_INVALID' },
    });
    expect(sdk.scrape).not.toHaveBeenCalled();
    expect(publicPageUrl(url, [])).toBeUndefined();
  });

  it('enforces the result count and total content budget across pages', async () => {
    sdk.valyu.mockResolvedValue({
      success: true,
      results: Array.from({ length: 4 }, (_, i) => ({
        title: `Source ${i}`,
        url: `https://example.com/${i}`,
        content: 'x'.repeat(600),
      })),
    });
    const result = await registry({
      EXTERNAL_TOOLS_MAX_RESULTS: 2,
      EXTERNAL_TOOLS_MAX_CHARS: 1_000,
    })
      .createTools()[2]!
      .execute({ input: 'query' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected results');
    expect(result.results.map((page) => page.content.length)).toEqual([
      600, 400,
    ]);
  });

  it('reserves a shared budget before parallel calls and isolates separate runs', async () => {
    sdk.context.mockResolvedValue({ results: [] });
    const service = registry({ EXTERNAL_TOOLS_MAX_CALLS: 1 });
    const tools = service.createTools();
    const results = await Promise.all([
      tools[0]!.execute({ input: 'query' }),
      tools[1]!.execute({ input: 'https://example.com' }),
    ]);
    expect(results[0]).toMatchObject({ ok: true });
    expect(results[1]).toMatchObject({
      ok: false,
      error: { code: 'TOOL_LIMIT_REACHED' },
    });
    expect(sdk.scrape).not.toHaveBeenCalled();
    expect(
      await service.createTools()[0]!.execute({ input: 'new run' }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    [401, 'TOOL_AUTHENTICATION_FAILED'],
    [403, 'TOOL_AUTHENTICATION_FAILED'],
    [429, 'TOOL_RATE_LIMITED'],
    [504, 'TOOL_TIMEOUT'],
    [503, 'TOOL_UNAVAILABLE'],
  ])('redacts a provider failure with status %s', async (status, code) => {
    sdk.context.mockRejectedValue({
      status,
      message: 'secret token and provider trace',
    });
    const result = await registry()
      .createTools()[0]!
      .execute({ input: 'query' });
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('maps Valyu failure envelopes and malformed provider responses', async () => {
    sdk.valyu
      .mockResolvedValueOnce({
        success: false,
        error: 'Invalid API key secret',
      })
      .mockResolvedValueOnce({ success: true, results: [{ content: {} }] });
    const tool = registry().createTools()[2]!;
    expect(await tool.execute({ input: 'query' })).toMatchObject({
      ok: false,
      error: { code: 'TOOL_AUTHENTICATION_FAILED' },
    });
    expect(await tool.execute({ input: 'query' })).toMatchObject({
      ok: false,
      error: { code: 'TOOL_INVALID_RESPONSE' },
    });
  });

  it('times out stalled SDK calls and discards late sources', async () => {
    let finish!: (value: unknown) => void;
    sdk.scrape.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const sources = vi.fn();
    const result = await registry({ EXTERNAL_TOOLS_TIMEOUT_MS: 1_000 })
      .createTools(sources)[1]!
      .execute({ input: 'https://example.com' });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TOOL_TIMEOUT' },
    });
    finish({ markdown: 'Late result' });
    await Promise.resolve();
    expect(sources).not.toHaveBeenCalled();
  });

  it('cancels in-flight and pre-aborted requests without leaking late results', async () => {
    const controller = new AbortController();
    sdk.context.mockReturnValue(new Promise(() => {}));
    const tool = registry().createTools()[0]!;
    const pending = tool.execute({ input: 'query' }, controller.signal);
    controller.abort();
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'TOOL_CANCELLED' },
    });
    expect(
      await tool.execute({ input: 'query' }, controller.signal),
    ).toMatchObject({ ok: false, error: { code: 'TOOL_CANCELLED' } });
    expect(sdk.context).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed input without charging the call budget', async () => {
    sdk.context.mockResolvedValue({ results: [] });
    const tool = registry({ EXTERNAL_TOOLS_MAX_CALLS: 1 }).createTools()[0]!;
    expect(
      await tool.execute({ input: '', headers: { Authorization: 'secret' } }),
    ).toMatchObject({ ok: false, error: { code: 'TOOL_INPUT_INVALID' } });
    expect(await tool.execute({ input: 'valid' })).toMatchObject({ ok: true });
  });
});
