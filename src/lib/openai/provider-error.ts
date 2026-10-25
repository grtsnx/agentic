import { HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import { ApplicationException } from '@/middleware/errors/application.exception.js';

type ErrorRecord = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

export function mapProviderError(cause: unknown): ApplicationException {
  if (cause instanceof ApplicationException) return cause;
  if (cause instanceof ZodError) {
    return new ApplicationException(
      'PROVIDER_INVALID_RESPONSE',
      'The AI provider returned an invalid response.',
      HttpStatus.BAD_GATEWAY,
      true,
    );
  }

  const chain: ErrorRecord[] = [];
  let current: unknown = cause;
  while (current && typeof current === 'object' && chain.length < 5) {
    const error = current as ErrorRecord;
    chain.push(error);
    current = error.cause;
  }
  const status = chain
    .map((error) => error.status)
    .find((value): value is number => typeof value === 'number');
  const code = chain
    .map((error) => (typeof error.code === 'string' ? error.code : ''))
    .join(' ')
    .toLowerCase();
  const name = chain
    .map((error) => (typeof error.name === 'string' ? error.name : ''))
    .join(' ')
    .toLowerCase();
  const message = chain
    .map((error) => (typeof error.message === 'string' ? error.message : ''))
    .join(' ')
    .toLowerCase();

  if (status === 401 || status === 403 || code.includes('auth')) {
    return new ApplicationException(
      'PROVIDER_AUTHENTICATION_FAILED',
      'The AI provider could not authenticate this application.',
      HttpStatus.BAD_GATEWAY,
      false,
    );
  }
  if (status === 429 || code.includes('rate_limit')) {
    return new ApplicationException(
      'PROVIDER_RATE_LIMITED',
      'The AI provider is temporarily rate limited.',
      HttpStatus.TOO_MANY_REQUESTS,
      true,
    );
  }
  if (
    status === 408 ||
    code.includes('timeout') ||
    name.includes('abort') ||
    name.includes('timeout')
  ) {
    return new ApplicationException(
      'PROVIDER_TIMEOUT',
      'The AI provider did not respond before the configured timeout.',
      HttpStatus.GATEWAY_TIMEOUT,
      true,
    );
  }
  if (
    (status !== undefined && status >= 500) ||
    message.includes('connection error') ||
    /econn(?:reset|refused|aborted)|enotfound|eai_again/.test(code)
  ) {
    return new ApplicationException(
      'PROVIDER_UNAVAILABLE',
      'The AI provider is temporarily unavailable.',
      HttpStatus.SERVICE_UNAVAILABLE,
      true,
    );
  }
  return new ApplicationException(
    'PROVIDER_FAILURE',
    'The AI provider request failed.',
    HttpStatus.BAD_GATEWAY,
    true,
  );
}
