import { HttpStatus } from '@nestjs/common';
import { mapProviderError } from '@/lib/openai/provider-error.js';

describe('mapProviderError', () => {
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
