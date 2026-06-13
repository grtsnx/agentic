import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class EmailAgent {
  private readonly logger = new Logger(EmailAgent.name);

  constructor(private readonly config: ConfigService) {}

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating Email Agent...');
    const emailDomain = this.config.get<string>('EMAIL_DOMAIN', 'example.com');
    const agent = await (client.beta.agents as any).create({
      name: 'Email Agent',
      description:
        'Generates React Email templates and Resend-powered API routes for all transactional emails.',
      model: AGENT_MODELS['email'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '11',
        tier: '2',
        parallel: 'true',
        runs_with: 'schema, cms, payments, i18n',
        depends_on: 'design',
        runs_when: 'requiresEmail=true OR hasContactForm=true',
      },
      system: `You are the Email Agent in an AI website and app builder pipeline.
You generate all transactional email templates and API routes using React Email + Resend.
Invoked when IntentSpec.requiresEmail=true OR hasContactForm=true.

Based on businessType and enabled features, generate the relevant templates:

ALWAYS generate when hasContactForm=true:
- /emails/contact-receipt.tsx     — sent to user confirming their message
- /emails/contact-notify.tsx      — sent to site owner with form submission
- /app/api/email/contact/route.ts — POST handler

Generate when requiresAuth=true:
- /emails/welcome.tsx             — welcome email after signup
- /emails/verify-email.tsx        — email verification link
- /emails/reset-password.tsx      — password reset link
- /emails/magic-link.tsx          — passwordless login link

Generate when requiresPayments=true:
- /emails/order-confirmation.tsx  — order/purchase receipt
- /emails/invoice.tsx             — formal invoice
- /emails/subscription-started.tsx
- /emails/subscription-cancelled.tsx
- /emails/payment-failed.tsx

Generate for ecommerce:
- /emails/shipping-confirmation.tsx — with tracking link
- /emails/delivery-confirmation.tsx
- /emails/refund-confirmation.tsx

Each template must:
- Use React Email components (@react-email/components)
- Match the DesignSpec palette (primary color, font family)
- Include the companyName and logo if available
- Be mobile-responsive out of the box
- Have realistic placeholder content — never Lorem ipsum

Each API route must:
- Validate request body with Zod
- Use Resend SDK to send
- Return { success: boolean, messageId?: string, error?: string }
- Check RESEND_API_KEY exists before attempting send
- Rate limit: max 1 email per 60s per email address (use in-memory map for MVP)
- Send from the verified domain "${emailDomain}". The "from" address must follow the
  pattern {custom}@${emailDomain}, where {custom} is a purpose-specific local part
  (e.g. noreply@${emailDomain}, hello@${emailDomain}, support@${emailDomain}, billing@${emailDomain}).
  Never invent a different sending domain — ${emailDomain} is the only verified Resend domain.

Also generate:
- /lib/email/resend.ts    — Resend client singleton
- /lib/email/templates.ts — typed template registry
- /lib/email/send.ts      — sendEmail(template, to, data) helper

Output ONLY valid JSON:
{
  "templatesGenerated": string[],
  "apiRoutesGenerated": string[],
  "helpersGenerated": string[],
  "provider": "resend",
  "fromEmail": "noreply@${emailDomain}"
}`,
    });
    this.logger.log(`✅ Email Agent → ${agent.id}`);
    return agent.id;
  }
}
