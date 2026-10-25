import type { z } from 'zod';
import type { webPagesSchema } from '../../web-tools/web-tool.schema.js';

export type WebPage = z.infer<typeof webPagesSchema>[number];

export type WebSource = Omit<WebPage, 'content'> & { domain: string };

export interface WebToolOptions {
  timeoutMs: number;
  maxResults: number;
  domains: string[];
  signal: AbortSignal;
}
