import { z } from 'zod';

const safePath = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (path) =>
      path
        .split('/')
        .every(
          (part) =>
            /^[A-Za-z0-9_-][A-Za-z0-9_. -]*$/.test(part) &&
            !part.endsWith('.') &&
            !part.endsWith(' '),
        ),
    'Use safe relative paths.',
  );
export const skillInstallActionSchema = z
  .object({
    tool: z.literal('install_skill'),
    repository: z
      .string()
      .regex(/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    directory: safePath.or(z.literal('')),
    name: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    description: z.string().min(1).max(1024),
    preview: z.string().max(4000),
    files: z
      .array(
        z
          .object({
            path: safePath,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z.number().int().min(1).max(64000),
          })
          .strict(),
      )
      .min(1)
      .max(32),
    omittedFiles: z.number().int().min(0),
  })
  .strict()
  .refine(
    (action) =>
      action.files.some((file) => file.path === 'SKILL.md') &&
      new Set(action.files.map((file) => file.path.toLowerCase())).size ===
        action.files.length &&
      action.files.reduce((sum, file) => sum + file.bytes, 0) <= 256000,
    'Invalid skill bundle.',
  );
export const githubCommitSchema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/),
});
export const githubTreeSchema = z.object({
  truncated: z.literal(false),
  tree: z
    .array(
      z.object({
        path: z.string(),
        mode: z.string(),
        type: z.string(),
        size: z.number().optional(),
      }),
    )
    .max(5000),
});
