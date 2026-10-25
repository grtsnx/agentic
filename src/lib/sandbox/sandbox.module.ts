import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SandboxService } from './sandbox.service.js';
@Module({imports:[ConfigModule],providers:[SandboxService],exports:[SandboxService]})
export class SandboxModule {}
