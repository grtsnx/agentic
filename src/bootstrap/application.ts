import {
  ConsoleLogger,
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from '@/app';
import { type Environment } from '@/config';
import { RequestIdMiddleware } from '@/middleware';
import { SecureSocketIoAdapter } from './socket-io.adapter.js';
import { configureSwagger } from './swagger.js';

export function configureApplication(
  app: INestApplication,
  environment: Environment,
): void {
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.useSecurityHeaders({
    contentSecurityPolicy: {
      directives: {
        connectSrc: liveKitConnectSources(environment),
        ...(environment.NODE_ENV === 'production'
          ? {}
          : { upgradeInsecureRequests: null }),
      },
    },
  });
  app.enableCsrfProtection({ trustedOrigins: environment.CORS_ORIGINS });
  app.enableVersioning({ type: VersioningType.URI });
  app.enableShutdownHooks();
  app.useWebSocketAdapter(
    new SecureSocketIoAdapter(app, environment.CORS_ORIGINS),
  );

  if (environment.CORS_ORIGINS.length > 0) {
    app.enableCors({
      origin: environment.CORS_ORIGINS,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Request-ID',
      ],
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: environment.NODE_ENV === 'production',
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  configureSwagger(app, environment);
}

function liveKitConnectSources(environment: Environment): string[] {
  const sources = ["'self'"];
  if (!environment.VOICE_ENABLED || !environment.LIVEKIT_URL) return sources;

  const liveKitUrl = new URL(environment.LIVEKIT_URL);
  if (liveKitUrl.hostname.endsWith('.livekit.cloud')) {
    // Cloud region discovery uses HTTPS before signaling switches to WSS.
    return [...sources, 'https://*.livekit.cloud', 'wss://*.livekit.cloud'];
  }

  const webUrl = new URL(liveKitUrl);
  webUrl.protocol = liveKitUrl.protocol === 'wss:' ? 'https:' : 'http:';
  return [...sources, webUrl.origin, liveKitUrl.origin];
}

export async function createApplication(): Promise<{
  app: INestApplication;
  environment: Environment;
}> {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({
      json: true,
      logLevels: ['warn', 'error', 'fatal'],
    }),
  });
  const config = app.get(ConfigService);
  const environment: Environment = {
    NODE_ENV: config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV'),
    PORT: config.getOrThrow<number>('PORT'),
    PLATFORM_NAME: config.getOrThrow<string>('PLATFORM_NAME'),
    CORS_ORIGINS: config.getOrThrow<string[]>('CORS_ORIGINS'),
    OBSERVE_ENABLED: config.getOrThrow<boolean>('OBSERVE_ENABLED'),
    OBSERVE_APP_KEY: config.get<string>('OBSERVE_APP_KEY'),
    OBSERVE_APP_SECRET: config.get<string>('OBSERVE_APP_SECRET'),
    OBSERVE_SERVICE_ID: config.get<string>('OBSERVE_SERVICE_ID'),
    SWAGGER_ENABLED: config.getOrThrow<boolean>('SWAGGER_ENABLED'),
    REALTIME_PLAYGROUND_ENABLED: config.getOrThrow<boolean>(
      'REALTIME_PLAYGROUND_ENABLED',
    ),
    SANDBOX_ENABLED: config.getOrThrow<boolean>('SANDBOX_ENABLED'),
    VOICE_ENABLED: config.getOrThrow<boolean>('VOICE_ENABLED'),
    VOICE_PROVIDER:
      config.getOrThrow<Environment['VOICE_PROVIDER']>('VOICE_PROVIDER'),
    VOICE_MODEL: config.getOrThrow<string>('VOICE_MODEL'),
    VOICE_NAME: config.getOrThrow<string>('VOICE_NAME'),
    LIVEKIT_URL: config.get<string>('LIVEKIT_URL'),
    LIVEKIT_API_KEY: config.get<string>('LIVEKIT_API_KEY'),
    LIVEKIT_API_SECRET: config.get<string>('LIVEKIT_API_SECRET'),
    LIVEKIT_AGENT_NAME: config.getOrThrow<string>('LIVEKIT_AGENT_NAME'),
    LIVEKIT_PHONE_NUMBER: config.get<string>('LIVEKIT_PHONE_NUMBER'),
    OPENAI_API_KEY: config.get<string>('OPENAI_API_KEY'),
    MODEL_TIMEOUT_MS: config.getOrThrow<number>('MODEL_TIMEOUT_MS'),
    WEB_SEARCH_ENABLED: config.getOrThrow<boolean>('WEB_SEARCH_ENABLED'),
    WEB_SEARCH_ALLOWED_DOMAINS: config.getOrThrow<string[]>(
      'WEB_SEARCH_ALLOWED_DOMAINS',
    ),
    SESSION_TTL_MS: config.getOrThrow<number>('SESSION_TTL_MS'),
    CONTEXT_DEV_ENABLED: config.getOrThrow<boolean>('CONTEXT_DEV_ENABLED'),
    CONTEXT_DEV_API_KEY: config.get<string>('CONTEXT_DEV_API_KEY'),
    FIRECRAWL_ENABLED: config.getOrThrow<boolean>('FIRECRAWL_ENABLED'),
    FIRECRAWL_API_KEY: config.get<string>('FIRECRAWL_API_KEY'),
    VALYU_ENABLED: config.getOrThrow<boolean>('VALYU_ENABLED'),
    VALYU_API_KEY: config.get<string>('VALYU_API_KEY'),
    EXTERNAL_TOOLS_TIMEOUT_MS: config.getOrThrow<number>(
      'EXTERNAL_TOOLS_TIMEOUT_MS',
    ),
    EXTERNAL_TOOLS_MAX_CALLS: config.getOrThrow<number>(
      'EXTERNAL_TOOLS_MAX_CALLS',
    ),
    EXTERNAL_TOOLS_MAX_RESULTS: config.getOrThrow<number>(
      'EXTERNAL_TOOLS_MAX_RESULTS',
    ),
    EXTERNAL_TOOLS_MAX_CHARS: config.getOrThrow<number>(
      'EXTERNAL_TOOLS_MAX_CHARS',
    ),
    SESSION_MAX_TURNS: config.getOrThrow<number>('SESSION_MAX_TURNS'),
    SESSION_MAX_TOKENS: config.getOrThrow<number>('SESSION_MAX_TOKENS'),
  };
  configureApplication(app, environment);
  return { app, environment };
}
