import { HttpStatus } from '@nestjs/common';
import { mapProviderError } from '@/config';

describe('mapProviderError', () => {
  it.each([
    { status: 429, code: 'insufficient_quota' },
    { status: 429, type: 'insufficient_quota' },
    { cause: { status: 429, code: 'billing_hard_limit_reached' } },
  ])('does not suggest retrying exhausted provider quota', (cause) => {
    const error = mapProviderError(cause);
    expect(error.code).toBe('PROVIDER_QUOTA_EXCEEDED');
    expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(error.retryable).toBe(false);
  });

  it.each([
    [
      { status: 401 },
      'PROVIDER_AUTHENTICATION_FAILED',
      HttpStatus.BAD_GATEWAY,
      false,
    ],
    [
      { status: 429 },
      'PROVIDER_RATE_LIMITED',
      HttpStatus.TOO_MANY_REQUESTS,
      true,
    ],
    [
      { status: 503 },
      'PROVIDER_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      true,
    ],
    [
      { name: 'AbortError' },
      'PROVIDER_TIMEOUT',
      HttpStatus.GATEWAY_TIMEOUT,
      true,
    ],
  ])(
    'maps provider failures to stable safe errors',
    (cause, code, status, retryable) => {
      const error = mapProviderError(cause);

      expect(error.getStatus()).toBe(status);
      expect(error.code).toBe(code);
      expect(error.retryable).toBe(retryable);
      expect(JSON.stringify(error.getResponse())).not.toContain('api');
    },
  );
});
