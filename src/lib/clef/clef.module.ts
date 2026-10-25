import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClefService } from './clef.service.js';
@Module({
  imports: [ConfigModule],
  providers: [ClefService],
  exports: [ClefService],
})
export class ClefModule {}
