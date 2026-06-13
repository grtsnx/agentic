import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RuntimeModule } from './runtime/runtime.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RuntimeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
