import { z } from 'zod';

export const webToolInputSchema = z
  .object({
    input: z
      .string()
      .trim()
      .min(1)
      .max(2_000)
      .describe('The search query, or the page URL for a page-reading tool.'),
  })
  .strict();

const pageSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
});
export const webPagesSchema = z.array(pageSchema);
export type WebPage = z.infer<typeof pageSchema>;
export type WebSource = Omit<WebPage, 'content'> & { domain: string };
export interface WebToolOptions {
  timeoutMs: number;
  maxResults: number;
  domains: string[];
  signal: AbortSignal;
}

export const contextSearchSchema = z.object({
  results: z.array(
    z.object({ title: z.string(), url: z.string(), description: z.string() }),
  ),
});
export const firecrawlPageSchema = z.object({
  markdown: z.string().min(1),
  metadata: z
    .object({ title: z.string().optional(), sourceURL: z.string().optional() })
    .optional(),
});
export const valyuSearchSchema = z.object({
  success: z.literal(true),
  results: z.array(
    z.object({ title: z.string(), url: z.string(), content: z.string() }),
  ),
});
