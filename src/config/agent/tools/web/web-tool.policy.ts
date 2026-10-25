import { isIP } from 'node:net';
import { ZodError } from 'zod';

const errors = {
  TOOL_DISABLED: ['This optional tool is not configured.', false],
  TOOL_LIMIT_REACHED: ['The external tool call limit has been reached.', false],
  TOOL_INPUT_INVALID: [
    'Use a valid query or an allowed public HTTP(S) page URL.',
    false,
  ],
  TOOL_AUTHENTICATION_FAILED: [
    'The tool provider credentials were rejected.',
    false,
  ],
  TOOL_RATE_LIMITED: [
    'The tool provider is rate limited. Try again later.',
    true,
  ],
  TOOL_TIMEOUT: ['The tool request exceeded its time limit.', true],
  TOOL_CANCELLED: ['The tool request was cancelled.', false],
  TOOL_INVALID_RESPONSE: [
    'The tool provider returned an invalid response.',
    true,
  ],
  TOOL_UNAVAILABLE: [
    'The tool provider is unavailable. Try again later.',
    true,
  ],
} as const;

export class WebToolError extends Error {
  constructor(readonly code: keyof typeof errors) {
    super(code);
  }
}

export function webToolFailure(error: unknown) {
  let code: keyof typeof errors = 'TOOL_UNAVAILABLE';
  if (error instanceof WebToolError) code = error.code;
  else if (error instanceof ZodError) code = 'TOOL_INVALID_RESPONSE';
  else if (error && typeof error === 'object') {
    const failure = error as {
      status?: number;
      statusCode?: number;
      response?: { status?: number };
      name?: string;
      code?: string;
    };
    const status =
      failure.status ?? failure.statusCode ?? failure.response?.status;
    if (status === 401 || status === 403) code = 'TOOL_AUTHENTICATION_FAILED';
    else if (status === 429) code = 'TOOL_RATE_LIMITED';
    else if (
      status === 408 ||
      status === 504 ||
      failure.name === 'TimeoutError' ||
      failure.name === 'APIConnectionTimeoutError' ||
      ['ETIMEDOUT', 'ECONNABORTED'].includes(failure.code ?? '')
    )
      code = 'TOOL_TIMEOUT';
    else if (failure.name === 'AbortError') code = 'TOOL_CANCELLED';
  }
  const [message, retryable] = errors[code];
  return { ok: false as const, error: { code, message, retryable } };
}

export function publicPageUrl(
  value: string,
  domains: string[],
): URL | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // Tools read public websites only. Reject literal IPs, credentials and local names.
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      isIP(host.replace(/^\[|\]$/g, '')) ||
      !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) ||
      host.endsWith('.')
    )
      return;
    if (
      domains.length &&
      !domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    )
      return;
    url.hash = '';
    return url;
  } catch {
    return;
  }
}

export async function withinToolDeadline<T>(
  signal: AbortSignal,
  action: () => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  // Some SDKs cannot cancel their HTTP request. Stop waiting and discard late data.
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([aborted, action()]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
