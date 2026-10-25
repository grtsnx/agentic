import { WorkspaceModule } from '@/modules';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '@/config';
import { OpenaiModule } from '@/lib';
import { CliService } from './cli.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    OpenaiModule,
    WorkspaceModule,
  ],
  providers: [CliService],
})
export class CliModule {}
