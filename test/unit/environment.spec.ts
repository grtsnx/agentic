import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '@/config';

describe('validateEnvironment', () => {
  it('uses secure, stateless defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      PLATFORM_NAME: 'Agentic',
      CORS_ORIGINS: [],
      OBSERVE_ENABLED: false,
      SWAGGER_ENABLED: true,
      VOICE_ENABLED: false,
      VOICE_PROVIDER: 'livekit',
      MODEL_TIMEOUT_MS: 60_000,
      WEB_SEARCH_ALLOWED_DOMAINS: [],
      SESSION_TTL_MS: 1_800_000,
      SESSION_MAX_TURNS: 50,
      SESSION_MAX_TOKENS: 32_000,
    });
  });

  it('normalizes and validates web-search domains', () => {
    expect(
      validateEnvironment({
        WEB_SEARCH_ALLOWED_DOMAINS:
          'docs.example.com, example.org,docs.example.com',
      }).WEB_SEARCH_ALLOWED_DOMAINS,
    ).toEqual(['docs.example.com', 'example.org']);

    expect(() =>
      validateEnvironment({
        WEB_SEARCH_ALLOWED_DOMAINS: 'https://example.com',
      }),
    ).toThrow(/domain names/i);
  });

  it('normalizes and deduplicates CORS origins', () => {
    const environment = validateEnvironment({
      CORS_ORIGINS:
        'https://app.example.com, https://admin.example.com,https://app.example.com',
    });

    expect(environment.CORS_ORIGINS).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('rejects wildcard and path-based CORS origins', () => {
    expect(() => validateEnvironment({ CORS_ORIGINS: '*' })).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() =>
      validateEnvironment({ CORS_ORIGINS: 'https://example.com/app' }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('disables Swagger by default in production', () => {
    expect(
      validateEnvironment({ NODE_ENV: 'production' }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('defaults the realtime playground on outside production', () => {
    expect(
      validateEnvironment({ NODE_ENV: 'development' })
        .REALTIME_PLAYGROUND_ENABLED,
    ).toBe(true);
    expect(
      validateEnvironment({ NODE_ENV: 'production' })
        .REALTIME_PLAYGROUND_ENABLED,
    ).toBe(false);
  });

  it('rejects invalid ports and booleans', () => {
    expect(() => validateEnvironment({ PORT: '0' })).toThrow(/PORT/);
    expect(() => validateEnvironment({ OBSERVE_ENABLED: 'sometimes' })).toThrow(
      /OBSERVE_ENABLED/,
    );
  });

  it('requires complete observability credentials when enabled', () => {
    expect(() => validateEnvironment({ OBSERVE_ENABLED: 'true' })).toThrow(
      /OBSERVE_APP_KEY/,
    );

    expect(
      validateEnvironment({
        OBSERVE_ENABLED: 'true',
        OBSERVE_APP_KEY: 'key',
        OBSERVE_APP_SECRET: 'secret',
        OBSERVE_SERVICE_ID: 'service',
      }).OBSERVE_ENABLED,
    ).toBe(true);
  });

  it('requires LiveKit Cloud credentials when voice is enabled', () => {
    expect(() => validateEnvironment({ VOICE_ENABLED: 'true' })).toThrow(
      /LIVEKIT_URL/,
    );

    expect(
      validateEnvironment({
        VOICE_ENABLED: 'true',
        LIVEKIT_URL: 'wss://agentic.livekit.cloud',
        LIVEKIT_API_KEY: 'key',
        LIVEKIT_API_SECRET: 'secret',
      }),
    ).toMatchObject({
      VOICE_ENABLED: true,
      VOICE_PROVIDER: 'livekit',
      LIVEKIT_AGENT_NAME: 'agentic-voice',
    });
  });

  it('accepts an optional E.164 phone number and rejects unsafe log content', () => {
    expect(
      validateEnvironment({ LIVEKIT_PHONE_NUMBER: '' }).LIVEKIT_PHONE_NUMBER,
    ).toBe('');
    expect(
      validateEnvironment({ LIVEKIT_PHONE_NUMBER: '+12025550123' })
        .LIVEKIT_PHONE_NUMBER,
    ).toBe('+12025550123');
    for (const number of [
      '202-555-0123',
      '+01234567',
      '+12025550123\nFake log',
    ]) {
      expect(() =>
        validateEnvironment({ LIVEKIT_PHONE_NUMBER: number }),
      ).toThrow(/LIVEKIT_PHONE_NUMBER/);
    }
  });

  it('requires an OpenAI key only for the direct OpenAI voice provider', () => {
    const base = {
      VOICE_ENABLED: 'true',
      VOICE_PROVIDER: 'openai',
      LIVEKIT_URL: 'wss://agentic.livekit.cloud',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    };

    expect(() => validateEnvironment(base)).toThrow(/OPENAI_API_KEY/);
    expect(
      validateEnvironment({ ...base, OPENAI_API_KEY: 'openai-key' })
        .VOICE_PROVIDER,
    ).toBe('openai');
  });
});
