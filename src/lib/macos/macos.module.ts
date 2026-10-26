import { Module } from '@nestjs/common';
import { MacosService } from './macos.service.js';
@Module({ providers: [MacosService], exports: [MacosService] })
export class MacosModule {}
