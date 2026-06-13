import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);

  constructor(private readonly config: ConfigService) {}

  async getOrCreate(client: Anthropic): Promise<string> {
    // Reuse existing environment if ID is in env
    const existingId = this.config.get('ANTHROPIC_ENVIRONMENT_ID');
    if (existingId) {
      this.logger.log(`Reusing environment → ${existingId}`);
      return existingId;
    }

    // Check if builder-env already exists by name
    const list = await (client.beta.environments as any).list({ limit: 50 });
    const existing = list.data?.find((e: any) => e.name === 'builder-env');
    if (existing) {
      this.logger.log(`Found existing environment → ${existing.id}`);
      return existing.id;
    }

    // Create fresh
    this.logger.log('Creating builder-env...');
    const env = await (client.beta.environments as any).create({
      name: 'builder-env',
      description:
        'JAX AI builder — Next.js generation, Daytona builds, Coolify deploys, InsForge backend',
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    });
    this.logger.log(`Environment created → ${env.id}`);
    return env.id;
  }
}
