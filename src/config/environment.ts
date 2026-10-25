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

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(environments).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
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
    VOICE_ENABLED: booleanValue('VOICE_ENABLED').optional(),
    VOICE_PROVIDER: z.enum(voiceProviders).default('livekit'),
    VOICE_MODEL: z.string().trim().min(1).default('gpt-realtime-2.1'),
    VOICE_NAME: z.string().trim().min(1).default('marin'),
    LIVEKIT_URL: z.string().trim().optional(),
    LIVEKIT_API_KEY: z.string().trim().optional(),
    LIVEKIT_API_SECRET: z.string().trim().optional(),
    LIVEKIT_AGENT_NAME: z.string().trim().min(1).default('agentic-voice'),
    OPENAI_API_KEY: z.string().trim().optional(),
  })
  .superRefine((environment, context) => {
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
  });

export interface Environment {
  NODE_ENV: (typeof environments)[number];
  PORT: number;
  PLATFORM_NAME: string;
  CORS_ORIGINS: string[];
  OBSERVE_ENABLED: boolean;
  OBSERVE_APP_KEY?: string;
  OBSERVE_APP_SECRET?: string;
  OBSERVE_SERVICE_ID?: string;
  SWAGGER_ENABLED: boolean;
  REALTIME_PLAYGROUND_ENABLED: boolean;
  VOICE_ENABLED: boolean;
  VOICE_PROVIDER: (typeof voiceProviders)[number];
  VOICE_MODEL: string;
  VOICE_NAME: string;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_AGENT_NAME: string;
  OPENAI_API_KEY?: string;
}

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  const parsed = environmentSchema.parse(values);
  return {
    ...parsed,
    CORS_ORIGINS: corsOrigins(parsed.CORS_ORIGINS),
    OBSERVE_ENABLED: parsed.OBSERVE_ENABLED ?? false,
    SWAGGER_ENABLED: parsed.SWAGGER_ENABLED ?? parsed.NODE_ENV !== 'production',
    REALTIME_PLAYGROUND_ENABLED:
      parsed.REALTIME_PLAYGROUND_ENABLED ?? parsed.NODE_ENV !== 'production',
    VOICE_ENABLED: parsed.VOICE_ENABLED ?? false,
  };
}
