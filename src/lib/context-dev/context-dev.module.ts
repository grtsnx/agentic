import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContextDevService } from './context-dev.service.js';

@Module({
  imports: [ConfigModule],
  providers: [ContextDevService],
  exports: [ContextDevService],
})
export class ContextDevModule {}
