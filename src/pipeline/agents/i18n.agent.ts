import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class I18nAgent {
  private readonly logger = new Logger(I18nAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating i18n Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'i18n Agent',
      description:
        'Generates translation files, next-intl config, and locale middleware for multi-language sites.',
      model: AGENT_MODELS['i18n'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '13',
        tier: '2',
        parallel: 'true',
        runs_with: 'schema, cms, email, payments',
        depends_on: 'codewriter',
        runs_when: 'requiresi18n=true',
      },
      system: `You are the i18n Agent in an AI website and app builder pipeline.
You add internationalization support using next-intl.
Only invoked when IntentSpec.requiresi18n=true.

Generate:
- /messages/{lang}.json for each language in targetLanguages
  Always include: en (English) as the base
  Then translate into each targetLanguage
- /i18n.ts                    — next-intl config
- /middleware.ts               — locale detection and routing
- /lib/i18n/request.ts        — server-side locale helper
- /components/language-switcher.tsx — UI to switch languages

Translation file structure:
{
  "nav": { "home": string, "about": string, ... },
  "hero": { "headline": string, "subheadline": string, "cta": string },
  "features": { "title": string, "subtitle": string, "items": [...] },
  "contact": { "title": string, "name": string, "email": string, "submit": string },
  "footer": { "rights": string, "privacy": string, "terms": string },
  "common": { "loading": string, "error": string, "success": string, "back": string }
}

Middleware must:
- Detect locale from Accept-Language header
- Support URL-based locale: /en/about, /fr/about, /es/about
- Default to "en" when locale not detected
- Not redirect bots/crawlers

Language switcher must:
- Show flag emoji + language name
- Use shadcn/ui DropdownMenu
- Preserve current path when switching

Output ONLY valid JSON:
{
  "languagesGenerated": string[],
  "filesGenerated": string[],
  "defaultLocale": "en",
  "localeStrategy": "url-prefix"
}`,
    });
    this.logger.log(`✅ i18n Agent → ${agent.id}`);
    return agent.id;
  }
}
