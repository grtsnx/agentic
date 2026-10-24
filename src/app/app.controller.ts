import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { AppService } from './app.service.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('Server')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @ApiOperation({ summary: 'ping server' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: 'Health check' })
  @Get('health')
  @HealthCheck({ swaggerDocumentation: false })
  async check() {
    try {
      const result = await this.health.check([
        () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
        () =>
          this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.95 }),
        () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 1500000000),
      ]);
      return result.details;
    } catch (exception) {
      if (!(exception instanceof ServiceUnavailableException)) {
        throw exception;
      }
      const body = exception.getResponse();
      if (typeof body !== 'object' || body === null || !('details' in body)) {
        throw exception;
      }
      throw new ServiceUnavailableException({
        message: 'Health check failed',
        data: body.details,
      });
    }
  }
}
