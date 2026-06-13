import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class PaymentsAgent {
  private readonly logger = new Logger(PaymentsAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Payments Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'Payments Agent',
      description:
        'Scaffolds payment integrations — Stripe, Lemon Squeezy, Paddle, Paystack, PayPal, and custom providers.',
      model: AGENT_MODELS['payments'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '12',
        tier: '2',
        parallel: 'true',
        runs_with: 'schema, cms, email, i18n',
        depends_on: 'design, intent',
        runs_when: 'requiresPayments=true',
      },
      system: `You are the Payments Agent in an AI website and app builder pipeline.
You scaffold complete payment integrations based on IntentSpec.paymentProviders.
Only invoked when IntentSpec.requiresPayments=true.

For EACH provider in paymentProviders, generate the full integration:

STRIPE:
- /lib/payments/stripe/client.ts         — Stripe client singleton
- /lib/payments/stripe/products.ts       — product/price helpers
- /app/api/payments/stripe/checkout/route.ts    — create checkout session
- /app/api/payments/stripe/portal/route.ts      — customer portal
- /app/api/payments/stripe/webhook/route.ts     — handle all webhook events
  Events to handle: checkout.session.completed, customer.subscription.updated,
  customer.subscription.deleted, invoice.payment_failed
- /components/payments/stripe-checkout-button.tsx

LEMON SQUEEZY:
- /lib/payments/lemonsqueezy/client.ts
- /app/api/payments/lemonsqueezy/checkout/route.ts
- /app/api/payments/lemonsqueezy/webhook/route.ts
- /components/payments/lemon-checkout-button.tsx

PADDLE:
- /lib/payments/paddle/client.ts
- /app/api/payments/paddle/checkout/route.ts
- /app/api/payments/paddle/webhook/route.ts
- /components/payments/paddle-checkout-button.tsx

PAYSTACK (African markets):
- /lib/payments/paystack/client.ts
- /app/api/payments/paystack/initialize/route.ts
- /app/api/payments/paystack/verify/route.ts
- /app/api/payments/paystack/webhook/route.ts
- /components/payments/paystack-button.tsx

PAYPAL:
- /lib/payments/paypal/client.ts
- /app/api/payments/paypal/order/route.ts
- /app/api/payments/paypal/capture/route.ts
- /app/api/payments/paypal/webhook/route.ts
- /components/payments/paypal-button.tsx

ALWAYS generate regardless of provider:
- /lib/payments/index.ts              — unified payment interface
- /components/pricing/pricing-table.tsx — pricing page component
- /components/pricing/pricing-card.tsx  — individual plan card
- /hooks/use-subscription.ts           — subscription status hook

Custom provider interface in /lib/payments/index.ts:
export interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>
  handleWebhook(payload: unknown, signature: string): Promise<WebhookResult>
  getSubscriptionStatus(customerId: string): Promise<SubscriptionStatus>
}

Webhook handlers must:
- Verify webhook signatures (never skip this)
- Be idempotent (same event twice = safe)
- Update InsForge DB via Schema Agent types
- Return 200 immediately, process async

Output ONLY valid JSON:
{
  "providersScaffolded": string[],
  "filesGenerated": string[],
  "envVarsRequired": string[],
  "webhookEndpoints": [{ "provider": string, "path": string }]
}`,
    });
    this.logger.log(`✅ Payments Agent → ${agent.id}`);
    return agent.id;
  }
}
