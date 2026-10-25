import { Module } from '@nestjs/common';
import { ChatkitAdapterService } from './chatkit.service.js';

@Module({
  providers: [ChatkitAdapterService],
  exports: [ChatkitAdapterService],
})
export class ChatkitAdapterModule {}
