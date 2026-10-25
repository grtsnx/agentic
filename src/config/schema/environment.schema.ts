import { z } from 'zod';

const environments = ['development', 'production', 'test'] as const;
const voiceProviders = ['livekit', 'openai'] as const;

const booleanValue = (name: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value !== 'string') return value;

      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'off', 'no'].includes(normalized)) return false;
      return value;
    },
    z.boolean({ error: `${name} must be a boolean` }),
  );

function corsOrigins(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(',');
  const origins = values
    .map(String)
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.username !== '' ||
      url.password !== ''
    ) {
      throw new Error(
        `CORS_ORIGINS must contain exact http(s) origins without paths: ${origin}`,
      );
    }
  }

  return [...new Set(origins)];
}

function domainNames(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(',');
  const domains = [
    ...new Set(
      values
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];

  if (
    domains.length > 100 ||
    domains.some(
      (domain) =>
        domain.length > 253 ||
        !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(
          domain,
        ),
    )
  ) {
    throw new Error(
      'WEB_SEARCH_ALLOWED_DOMAINS must contain at most 100 domain names without schemes or paths',
    );
  }

  return domains.map((domain) => domain.toLowerCase());
}

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(environments).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    PLATFORM_NAME: z.string().trim().min(1).default('Agentic'),
    CORS_ORIGINS: z.unknown().optional(),
    OBSERVE_ENABLED: booleanValue('OBSERVE_ENABLED').optional(),
    OBSERVE_APP_KEY: z.string().trim().optional(),
    OBSERVE_APP_SECRET: z.string().trim().optional(),
    OBSERVE_SERVICE_ID: z.string().trim().optional(),
    SWAGGER_ENABLED: booleanValue('SWAGGER_ENABLED').optional(),
    REALTIME_PLAYGROUND_ENABLED: booleanValue(
      'REALTIME_PLAYGROUND_ENABLED',
    ).optional(),
    SANDBOX_ENABLED: booleanValue('SANDBOX_ENABLED').default(false),
    VOICE_ENABLED: booleanValue('VOICE_ENABLED').optional(),
    VOICE_PROVIDER: z.enum(voiceProviders).default('livekit'),
    VOICE_MODEL: z.string().trim().min(1).default('gpt-realtime-2.1-mini'),
    VOICE_NAME: z.string().trim().min(1).default('marin'),
    LIVEKIT_URL: z.string().trim().optional(),
    LIVEKIT_API_KEY: z.string().trim().optional(),
    LIVEKIT_API_SECRET: z.string().trim().optional(),
    LIVEKIT_AGENT_NAME: z.string().trim().min(1).default('agentic-voice'),
    LIVEKIT_PHONE_NUMBER: z
      .string()
      .trim()
      .regex(/^$|^\+[1-9]\d{6,14}$/, 'Use an international E.164 phone number')
      .optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    CLEF_ROUTING_ENABLED: booleanValue('CLEF_ROUTING_ENABLED').default(false),
    CLOUDFLARE_ACCOUNT_ID: z
      .string()
      .trim()
      .regex(
        /^$|^[a-f\d]{32}$/i,
        'CLOUDFLARE_ACCOUNT_ID must be a 32-character account ID',
      )
      .optional(),
    CLOUDFLARE_API_TOKEN: z.string().trim().optional(),
    CLEF_ROUTING_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(5000)
      .default(1500),
    CLEF_ROUTING_CONFIDENCE: z.coerce.number().min(0.6).max(0.99).default(0.75),
    MODEL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(60_000),
    WEB_SEARCH_ENABLED: booleanValue('WEB_SEARCH_ENABLED').default(true),
    WEB_SEARCH_ALLOWED_DOMAINS: z.unknown().optional(),
    CONTEXT_DEV_ENABLED: booleanValue('CONTEXT_DEV_ENABLED').default(false),
    CONTEXT_DEV_API_KEY: z.string().trim().optional(),
    FIRECRAWL_ENABLED: booleanValue('FIRECRAWL_ENABLED').default(false),
    FIRECRAWL_API_KEY: z.string().trim().optional(),
    VALYU_ENABLED: booleanValue('VALYU_ENABLED').default(false),
    VALYU_API_KEY: z.string().trim().optional(),
    EXTERNAL_TOOLS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(15_000),
    EXTERNAL_TOOLS_MAX_CALLS: z.coerce.number().int().min(1).max(20).default(5),
    EXTERNAL_TOOLS_MAX_RESULTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5),
    EXTERNAL_TOOLS_MAX_CHARS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(30_000)
      .default(12_000),
    SESSION_TTL_MS: z.coerce
      .number()
      .int()
      .min(1)
      .max(86_400_000)
      .default(1_800_000),
    SESSION_MAX_TURNS: z.coerce.number().int().min(1).max(1_000).default(50),
    SESSION_MAX_TOKENS: z.coerce
      .number()
      .int()
      .min(100)
      .max(1_000_000)
      .default(32_000),
  })
  .superRefine((environment, context) => {
    for (const provider of ['CONTEXT_DEV', 'FIRECRAWL', 'VALYU'] as const) {
      if (
        environment[`${provider}_ENABLED`] &&
        !environment[`${provider}_API_KEY`]
      ) {
        context.addIssue({
          code: 'custom',
          message: `${provider}_API_KEY is required when ${provider}_ENABLED is true`,
          path: [`${provider}_API_KEY`],
        });
      }
    }
    if (environment.CLEF_ROUTING_ENABLED) {
      for (const key of [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
      ] as const) {
        if (!environment[key])
          context.addIssue({
            code: 'custom',
            message: key + ' is required when CLEF_ROUTING_ENABLED is true',
            path: [key],
          });
      }
    }
    if (environment.OBSERVE_ENABLED) {
      for (const key of [
        'OBSERVE_APP_KEY',
        'OBSERVE_APP_SECRET',
        'OBSERVE_SERVICE_ID',
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            message: `${key} is required when OBSERVE_ENABLED is true`,
            path: [key],
          });
        }
      }
    }

    if (!environment.VOICE_ENABLED) return;

    for (const key of [
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
    ] as const) {
      if (!environment[key]) {
        context.addIssue({
          code: 'custom',
          message: `${key} is required when VOICE_ENABLED is true`,
          path: [key],
        });
      }
    }

    if (
      environment.LIVEKIT_URL &&
      !/^wss?:\/\/[a-z\d.-]+(?::\d+)?\/?$/i.test(environment.LIVEKIT_URL)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'LIVEKIT_URL must be an exact ws(s) server URL',
        path: ['LIVEKIT_URL'],
      });
    }

    if (
      environment.VOICE_PROVIDER === 'openai' &&
      !environment.OPENAI_API_KEY
    ) {
      context.addIssue({
        code: 'custom',
        message: 'OPENAI_API_KEY is required when VOICE_PROVIDER is openai',
        path: ['OPENAI_API_KEY'],
      });
    }
  })
  .transform((parsed) => ({
    ...parsed,
    CORS_ORIGINS: corsOrigins(parsed.CORS_ORIGINS),
    WEB_SEARCH_ALLOWED_DOMAINS: domainNames(parsed.WEB_SEARCH_ALLOWED_DOMAINS),
    OBSERVE_ENABLED: parsed.OBSERVE_ENABLED ?? false,
    SWAGGER_ENABLED: parsed.SWAGGER_ENABLED ?? parsed.NODE_ENV !== 'production',
    REALTIME_PLAYGROUND_ENABLED:
      parsed.REALTIME_PLAYGROUND_ENABLED ?? parsed.NODE_ENV !== 'production',
    VOICE_ENABLED: parsed.VOICE_ENABLED ?? false,
  }));

// Keep the validated runtime type in sync with the schema.
