import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';
import {
  FileMailTransport,
  FileTemplateEngine,
  MailModule,
} from '@nestjs/mail';
import { ThrottlerModule } from '@nestjs/throttler';
import { ResilienceModule } from '@nestjs/resilience';
import { IdempotencyModule } from '@nestjs/idempotency';
import { WorkflowsModule } from '@nestjs/workflows';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY,
      appSecret: process.env.OBSERVE_APP_SECRET,
      serviceId: process.env.OBSERVE_SERVICE_ID ?? '',
    }),
    MailModule.forRoot({
      // Development: every mail becomes an .eml file in var/mail instead of leaving the machine
      transport: new FileMailTransport({ directory: 'var/mail' }),
      // Mail bodies are HTML files in mail/templates, wrapped in mail/templates/layout.html
      templates: new FileTemplateEngine({
        dir: join(import.meta.dirname, 'mail/templates'),
        layout: 'layout',
        // Development reads the files for every mail, so edits show up without a restart
        cache: process.env.NODE_ENV === 'production',
      }),
      from: process.env.MAIL_FROM ?? 'noreply@example.com',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    ResilienceModule.forRoot({
      defaults: {
        timeout: '5s',
        retry: { attempts: 3, backoff: { delay: '200ms', maxDelay: '2s' } },
      },
      presets: {
        carrier: {
          timeout: '2s',
          retry: { attempts: 2 },
          circuitBreaker: {
            failureRateThreshold: 50,
            minimumCalls: 10,
            openDuration: '30s',
          },
        },
      },
    }),
    IdempotencyModule.forRoot({
      // Runs after guards, so req.user is set. Keys never collide across users.
      // scope: (req: { user?: User }) => req.user?.id,
      scope: (req: any) => req?.headers['x-request-id'],
    }),
    WorkflowsModule.forRoot({
      worker: {
        concurrency: 10, // instances this process executes at once
        leaseDuration: '30s', // how long a crashed process keeps its instances
        shutdownTimeout: '10s', // how long a deploy waits for running steps
      },
    }),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
