import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Default persona / preferences seeded into the memory store on first creation.
 *
 * Anthropic Managed Agents mount an attached memory store as a sandbox directory and
 * AUTOMATICALLY add a note to the agent's system prompt pointing at it — so agents read
 * this with their normal file tools without any hand-rolled prompt injection. The runtime
 * app overrides/extends these files per user (brand colours, tone, conventions); this is
 * just a sensible baseline so persona is grounded from the very first build.
 */
const DEFAULT_PERSONA = `# Builder persona & global preferences

Read this before starting any build. The user's own \`/user-instructions.md\` (if present)
always overrides anything here.

## Voice & tone
- Clear, modern, confident. Avoid jargon and filler.
- Match the brand signals in the user's request; never invent a brand voice that fights them.

## Quality bar
- Accessible by default (WCAG 2.1 AA), responsive, and fast (good Core Web Vitals).
- Respect user-supplied assets and reference links — they override generic defaults.

## Conventions
- Next.js 15 + React 19, TypeScript, Tailwind. shadcn/ui for marketing sites, HeroUI for app UIs.
- Use the project's design tokens (palette/spacing) — never hardcode stray colours.
`;

const DEFAULT_USER_INSTRUCTIONS = `# User instructions

(Empty by default. The runtime app writes per-user custom instructions here — brand colours,
tone, do/don't rules. Max ~25k tokens per file.)
`;

@Injectable()
export class MemoryStoreService {
  private readonly logger = new Logger(MemoryStoreService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Provisions the shared "builder-memory" store (cross-session persistent memory + persona).
   * Mirrors the vault/environment getOrCreate pattern: reuse the configured ID, else find by
   * name, else create + seed. Memory is an enhancement — any failure is logged and returns
   * an empty string so it never blocks agent provisioning.
   */
  async getOrCreate(client: Anthropic): Promise<string> {
    try {
      const existingId = this.config.get<string>('ANTHROPIC_MEMORY_STORE_ID');
      if (existingId) {
        this.logger.log(`Reusing memory store → ${existingId}`);
        return existingId;
      }

      const memoryStores = (client.beta as any).memoryStores;
      if (!memoryStores) {
        this.logger.warn(
          'Memory stores not available in this SDK version — skipping (agents still work).',
        );
        return '';
      }

      const list = await memoryStores.list({ limit: 50 });
      const found = list?.data?.find((m: any) => m.name === 'builder-memory');
      if (found) {
        this.logger.log(`Found existing memory store → ${found.id}`);
        return found.id;
      }

      const store = await memoryStores.create({
        name: 'builder-memory',
        description:
          'Per-user preferences, brand/voice persona, project conventions, and version history for the AI builder. Check before starting any task.',
      });
      this.logger.log(`Memory store created → ${store.id}`);
      await this.seedDefaults(memoryStores, store.id);
      return store.id;
    } catch (err: any) {
      this.logger.warn(
        `Could not provision memory store (${err?.message ?? err}) — continuing without it.`,
      );
      return '';
    }
  }

  private async seedDefaults(memoryStores: any, storeId: string): Promise<void> {
    const seeds: Array<{ path: string; content: string }> = [
      { path: '/persona.md', content: DEFAULT_PERSONA },
      { path: '/user-instructions.md', content: DEFAULT_USER_INSTRUCTIONS },
    ];
    for (const seed of seeds) {
      try {
        await memoryStores.memories.create(storeId, seed);
        this.logger.log(`Seeded ${seed.path}`);
      } catch (err: any) {
        if (err?.status === 409) {
          this.logger.warn(`Already exists: ${seed.path}`);
        } else {
          this.logger.warn(`Could not seed ${seed.path}: ${err?.message ?? err}`);
        }
      }
    }
  }
}
