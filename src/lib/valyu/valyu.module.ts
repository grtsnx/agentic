import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ValyuService } from './valyu.service.js';

@Module({
  imports: [ConfigModule],
  providers: [ValyuService],
  exports: [ValyuService],
})
export class ValyuModule {}
