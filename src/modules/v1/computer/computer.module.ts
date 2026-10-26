import { Module } from '@nestjs/common';
import { BrowserModule, MacosModule } from '@/lib';
import { ComputerService } from './computer.service.js';
@Module({
  imports: [BrowserModule, MacosModule],
  providers: [ComputerService],
  exports: [ComputerService],
})
export class ComputerModule {}
