import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { REFERO_MCP_URL } from '../config/mcps.config';

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(private readonly config: ConfigService) {}

  async getOrCreate(client: Anthropic): Promise<string> {
    const existingId = this.config.get('ANTHROPIC_VAULT_ID');
    if (existingId) {
      this.logger.log(`Reusing vault → ${existingId}`);
      return existingId;
    }
    const vault = await (client.beta.vaults as any).create({
      name: 'Builder Vault',
      description:
        'Credentials for InsForge, Coolify, Higgsfield, Unsplash, R2, payments, email',
    });
    this.logger.log(`Vault created → ${vault.id}`);
    return vault.id;
  }

  async addCredentials(client: Anthropic, vaultId: string): Promise<void> {
    const credentials = [
      {
        name: 'InsForge API Key',
        envKey: 'INSFORGE_API_KEY',
        hosts: ['insforge.blydr.ai', '*.insforge.dev'],
      },
      {
        name: 'Coolify API Token',
        envKey: 'COOLIFY_API_TOKEN',
        hosts: ['cloud2.blydr.ai'],
      },
      {
        name: 'Unsplash Access Key',
        envKey: 'UNSPLASH_ACCESS_KEY',
        hosts: ['api.unsplash.com'],
      },
      {
        name: 'Cloudflare R2 Access Key',
        envKey: 'R2_ACCESS_KEY_ID',
        hosts: ['*.r2.cloudflarestorage.com'],
      },
      {
        name: 'Cloudflare R2 Secret Key',
        envKey: 'R2_SECRET_ACCESS_KEY',
        hosts: ['*.r2.cloudflarestorage.com'],
      },
      {
        name: 'Resend API Key',
        envKey: 'RESEND_API_KEY',
        hosts: ['api.resend.com'],
      },
      {
        name: 'Stripe Secret Key',
        envKey: 'STRIPE_SECRET_KEY',
        hosts: ['api.stripe.com'],
      },
      {
        name: 'Lemon Squeezy API Key',
        envKey: 'LEMONSQUEEZY_API_KEY',
        hosts: ['api.lemonsqueezy.com'],
      },
      {
        name: 'Paddle API Key',
        envKey: 'PADDLE_API_KEY',
        hosts: ['api.paddle.com'],
      },
      {
        name: 'Paystack Secret Key',
        envKey: 'PAYSTACK_SECRET_KEY',
        hosts: ['api.paystack.co'],
      },
      {
        name: 'PayPal Client Secret',
        envKey: 'PAYPAL_CLIENT_SECRET',
        hosts: ['api.paypal.com', 'api.sandbox.paypal.com'],
      },
      // Optional — only if key exists
      ...(this.config.get('HIGGSFIELD_API_KEY')
        ? [
            {
              name: 'Higgsfield API Key',
              envKey: 'HIGGSFIELD_API_KEY',
              hosts: ['api.higgsfield.ai'],
            },
          ]
        : []),
    ];

    for (const cred of credentials) {
      const value = this.config.get<string>(cred.envKey);
      if (!value) {
        this.logger.warn(`Skipping ${cred.name} — ${cred.envKey} not in env`);
        continue;
      }
      try {
        await (client.beta.vaults as any).credentials.create(vaultId, {
          display_name: cred.name,
          auth: {
            type: 'environment_variable',
            secret_name: cred.envKey,
            secret_value: value,
            networking: { type: 'limited', allowed_hosts: cred.hosts },
          },
        });
        this.logger.log(`✅ Credential: ${cred.name}`);
      } catch (err: any) {
        if (err?.status === 409) {
          this.logger.warn(`Already exists: ${cred.name}`);
        } else throw err;
      }
    }

    await this.addReferoCredential(client, vaultId);
  }

  /**
   * Refero MCP authenticates with a static bearer token bound to its MCP server
   * URL (not host-substituted env var). Optional — skipped when no key is set.
   */
  private async addReferoCredential(
    client: Anthropic,
    vaultId: string,
  ): Promise<void> {
    const token = this.config.get<string>('REFERO_API_KEY');
    if (!token) {
      this.logger.warn('Skipping Refero — REFERO_API_KEY not in env');
      return;
    }
    try {
      await (client.beta.vaults as any).credentials.create(vaultId, {
        display_name: 'Refero MCP Token',
        auth: {
          type: 'static_bearer',
          token,
          mcp_server_url: this.config.get('REFERO_MCP_URL', REFERO_MCP_URL),
        },
      });
      this.logger.log('✅ Credential: Refero MCP Token');
    } catch (err: any) {
      if (err?.status === 409) {
        this.logger.warn('Already exists: Refero MCP Token');
      } else throw err;
    }
  }
}
